import { pipeshiftChat } from '@/lib/pipeshift';
import type { ArchitectureSnapshot, CommitSnapshot, PullRequest, TimelineEvent } from '@/types';

async function collectStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) result += content;
      } catch {
        // skip malformed line
      }
    }
  }

  return result;
}

export async function buildTimelineWithAI(
  commits: CommitSnapshot[],
  prs: PullRequest[],
  archSnapshots: ArchitectureSnapshot[]
): Promise<TimelineEvent[]> {
  const messages = [
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
${commits
  .slice(0, 50)
  .map(
    (c) =>
      `${c.sha.slice(0, 7)} ${c.date}: ${c.message} (+${c.additions}/-${c.deletions}) files: ${c.filesChanged.slice(0, 5).join(', ')}`
  )
  .join('\n')}

PULL REQUESTS (merged):
${
  prs.length > 0
    ? prs
        .slice(0, 50)
        .map((pr) => `#${pr.number} "${pr.title}" ${pr.mergedAt}: ${pr.body.slice(0, 200)}`)
        .join('\n')
    : '(none available)'
}

ARCHITECTURE SNAPSHOTS:
${archSnapshots
  .map(
    (s) =>
      `${s.date}: dirs=[${s.directories.slice(0, 10).join(',')}] deps=${Object.keys(s.packageJson?.dependencies || {}).join(',')}`
  )
  .join('\n')}

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
  ];

  const upstream = await pipeshiftChat(messages, true);
  const content = await collectStream(upstream);

  if (!content) {
    console.error('[buildTimelineWithAI] Empty response from streaming');
    throw new Error('buildTimelineWithAI: empty response');
  }

  const clean = content.replace(/^```json\n?|```$/gm, '').trim();
  try {
    return JSON.parse(clean) as TimelineEvent[];
  } catch (err) {
    console.error('[buildTimelineWithAI] JSON parse failed. Raw:', clean.slice(0, 500));
    throw err;
  }
}
