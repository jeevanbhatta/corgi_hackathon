import type { ArchitectureSnapshot, CommitSnapshot, PullRequest } from '@/types';

const BASE = 'https://api.hydradb.com';

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

export async function storeRepoMemories(
  subTenantId: string,
  commits: CommitSnapshot[],
  prs: PullRequest[],
  archSnapshots: ArchitectureSnapshot[]
) {
  const tenant_id = process.env.HYDRADB_TENANT_ID!;

  const memories = [
    ...commits.map((c) => ({
      text: `COMMIT ${c.sha.slice(0, 7)} | ${c.date} | ${c.author}
Message: ${c.message}
Changes: +${c.additions} -${c.deletions}
Files: ${c.filesChanged.join(', ')}`,
      infer: false,
    })),
    ...prs.map((pr) => ({
      text: `PULL REQUEST #${pr.number} | merged ${pr.mergedAt}
Title: ${pr.title}
Labels: ${pr.labels.join(', ')}
Description: ${pr.body.slice(0, 500)}`,
      infer: false,
    })),
    ...archSnapshots.map((s) => ({
      text: `ARCHITECTURE SNAPSHOT | ${s.date} | commit ${s.commitSha.slice(0, 7)}
Directories: ${s.directories.join(', ')}
Dependencies: ${JSON.stringify(s.packageJson?.dependencies ?? {})}
Entry points: ${s.entryPoints.join(', ')}`,
      infer: false,
    })),
  ];

  const BATCH = 50;
  for (let i = 0; i < memories.length; i += BATCH) {
    const batch = memories.slice(i, i + BATCH);
    const res = await fetch(`${BASE}/memories/add_memory`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        tenant_id,
        sub_tenant_id: subTenantId,
        memories: batch,
      }),
    });
    if (!res.ok) throw new Error(`HydraDB add_memory failed: ${await res.text()}`);
  }
}

export async function recallForQuery(subTenantId: string, query: string) {
  const tenant_id = process.env.HYDRADB_TENANT_ID!;
  const res = await fetch(`${BASE}/recall/recall_preferences`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      tenant_id,
      sub_tenant_id: subTenantId,
      query,
      max_results: 15,
      graph_context: true,
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
