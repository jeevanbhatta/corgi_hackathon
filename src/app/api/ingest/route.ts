import { fetchCommits, sampleArchitecture } from '@/lib/github';
import { storeRepoMemories } from '@/lib/hydra';
import { resolveIngestCommitLimit } from '@/lib/ingest-config';
import { parseGitHubUrl } from '@/lib/parse-github-url';
import { repoIndex } from '@/lib/store';
import type { TimelineEvent } from '@/types';

export async function POST(req: Request) {
  let body: { url?: string; maxCommits?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return new Response(JSON.stringify({ error: 'url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const commitLimit = resolveIngestCommitLimit(body.maxCommits);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { owner, repo } = parseGitHubUrl(url);
        const subTenantId = `${owner}_${repo}`;

        send({
          type: 'progress',
          message: 'Fetching commits...',
          pct: 10,
          commitLimit,
        });

        const commits = await fetchCommits(owner, repo, commitLimit);

        send({
          type: 'progress',
          message: 'Sampling architecture at 5 points...',
          pct: 40,
        });
        const archSnapshots = await sampleArchitecture(owner, repo, commits, 5);

        send({ type: 'progress', message: 'Storing memories in HydraDB...', pct: 80 });
        await storeRepoMemories(subTenantId, commits, [], archSnapshots);

        const timeline: TimelineEvent[] = [];

        repoIndex.set(url, {
          repoId: subTenantId,
          owner,
          repo,
          timeline,
          archSnapshots,
          indexedAt: new Date().toISOString(),
        });

        send({
          type: 'done',
          repoId: subTenantId,
          url,
          commitsIngested: commits.length,
          commitLimit,
          timeline,
        });
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Ingest failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
