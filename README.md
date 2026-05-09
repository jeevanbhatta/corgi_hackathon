# Repo Time Machine

**Turn commit noise into a readable story of how a codebase actually grew.**

When you inherit a project, review unfamiliar code, or need to explain *why* things are the way they are, you usually live in `git log` and hope the narrative appears. Repo Time Machine does that work for a **public GitHub repository**: it rebuilds a timeline of meaningful changes, shows how **folders and dependencies** shifted between those moments, and lets you **chat** with an assistant that reasons over that history—so you can onboard faster, spot when a subsystem got complicated, or brief someone without spending an afternoon in blame view.

---

## What you get

- **URL → timeline** — Paste a GitHub repo URL. The app ingests recent commits and related context, streams progress, then renders an interactive timeline.
- **Scrub through history** — Step event-by-event (slider, clicks, or keyboard) and watch the “architecture frame” update: directories, entry points, and `package.json` deltas.
- **Chat grounded in the repo** — Ask questions in plain language; answers can cite commits and highlight matching events on the timeline.
- **APIs under the hood** — `POST /api/ingest` (SSE progress + timeline), `POST /api/query` (streaming chat), `GET /api/diff` (architecture-style diffs between SHAs).

---

## Stack

| Layer | Choice |
|--------|--------|
| App | [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Data | GitHub REST, optional [HydraDB](https://hydradb.com) for semantic recall, [Pipeshift](https://pipeshift.com) for the chat model |

For the full system picture and data shapes, see [`repo-time-machine-design-doc.md`](./repo-time-machine-design-doc.md).

---

## Prerequisites

- **Node.js** 20+ (recommended)
- A **GitHub** personal access token with `repo` read access (for private repos you can access; public repos work with a token for higher rate limits)
- **Pipeshift** API key for `/api/query`
- **HydraDB** tenant + API key if you want recall-backed chat (ingest stores memories; query recalls them)

---

## Quick start

```bash
git clone https://github.com/jeevanbhatta/corgi_hackathon.git
cd corgi_hackathon
npm install
cp .env.example .env.local
# Edit .env.local — see table below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a public GitHub URL, and wait for ingestion to finish.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | Yes (for real ingest) | GitHub API authentication |
| `PIPESHIFT_API_KEY` | Yes (for chat) | LLM / chat completions |
| `HYDRADB_API_KEY` | If using HydraDB | Memory + recall |
| `HYDRADB_TENANT_ID` | If using HydraDB | Tenant id (see HydraDB dashboard) |
| `INGEST_COMMIT_LIMIT` | No | Commits to fetch (default in example: `50`) |
| `INGEST_COMMIT_LIMIT_MAX` | No | Hard cap for safety (example: `100`) |

Never commit `.env.local` or real secrets.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |

---

## Project layout (high level)

```
src/
  app/           # Routes, layout, global styles
  app/api/       # ingest, query, diff
  components/    # URL input, progress, timeline, scrubber, chat, etc.
  lib/           # GitHub client, HydraDB, Pipeshift, arch framing, mocks
  types.ts       # Shared TypeScript contracts
```

---

## License

Private hackathon project unless otherwise noted by the maintainers.
