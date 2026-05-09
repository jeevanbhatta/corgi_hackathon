# RepoPlay — Hackathon Design Document
**Status:** 3 hours to demo | **Stack:** Next.js + Pipeshift (DeepSeek-V4-Pro) + GitHub API + HydraDB

---

## 1. What We're Actually Building

A single-page app where you paste a GitHub URL, and an AI agent reconstructs *why* the codebase evolved the way it did — not just what changed, but the reasoning behind it. Output is a scrollable timeline with architecture diffs and a chat interface that understands commit history as context.

**The demo moment that wins:** User pastes `github.com/org/repo` → 30 seconds of indexing → scrollable timeline appears → user types "when did auth become complicated?" → agent highlights a specific commit range, shows an architecture before/after diff, and explains in plain English that it happened because they added OAuth and that broke the original session model.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router)                                   │
│                                                                 │
│  [URL Input] → [Progress Stream] → [Timeline UI] → [Chat]      │
└────────────────────────┬────────────────────────────────────────┘
                         │ SSE / fetch streaming
┌────────────────────────▼────────────────────────────────────────┐
│  Next.js API Routes (/app/api)                                  │
│                                                                 │
│  /api/ingest     → GitHub fetcher + snapshot builder           │
│  /api/query      → Pipeshift agent with full context           │
│  /api/diff       → Architecture differ                         │
└──────┬─────────────────┬──────────────────┬────────────────────┘
       │                 │                  │
  GitHub REST       Pipeshift API       HydraDB
  (commits,PRs,     (DeepSeek-V4-Pro)   (memories + recall)
   files,trees)                         api.hydradb.com
```

### Data Flow (Ingestion)

```
GitHub URL
    │
    ▼
Fetch last 50 commits (REST /repos/{owner}/{repo}/commits)
    │
    ▼
For each commit → fetch changed files (commit.files[])
    │
    ▼
Sample file tree at 5 evenly-spaced commits (avoid rate limits)
    │
    ▼
Fetch open+closed PRs (last 100) — title/body/merged_at/labels
    │
    ▼
Build CommitSnapshot[] → store as HydraDB memories (sub_tenant_id = repo slug)
    │
    ▼
Stream progress to client via SSE
    │
    ▼
Return timeline JSON to client
```

---

## 3. Data Structures

```typescript
// Core types — everyone implements against these

interface CommitSnapshot {
  sha: string;
  date: string;               // ISO
  message: string;
  author: string;
  filesChanged: string[];     // relative paths only
  additions: number;
  deletions: number;
  pr?: PullRequest;           // matched by merge commit SHA
}

interface PullRequest {
  number: number;
  title: string;
  body: string;               // raw markdown, truncated to 1000 chars
  mergedAt: string;
  labels: string[];
}

interface ArchitectureSnapshot {
  commitSha: string;
  date: string;
  directories: string[];      // top-level + second-level dirs
  packageJson?: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  entryPoints: string[];      // index.ts, main.ts, app.tsx etc.
}

interface TimelineEvent {
  id: string;
  date: string;
  type: 'commit' | 'pr_merge' | 'dep_change' | 'arch_shift';
  title: string;
  description: string;        // AI-generated, 1-2 sentences
  significance: 1 | 2 | 3;   // 1=minor, 3=major
  commitSha: string;
  filesChanged: string[];
  archBefore?: ArchitectureSnapshot;
  archAfter?: ArchitectureSnapshot;
}

// No module-level Map needed — HydraDB is the store.
// repoId = sub_tenant_id used to scope all memories for a repo.
// Derive it from the URL: "github.com/owner/repo" → "owner_repo"
interface RepoIndex {
  repoId: string;             // "owner_repo" — used as sub_tenant_id in HydraDB
  owner: string;
  repo: string;
  timeline: TimelineEvent[];  // cached in-process after ingestion (short-lived, demo only)
  indexedAt: string;          // ISO — so the UI can show "indexed 2 min ago"
}

