const DEFAULT_LIMIT = 50;
const DEFAULT_MAX = 100;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Upper bound for any ingest (env default + request overrides). */
export function ingestCommitLimitMax(): number {
  return parsePositiveInt(process.env.INGEST_COMMIT_LIMIT_MAX, DEFAULT_MAX);
}

/** Default commit depth when the client does not pass `maxCommits`. */
export function ingestCommitLimitDefault(): number {
  const max = ingestCommitLimitMax();
  const fromEnv = parsePositiveInt(process.env.INGEST_COMMIT_LIMIT, DEFAULT_LIMIT);
  return Math.min(fromEnv, max);
}

/**
 * Resolves how many recent commits to ingest.
 * Optional `maxCommits` from the request is clamped to [1, INGEST_COMMIT_LIMIT_MAX].
 */
export function resolveIngestCommitLimit(requestMaxCommits?: unknown): number {
  const cap = ingestCommitLimitMax();
  const base = ingestCommitLimitDefault();

  if (requestMaxCommits == null) return base;

  const n =
    typeof requestMaxCommits === 'number'
      ? requestMaxCommits
      : Number.parseInt(String(requestMaxCommits), 10);

  if (!Number.isFinite(n) || n <= 0) return base;

  return Math.min(Math.max(1, Math.floor(n)), cap);
}
