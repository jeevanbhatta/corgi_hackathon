import type { ArchitectureSnapshot, CommitSnapshot, PullRequest } from '@/types';

const API = 'https://api.github.com';

const ENTRY_RE = /^(index|main)\.[tj]sx?$|^app\.(tsx|jsx)$/i;

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

type GhCommitListItem = { sha: string; url: string };
type TreeEntry = { path: string; type: string };

function pickEvenlySpacedCommits(commits: CommitSnapshot[], count: number): CommitSnapshot[] {
  const n = commits.length;
  if (n === 0) return [];
  if (n <= count) return [...commits];
  const idxs = new Set<number>();
  for (let i = 0; i < count; i++) {
    idxs.add(Math.round((i * (n - 1)) / Math.max(1, count - 1)));
  }
  return [...idxs].sort((a, b) => a - b).map((i) => commits[i]!);
}

/**
 * Fetches up to `limit` commits (newest first). Paginates GitHub list API as needed.
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  limit: number
): Promise<CommitSnapshot[]> {
  const perPage = Math.min(100, Math.max(1, limit));
  const out: CommitSnapshot[] = [];
  let page = 1;

  while (out.length < limit) {
    const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}&page=${page}`;
    const listRes = await fetch(url, { headers: githubHeaders() });
    if (!listRes.ok) throw new Error(`GitHub commits list ${listRes.status}: ${await listRes.text()}`);

    const batch = (await listRes.json()) as GhCommitListItem[];
    if (!batch.length) break;

    for (const item of batch) {
      if (out.length >= limit) break;
      const detailRes = await fetch(
        `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${item.sha}`,
        { headers: githubHeaders() }
      );
      if (!detailRes.ok) {
        throw new Error(`GitHub commit ${item.sha} ${detailRes.status}: ${await detailRes.text()}`);
      }
      const detail = (await detailRes.json()) as {
        sha: string;
        commit: {
          message: string;
          author: { name?: string; date?: string };
        };
        files?: Array<{ filename: string; additions: number; deletions: number }>;
      };

      const files = detail.files ?? [];
      const additions = files.reduce((s, f) => s + (f.additions ?? 0), 0);
      const deletions = files.reduce((s, f) => s + (f.deletions ?? 0), 0);

      out.push({
        sha: detail.sha,
        date: detail.commit.author?.date ?? new Date().toISOString(),
        message: detail.commit.message ?? '',
        author: detail.commit.author?.name ?? '',
        filesChanged: files.map((f) => f.filename),
        additions,
        deletions,
      });
    }

    if (batch.length < perPage) break;
    page += 1;
  }

  return out;
}

/** Stub for future PR ingestion (design doc). */
export async function fetchPRs(
  _owner: string,
  _repo: string,
  _count: number
): Promise<PullRequest[]> {
  return [];
}

export async function getCommitAuthorDate(owner: string, repo: string, sha: string): Promise<string> {
  const res = await fetch(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${sha}`,
    { headers: githubHeaders() }
  );
  if (!res.ok) throw new Error(`GitHub commit ${sha} ${res.status}: ${await res.text()}`);
  const detail = (await res.json()) as {
    commit?: { author?: { date?: string }; committer?: { date?: string } };
  };
  return (
    detail.commit?.author?.date ??
    detail.commit?.committer?.date ??
    new Date().toISOString()
  );
}

async function fetchTreeTopLevel(owner: string, repo: string, refSha: string): Promise<TreeEntry[]> {
  const res = await fetch(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${refSha}?recursive=0`,
    { headers: githubHeaders() }
  );
  if (!res.ok) throw new Error(`GitHub tree ${refSha} ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { tree?: TreeEntry[] };
  return data.tree ?? [];
}

async function fetchPackageJsonSnapshot(
  owner: string,
  repo: string,
  refSha: string
): Promise<ArchitectureSnapshot['packageJson'] | undefined> {
  const res = await fetch(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/package.json?ref=${refSha}`,
    { headers: githubHeaders() }
  );
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub package.json ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (data.encoding !== 'base64' || typeof data.content !== 'string') return undefined;
  const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const json = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return {
    dependencies: json.dependencies ?? {},
    devDependencies: json.devDependencies ?? {},
  };
}

/** Sample architecture at up to `sampleCount` evenly spaced commits (default 5). */
export async function sampleArchitecture(
  owner: string,
  repo: string,
  commits: CommitSnapshot[],
  sampleCount = 5
): Promise<ArchitectureSnapshot[]> {
  const picked = pickEvenlySpacedCommits(commits, sampleCount);
  const out: ArchitectureSnapshot[] = [];

  for (const c of picked) {
    const tree = await fetchTreeTopLevel(owner, repo, c.sha);
    const directories = tree.filter((t) => t.type === 'tree').map((t) => t.path);
    const entryPoints = tree
      .filter((t) => t.type === 'blob' && ENTRY_RE.test(t.path))
      .map((t) => t.path);
    let packageJson: ArchitectureSnapshot['packageJson'] | undefined;
    try {
      packageJson = await fetchPackageJsonSnapshot(owner, repo, c.sha);
    } catch {
      packageJson = undefined;
    }
    out.push({
      commitSha: c.sha,
      date: c.date,
      directories,
      packageJson,
      entryPoints,
    });
  }

  return out;
}