// Module-level cache: only holds the timeline and metadata, not the full corpus.
// The corpus (commits, PRs, arch snapshots) lives in HydraDB.
const repoIndex = new Map<string, RepoIndex>();
```

---

## 4. API Routes

### POST `/api/ingest`
```typescript
// Request
{ url: string }  // "https://github.com/owner/repo"

// Response: SSE stream
// Events:
// { type: 'progress', message: 'Fetching commits...', pct: 10 }
// { type: 'progress', message: 'Sampling architecture...', pct: 40 }
// { type: 'progress', message: 'Building timeline...', pct: 70 }
// { type: 'done', timeline: TimelineEvent[], repoId: string }
// { type: 'error', message: string }
```

**Implementation (pseudocode):**
```typescript
export async function POST(req: Request) {
  const { url } = await req.json();
  const [owner, repo] = parseGitHubUrl(url);
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      
      send({ type: 'progress', message: 'Fetching commits...', pct: 10 });
      const commits = await fetchCommits(owner, repo, 50);  // last 50
      
      send({ type: 'progress', message: 'Fetching PRs...', pct: 25 });
      const prs = await fetchPRs(owner, repo, 100);
      
      send({ type: 'progress', message: 'Sampling architecture at 5 points...', pct: 40 });
      const archSnapshots = await sampleArchitecture(owner, repo, commits);
      
      send({ type: 'progress', message: 'AI is building timeline...', pct: 60 });
      const timeline = await buildTimelineWithAI(commits, prs, archSnapshots);
      
      send({ type: 'progress', message: 'Storing memories in HydraDB...', pct: 80 });
      const repoId = `${owner}_${repo}`;
      await storeRepoMemories(repoId, commits, prs, archSnapshots);
      
      // Cache only the timeline in-process (not the full corpus)
      repoIndex.set(url, { repoId, owner, repo, timeline, indexedAt: new Date().toISOString() });
      
      send({ type: 'done', timeline, repoId: url });
      controller.close();
    }
  });
  
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
```

### POST `/api/query`
```typescript
// Request
{ repoId: string; question: string; conversationHistory: Message[] }

// Response: SSE text stream (Pipeshift streaming)
// Plain text chunks + optional structured block at end:
// { type: 'highlight', commitShas: string[], explanation: string }
// { type: 'arch_diff', before: ArchitectureSnapshot, after: ArchitectureSnapshot }
```

**Pipeshift base helper** — put this in `/lib/pipeshift.ts`, both routes use it:
```typescript
const PIPESHIFT_URL = 'https://api.pipeshift.com/api/v0/chat/completions';
const PIPESHIFT_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

export async function pipeshiftChat(
  messages: { role: string; content: string }[],
  stream = false
) {
  const res = await fetch(PIPESHIFT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PIPESHIFT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PIPESHIFT_MODEL,
      messages,
      temperature: 0.3,   // lower = more deterministic JSON output
      stream,
    }),
  });
  if (!res.ok) throw new Error(`Pipeshift ${res.status}: ${await res.text()}`);
  return res;
}

