import { buildTimelineWithAI } from '@/lib/build-timeline';
import { fetchCommits, sampleArchitecture } from '@/lib/github';
import { storeRepoMemories } from '@/lib/hydra';
import { resolveIngestCommitLimit } from '@/lib/ingest-config';
import { parseGitHubUrl } from '@/lib/parse-github-url';
import { repoIndex } from '@/lib/store';

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

        console.log(`[ingest] Starting ingestion for ${owner}/${repo} (limit: ${commitLimit})`);
        send({
          type: 'progress',
          message: 'Fetching commits...',
          pct: 10,
          commitLimit,
        });

        const t0 = Date.now();
        const commits = await fetchCommits(owner, repo, commitLimit);
        console.log(`[ingest] Fetched ${commits.length} commits in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

        send({
          type: 'progress',
          message: 'Sampling architecture at 5 points...',
          pct: 40,
        });
        const t1 = Date.now();
        const archSnapshots = await sampleArchitecture(owner, repo, commits, 5);
        console.log(`[ingest] Sampled ${archSnapshots.length} arch snapshots in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

        send({ type: 'progress', message: 'AI is building timeline...', pct: 60 });
        const t2 = Date.now();
        let timeline: import('@/types').TimelineEvent[] = [];
        try {
          timeline = await buildTimelineWithAI(commits, [], archSnapshots);
          console.log(`[ingest] Built ${timeline.length} timeline events in ${((Date.now() - t2) / 1000).toFixed(1)}s`);

          // Attach archBefore/archAfter to each event by matching nearest snapshot
          const sorted = [...archSnapshots].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );
          for (const evt of timeline) {
            const evtMs = new Date(evt.date).getTime();
            let bestIdx = 0;
            let bestDelta = Infinity;
            for (let i = 0; i < sorted.length; i++) {
              const d = Math.abs(new Date(sorted[i].date).getTime() - evtMs);
              if (d < bestDelta) { bestDelta = d; bestIdx = i; }
            }
            evt.archAfter = sorted[bestIdx];
            if (bestIdx > 0) evt.archBefore = sorted[bestIdx - 1];
          }
        } catch (err) {
          console.warn(`[ingest] buildTimelineWithAI failed after ${((Date.now() - t2) / 1000).toFixed(1)}s:`, err);
        }

        send({ type: 'progress', message: 'Storing memories in HydraDB...', pct: 80 });
        const t3 = Date.now();
        try {
          await storeRepoMemories(subTenantId, commits, [], archSnapshots);
          console.log(`[ingest] HydraDB storage done in ${((Date.now() - t3) / 1000).toFixed(1)}s`);
        } catch (err) {
          console.warn(`[ingest] HydraDB storage failed after ${((Date.now() - t3) / 1000).toFixed(1)}s:`, err);
        }

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
