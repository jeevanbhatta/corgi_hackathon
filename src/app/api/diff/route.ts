import { diffArchitectureSnapshots } from '@/lib/arch-diff';
import { resolveNearestArchitectureSnapshot } from '@/lib/resolve-arch-snapshot';
import { repoIndex } from '@/lib/store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get('repo');
  const beforeSha = searchParams.get('before');
  const afterSha = searchParams.get('after');

  if (!repoId || !beforeSha || !afterSha) {
    return new Response(
      JSON.stringify({ error: 'Query params repo, before, and after are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const index = [...repoIndex.values()].find((r) => r.repoId === repoId);
  if (!index) {
    return new Response(JSON.stringify({ error: 'Repo not indexed' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (index.archSnapshots.length === 0) {
    return new Response(JSON.stringify({ error: 'No architecture snapshots for this repo' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [beforeSnap, afterSnap] = await Promise.all([
      resolveNearestArchitectureSnapshot(
        index.archSnapshots,
        beforeSha,
        index.owner,
        index.repo
      ),
      resolveNearestArchitectureSnapshot(
        index.archSnapshots,
        afterSha,
        index.owner,
        index.repo
      ),
    ]);

    const diff = diffArchitectureSnapshots(beforeSnap, afterSnap);
    return Response.json(diff);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Diff failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