// Convenience: non-streaming, returns text string
export async function pipeshiftComplete(
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await pipeshiftChat(messages, false);
  const data = await res.json();
  return data.choices[0].message.content as string;
}
```

**`buildTimelineWithAI()` — called once during ingestion, result is cached:**
```typescript
async function buildTimelineWithAI(
  commits: CommitSnapshot[],
  prs: PullRequest[],
  archSnapshots: ArchitectureSnapshot[]
): Promise<TimelineEvent[]> {
  const content = await pipeshiftComplete([
    {
      role: 'system',
      content: `You are analyzing a git repository's history.
Return ONLY valid JSON — an array of TimelineEvent objects.
No preamble, no markdown fences, no explanation. Pure JSON array.`,
    },
    {
      role: 'user',
      content: `Identify the 8-15 most significant architectural moments in this codebase.

COMMITS (newest first):
${commits.slice(0, 50).map(c =>
  `${c.sha.slice(0,7)} ${c.date}: ${c.message} (+${c.additions}/-${c.deletions}) files: ${c.filesChanged.slice(0,5).join(', ')}`
).join('\n')}

PULL REQUESTS (merged):
${prs.slice(0, 50).map(pr =>
  `#${pr.number} "${pr.title}" ${pr.mergedAt}: ${pr.body.slice(0,200)}`
).join('\n')}

ARCHITECTURE SNAPSHOTS:
${archSnapshots.map(s =>
  `${s.date}: dirs=[${s.directories.slice(0,10).join(',')}] deps=${Object.keys(s.packageJson?.dependencies||{}).join(',')}`
).join('\n')}

Return JSON array matching this shape exactly:
[{
  "id": "evt_1",
  "date": "ISO string",
  "type": "commit|pr_merge|dep_change|arch_shift",
  "title": "max 60 chars",
  "description": "1-2 sentences explaining WHY this mattered",
  "significance": 1,
  "commitSha": "full sha",
  "filesChanged": ["path1"]
}]`,
    },
  ]);

  // Strip any accidental markdown fences before parsing
  const clean = content.replace(/^```json\n?|```$/gm, '').trim();
  return JSON.parse(clean) as TimelineEvent[];
}
```

**`/api/query` — HydraDB recall replaces the flat rawContext dump:**
```typescript
export async function POST(req: Request) {
  const { repoId, question, conversationHistory } = await req.json();
  const index = repoIndex.get(repoId);
  if (!index) return new Response('Repo not indexed', { status: 404 });

  // 1. Recall relevant chunks from HydraDB (semantic + graph retrieval)
  const recalled = await recallForQuery(index.repoId, question);

  // 2. Format recalled chunks into a tight context block
  const contextBlock = recalled.chunks
    .map(c => `[${c.source_title} | score: ${c.relevancy_score.toFixed(2)}]\n${c.chunk_content}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are an expert software archaeologist.
Answer questions about WHY the codebase changed, not just what changed.
Cite specific commits by their 7-char SHA when relevant.

Always end your response with a fenced \`\`\`json block:
{
  "highlightShas": ["abc1234"],
  "archDiff": { "beforeSha": "...", "afterSha": "..." } | null,
  "timelineRange": { "start": "ISO", "end": "ISO" } | null
}

RETRIEVED CONTEXT (most relevant chunks from repo history):
${contextBlock}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: question },
  ];

  // 3. Stream response from Pipeshift/DeepSeek
  const upstream = await pipeshiftChat(messages, true);
  // ... same SSE pipe as before
}
```

**Why this beats rawContext:** instead of dumping all 50 commits into every prompt, HydraDB's `full_recall` uses semantic + graph retrieval to pull only the chunks that actually matter for the question. "When did auth get complicated?" retrieves auth-related commits, not database migration commits.

**Frontend: reading the stream + extracting the JSON tail block:**
```typescript
// In ChatPanel.tsx
async function sendQuestion(question: string) {
  const res = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoId, question, conversationHistory }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    // Update chat bubble incrementally (strip trailing JSON block for display)
    setStreamingText(fullText.replace(/```json[\s\S]*?```\s*$/, '').trim());
  }

  // Parse JSON tail block after stream closes
  const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```\s*$/);
  if (jsonMatch) {
    try {
      const { highlightShas, archDiff } = JSON.parse(jsonMatch[1]);
      setHighlightedShas(highlightShas ?? []);
      if (archDiff) setActiveArchDiff(archDiff);
    } catch { /* malformed, ignore */ }
  }
}
```

### GET `/api/diff?repo={repoId}&before={sha}&after={sha}`
```typescript
// Returns: ArchDiff
{
  addedDirs: string[];
  removedDirs: string[];
  addedDeps: Record<string, string>;
  removedDeps: Record<string, string>;
  changedDeps: Record<string, { before: string; after: string }>;
}
```

---

## 5. GitHub API — What to Call and In What Order

```typescript
// All calls use: Authorization: token ${GITHUB_TOKEN}
// Base: https://api.github.com

