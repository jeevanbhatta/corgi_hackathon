import type { ArchitectureSnapshot, CommitSnapshot, PullRequest } from '@/types';

/**
 * HydraDB REST API — see https://docs.hydradb.com/quickstart
 * Base URL and Bearer auth match the official docs.
 */
const BASE = 'https://api.hydradb.com';

/** User memories: https://docs.hydradb.com/api-reference/endpoint/add-memories */
const ADD_MEMORY_PATH = '/memories/add_memory';

/**
 * Memory (user) recall — https://docs.hydradb.com/api-reference/endpoint/recall-preferences
 * Use this for content ingested via add_memory. full_recall is for knowledge / uploaded files only.
 */
const RECALL_PREFERENCES_PATH = '/recall/recall_preferences';

function headers() {
  const key = process.env.HYDRADB_API_KEY;
  const tenant = process.env.HYDRADB_TENANT_ID;
  if (!key) throw new Error('HYDRADB_API_KEY is not set');
  if (!tenant) throw new Error('HYDRADB_TENANT_ID is not set');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

export type HydraRecallChunk = {
  chunk_uuid: string;
  chunk_content: string;
  source_title: string | null;
  relevancy_score: number;
};

export type HydraRecallResult = {
  chunks: HydraRecallChunk[];
  graph_context: object;
};

export async function storeRepoMemories(
  subTenantId: string,
  commits: CommitSnapshot[],
  prs: PullRequest[],
  archSnapshots: ArchitectureSnapshot[]
) {
  const tenant_id = process.env.HYDRADB_TENANT_ID!;

  const memories = [
    ...commits.map((c) => ({
      title: `Commit ${c.sha.slice(0, 7)}`,
      text: `COMMIT ${c.sha.slice(0, 7)} | ${c.date} | ${c.author}
Message: ${c.message}
Changes: +${c.additions} -${c.deletions}
Files: ${c.filesChanged.join(', ')}`,
      infer: false as const,
    })),
    ...prs.map((pr) => ({
      title: `PR #${pr.number}`,
      text: `PULL REQUEST #${pr.number} | merged ${pr.mergedAt}
Title: ${pr.title}
Labels: ${pr.labels.join(', ')}
Description: ${pr.body.slice(0, 500)}`,
      infer: false as const,
    })),
    ...archSnapshots.map((s) => ({
      title: `Architecture ${s.commitSha.slice(0, 7)}`,
      text: `ARCHITECTURE SNAPSHOT | ${s.date} | commit ${s.commitSha.slice(0, 7)}
Directories: ${s.directories.join(', ')}
Dependencies: ${JSON.stringify(s.packageJson?.dependencies ?? {})}
Entry points: ${s.entryPoints.join(', ')}`,
      infer: false as const,
    })),
  ];

  const BATCH = 50;
  for (let i = 0; i < memories.length; i += BATCH) {
    const batch = memories.slice(i, i + BATCH);
    const res = await fetch(`${BASE}${ADD_MEMORY_PATH}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        tenant_id,
        sub_tenant_id: subTenantId,
        memories: batch,
        upsert: true,
      }),
    });
    if (!res.ok) throw new Error(`HydraDB add_memory failed: ${await res.text()}`);
  }
}

/**
 * Hybrid search over user memories for this repo (sub_tenant_id).
 * Request shape matches RecallSearchRequest in the OpenAPI spec (same as full_recall, different path).
 */
export async function recallForQuery(
  subTenantId: string,
  query: string,
  options?: { maxResults?: number; mode?: 'fast' | 'thinking' }
): Promise<HydraRecallResult> {
  const tenant_id = process.env.HYDRADB_TENANT_ID!;
  const max_results = options?.maxResults ?? 15;
  const mode = options?.mode ?? 'fast';

  const res = await fetch(`${BASE}${RECALL_PREFERENCES_PATH}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      tenant_id,
      sub_tenant_id: subTenantId,
      query,
      max_results,
      mode,
      alpha: 0.8,
      graph_context: true,
    }),
  });
  if (!res.ok) throw new Error(`HydraDB recall_preferences failed: ${await res.text()}`);
  const data = (await res.json()) as HydraRecallResult;
  return data;
}
