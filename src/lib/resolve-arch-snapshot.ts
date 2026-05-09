import type { ArchitectureSnapshot } from '@/types';
import { getCommitAuthorDate } from '@/lib/github';

function shaMatches(snapshotSha: string, query: string): boolean {
  const s = snapshotSha.toLowerCase();
  const q = query.toLowerCase();
  return s === q || s.startsWith(q);
}

/**
 * Exact snapshot match on SHA first; otherwise the snapshot whose date is closest
 * to the given commit's author date (resolved via GitHub).
 */
export async function resolveNearestArchitectureSnapshot(
  snapshots: ArchitectureSnapshot[],
  sha: string,
  owner: string,
  repo: string
): Promise<ArchitectureSnapshot> {
  if (snapshots.length === 0) {
    throw new Error('No architecture snapshots for this repo');
  }

  const exact = snapshots.find((s) => shaMatches(s.commitSha, sha));
  if (exact) return exact;

  const targetDate = await getCommitAuthorDate(owner, repo, sha);
  const targetMs = Date.parse(targetDate);
  if (!Number.isFinite(targetMs)) {
    return snapshots[0];
  }

  let best = snapshots[0];
  let bestDelta = Infinity;
  for (const s of snapshots) {
    const ms = Date.parse(s.date);
    const d = Number.isFinite(ms) ? Math.abs(ms - targetMs) : Infinity;
    if (d < bestDelta) {
      bestDelta = d;
      best = s;
    }
  }
  return best;
}