// 1. Commits (paginated, get 2 pages = 60 commits)
GET /repos/{owner}/{repo}/commits?per_page=30&page=1
GET /repos/{owner}/{repo}/commits?per_page=30&page=2

// 2. Individual commit detail for each (get files changed)
// ⚠️ RATE LIMIT: Only do this for a sample of 15-20 commits, not all 60
GET /repos/{owner}/{repo}/commits/{sha}

// 3. PRs
GET /repos/{owner}/{repo}/pulls?state=closed&per_page=100&sort=updated

// 4. File tree for architecture snapshots (5 evenly-spaced commits)
GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=0
// recursive=0 gives top-level only — enough for architecture

// 5. package.json content (only at snapshot commits)
GET /repos/{owner}/{repo}/contents/package.json?ref={sha}
// Response has base64-encoded content — atob() to decode
```

**Rate limit strategy:** GitHub allows 60 unauth / 5000 auth requests/hour. With a token, you're safe for demo purposes. Use `GITHUB_TOKEN` env var. If 429, add a 1s delay between commit detail fetches.

---

## 6. HydraDB Integration — `/lib/hydra.ts`

HydraDB replaces the in-memory Map as the corpus store. Commits, PRs, and architecture snapshots are stored as memories scoped per repo using `sub_tenant_id`. At query time, `full_recall` does semantic + graph retrieval so DeepSeek only sees the relevant chunks.

**Tenant strategy for the hackathon:**
- One global tenant: `HYDRADB_TENANT_ID` env var (create once in the dashboard)
- `sub_tenant_id` = `owner_repo` slug (e.g., `vercel_next-js`) — per-repo isolation
- `infer: false` — store content as-is (fast ingestion, no enrichment overhead)

```typescript
// /lib/hydra.ts
const BASE = 'https://api.hydradb.com';
const TENANT = process.env.HYDRADB_TENANT_ID!;
const headers = () => ({
  'Authorization': `Bearer ${process.env.HYDRADB_API_KEY}`,
  'Content-Type': 'application/json',
});

// ─── storeRepoMemories ────────────────────────────────────────────────────
// Called once during ingestion. Stores all commits, PRs, and arch snapshots
// as HydraDB memories scoped to this repo's sub_tenant_id.
export async function storeRepoMemories(
  subTenantId: string,
  commits: CommitSnapshot[],
  prs: PullRequest[],
  archSnapshots: ArchitectureSnapshot[]
) {
  // Format each piece as a self-contained text blob HydraDB can chunk + embed
  const memories = [
    // Commits
    ...commits.map(c => ({
      text: `COMMIT ${c.sha.slice(0,7)} | ${c.date} | ${c.author}
Message: ${c.message}
Changes: +${c.additions} -${c.deletions}
Files: ${c.filesChanged.join(', ')}`,
      infer: false,
    })),
    // PRs
    ...prs.map(pr => ({
      text: `PULL REQUEST #${pr.number} | merged ${pr.mergedAt}
Title: ${pr.title}
Labels: ${pr.labels.join(', ')}
Description: ${pr.body.slice(0, 500)}`,
      infer: false,
    })),
    // Architecture snapshots
    ...archSnapshots.map(s => ({
      text: `ARCHITECTURE SNAPSHOT | ${s.date} | commit ${s.commitSha.slice(0,7)}
Directories: ${s.directories.join(', ')}
Dependencies: ${JSON.stringify(s.packageJson?.dependencies ?? {})}
Entry points: ${s.entryPoints.join(', ')}`,
      infer: false,
    })),
  ];

  // HydraDB accepts up to 100 memories per call — batch if needed
  const BATCH = 50;
  for (let i = 0; i < memories.length; i += BATCH) {
    const batch = memories.slice(i, i + BATCH);
    const res = await fetch(`${BASE}/memories/add_memory`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ tenant_id: TENANT, sub_tenant_id: subTenantId, memories: batch }),
    });
    if (!res.ok) throw new Error(`HydraDB add_memory failed: ${await res.text()}`);
  }
}

// ─── recallForQuery ──────────────────────────────────────────────────────
// Called on every /api/query. Returns semantically relevant chunks for the
// user's question — much tighter than dumping all 50 commits into the prompt.
export async function recallForQuery(subTenantId: string, query: string) {
  const res = await fetch(`${BASE}/recall/full_recall`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      tenant_id: TENANT,
      sub_tenant_id: subTenantId,
      query,
      max_results: 15,       // enough context, not too many tokens
      graph_context: true,   // include relationship data between chunks
    }),
  });
  if (!res.ok) throw new Error(`HydraDB recall failed: ${await res.text()}`);
  return res.json() as Promise<{
    chunks: Array<{
      chunk_uuid: string;
      chunk_content: string;
      source_title: string;
      relevancy_score: number;
    }>;
    graph_context: object;
  }>;
}
```

**Infrastructure note:** HydraDB tenant infrastructure is provisioned asynchronously. For the demo, create your tenant + verify `graph_status: true` before the hackathon starts — don't do it live. Once provisioned, memories ingest and are searchable within seconds.

```bash
# One-time setup before demo (run in terminal, not in app code)
curl -X POST 'https://api.hydradb.com/tenants/create' \
  -H "Authorization: Bearer $HYDRADB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "repo-time-machine"}'

# Poll until graph_status: true
curl "https://api.hydradb.com/tenants/infra/status?tenant_id=repo-time-machine" \
  -H "Authorization: Bearer $HYDRADB_API_KEY"
```

---

## 7. Frontend Components

### Component Tree
```
app/
  page.tsx                    // root — URL input or timeline
  components/
    URLInput.tsx              // paste URL + submit
    IngestionProgress.tsx     // SSE progress bar + status messages
    Timeline.tsx              // vertical scrollable timeline
    TimelineEvent.tsx         // single event card (expandable)
    ArchDiff.tsx              // before/after architecture visual
    ChatPanel.tsx             // right-side chat with Pipeshift/DeepSeek
    CommitHighlight.tsx       // highlighted commits on timeline
```

### URLInput.tsx
- Single large text input, centered
- Validates GitHub URL pattern on blur
- Shows "Analyzing repo..." state during ingestion
- Connects to SSE stream from `/api/ingest`

### Timeline.tsx (the centerpiece)
```
[2024-03-15]  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              🔴 Auth refactor — significance 3
              "Moved from session cookies to JWTs after scaling issues"
              [3 files] [View diff] [Ask about this]

[2024-01-08]  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              🟡 Redis introduced — significance 2
              "Added Redis for caching after DB query timeouts in prod"
              [package.json, redis.config.ts] [View diff]

[2023-11-20]  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ⚪ Initial structure — significance 1
```

- Vertical line down the center-left
- Dots colored by significance (red/amber/gray)
- Cards expand on click to show ArchDiff
- Highlighted events glow when agent references them in chat

### ChatPanel.tsx
- Fixed right panel (380px wide on desktop, full-width drawer on mobile)
- Suggested questions on load:
  - "When did auth become complicated?"
  - "Why was [X dependency] introduced?"
  - "Which files changed the most?"
  - "What was the biggest architectural shift?"
- Streams DeepSeek response via Pipeshift SSE
- After response, parses trailing JSON block and highlights timeline events

### ArchDiff.tsx
```
Before (2023-11-20)          After (2024-03-15)
━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━
src/
  api/              →        src/
  components/                  api/
  utils/                       auth/        ← NEW
                               components/
Dependencies:                  middleware/  ← NEW
  express 4.18                 utils/
  mongoose 7.x    
                   →        Dependencies:
                               + jsonwebtoken 9.x
                               + ioredis 5.x
                               express 4.18
                               mongoose 7.x
```

---

## 8. State Management

Use React's built-in state only — no Redux/Zustand for time savings.

```typescript
// app/page.tsx
const [phase, setPhase] = useState<'input' | 'loading' | 'timeline'>('input');
const [progress, setProgress] = useState({ message: '', pct: 0 });
const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
const [repoId, setRepoId] = useState('');              // sub_tenant_id for HydraDB recall
const [highlightedShas, setHighlightedShas] = useState<string[]>([]);
const [chatHistory, setChatHistory] = useState<Message[]>([]);

// Pass down as props — component tree is shallow enough
```

---

## 9. Environment Variables

```bash
# .env.local
GITHUB_TOKEN=ghp_xxxxxxxxxxxx        # classic PAT with repo read scope
PIPESHIFT_API_KEY=ps_xxxxxxxxxxxx    # from pipeshift.com dashboard
HYDRADB_API_KEY=hdb_xxxxxxxxxxxx     # from hydradb.com dashboard
HYDRADB_TENANT_ID=repo-time-machine  # created once before demo (see §6)
```

**Important:** provision the HydraDB tenant before the hackathon starts (see §6 curl commands). It's async and can take a few minutes to reach `graph_status: true`.

---

## 10. MVP Cuts — What to Skip Completely

| Feature | Why skip |
|---|---|
| HydraDB tenant polling in-app | Pre-provision before demo; don't wait on `graph_status` at runtime |
| Auth/login | One repo at a time, no user accounts needed |
| PR comments/reviews | Too many API calls, not enough value |
| File-level diff rendering | Too complex, arch-level diff is enough |
| Multi-branch | Scope creep |
| Repo >2k files | Add a file count check and reject early |
| Retry/error recovery | Show error state, ask user to refresh |
| Mobile layout | Optimize for judge's laptop |
| Unit tests | Not in 3 hours |

---

## 11. Demo Script (Practice This)

1. **Paste URL** → use a well-known open-source JS/TS repo with interesting history (suggest: `github.com/vercel/next.js` subset, or your own project)
2. **Watch progress bar** → "Fetching commits... Sampling architecture... Building timeline..."
3. **Timeline appears** → scroll through, point out the red (significance 3) events
4. **Click an event** → ArchDiff expands showing directory + dependency changes
5. **Type in chat:** "When did auth become complicated?" → timeline highlights 2-3 events, agent explains the progression
6. **Type:** "Why was [dependency from their actual package.json] introduced?" → agent cites specific PR title/description

**Backup plan if API is slow:** Pre-index a repo and hardcode the timeline JSON. Have it ready as a JSON file you can serve from `/api/demo`. HydraDB memories from the pre-indexed repo will already be queryable.

---

## 12. Work Breakdown — 4 Developers, 3 Hours

### Dev 1 — GitHub Ingestion + HydraDB Storage
**Goal:** Working `/api/ingest` endpoint that SSE-streams progress, returns `TimelineEvent[]`, and stores all memories in HydraDB

| Task | Time |
|---|---|
| GitHub REST fetcher (`fetchCommits`, `fetchPRs`, `sampleArchitecture`) | 45 min |
| `buildTimelineWithAI()` via Pipeshift + JSON parsing | 25 min |
| `/lib/hydra.ts` — `storeRepoMemories()` with batching | 25 min |
| SSE stream wrapping + error handling | 15 min |
| Integration test: full ingest → verify memories appear in HydraDB | 10 min |

**Deliverable by hour 2:** `curl -X POST /api/ingest -d '{"url":"https://github.com/..."}' --no-buffer` streams progress events and stores memories in HydraDB.

---

### Dev 2 — Pipeshift Query Agent + `/api/query`
**Goal:** Working conversational agent that recalls from HydraDB, highlights commits, returns arch diff references

| Task | Time |
|---|---|
| `/lib/pipeshift.ts` helper (`pipeshiftChat`, `pipeshiftComplete`) | 20 min |
| `/lib/hydra.ts` — `recallForQuery()` (get from Dev 1's file) | 10 min |
| `/api/query` — recall → format context block → stream DeepSeek | 35 min |
| System prompt engineering (commit citation, JSON tail block) | 20 min |
| JSON tail block extractor from streamed response | 15 min |
| `/api/diff?before=&after=` endpoint (pure JS diffing of ArchSnapshots) | 20 min |

**Deliverable by hour 2:** POST `/api/query` → HydraDB recall → DeepSeek streaming text + `{highlightShas, archDiff}` JSON tail block.

---

### Dev 3 — Timeline UI + ArchDiff Component
**Goal:** Scrollable timeline with expandable events and the before/after architecture visual

| Task | Time |
|---|---|
| Timeline vertical layout (CSS only, no library) | 25 min |
| TimelineEvent card — collapsed/expanded states | 25 min |
| Significance dot + color system | 10 min |
| ArchDiff component (directory tree diff + dep diff) | 40 min |
| Highlight animation when `highlightedShas` changes | 15 min |
| Repo metadata header (name, star count, language) | 5 min |

**Deliverable by hour 2:** Static timeline renders from hardcoded `TimelineEvent[]` mock data with working expand/collapse and ArchDiff visual.

---

### Dev 4 — URLInput + Progress + Chat Panel + Integration
**Goal:** Full user flow from URL paste to chat, wiring all pieces together

| Task | Time |
|---|---|
| URLInput component + GitHub URL validation | 20 min |
| Ingestion progress — SSE client, animated progress bar | 25 min |
| ChatPanel — message list, input, send button | 25 min |
| SSE chat streaming + response rendering (markdown) | 20 min |
| Wire `highlightedShas` from chat response → timeline | 15 min |
| Demo polish: loading skeletons, error states, suggested questions | 15 min |

**Deliverable by hour 2:** Full app flow works end-to-end with mock API responses; ready to swap in real APIs.

---

### Sync Points

| Time | Sync |
|---|---|
| T+0:00 | Everyone aligns on types.ts — copy the types from §3 into a shared file first |
| T+1:00 | Dev 1 + Dev 2 share API contract; Dev 3 + Dev 4 confirm component props |
| T+2:00 | Integration: Dev 4 replaces mock data with real APIs from Dev 1 + Dev 2 |
| T+2:30 | Demo run-through, fix critical bugs only |
| T+3:00 | Freeze, practice pitch |

### Shared Files to Create First (15 min, anyone)

```
/types.ts          — CommitSnapshot, TimelineEvent, ArchitectureSnapshot, Message
/lib/github.ts     — fetchCommits, fetchPRs, sampleArchitecture stubs
/lib/hydra.ts      — storeRepoMemories, recallForQuery (owned by Dev 1, used by Dev 2)
/lib/pipeshift.ts  — pipeshiftChat, pipeshiftComplete (owned by Dev 2)
/lib/store.ts      — module-level Map<string, RepoIndex> (timeline cache only)
/mock-data.ts      — 10 hardcoded TimelineEvents for UI dev
```

Get these files created and committed before anyone starts their tasks. This removes blockers.

---

## 13. Suggested Repo for Demo

Use a real, famous JS/TS repo with good commit history:

- `vercel/next.js` — too large, but filtered to 50 commits it's fine
- `supabase/supabase` — good PR history with meaningful descriptions
- `trpc/trpc` — clean architecture shifts visible in directory structure
- **Best option: your own hackathon project or a team member's public repo** — you know the history, you can narrate it authentically

Pre-index it before the demo and cache the result. Don't live-index during the judges' 3-minute window.
