import { recallForQuery } from '@/lib/hydra';
import { pipeshiftChat } from '@/lib/pipeshift';
import { repoIndex } from '@/lib/store';
import type { Message } from '@/types';

export async function POST(req: Request) {
  let body: { repoId?: string; question?: string; conversationHistory?: Message[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { repoId, question, conversationHistory = [] } = body;
  if (!repoId || !question) {
    return Response.json({ error: 'repoId and question are required' }, { status: 400 });
  }

  const index = [...repoIndex.values()].find((r) => r.repoId === repoId);
  if (!index) {
    return Response.json({ error: 'Repo not indexed' }, { status: 404 });
  }

  let contextBlock: string;
  try {
    const recalled = await recallForQuery(index.repoId, question);
    console.log(`[query] HydraDB returned ${recalled.chunks.length} chunks for "${question}"`);
    contextBlock = recalled.chunks
      .map(
        (c) =>
          `[${c.source_title} | score: ${c.relevancy_score.toFixed(2)}]\n${c.chunk_content}`
      )
      .join('\n\n---\n\n');
  } catch (err) {
    console.warn('[query] HydraDB recall failed, using timeline fallback:', err);
    contextBlock = index.timeline
      .map(
        (evt) =>
          `TIMELINE EVENT | ${evt.date} | ${evt.type} | significance ${evt.significance}\n` +
          `${evt.commitSha.slice(0, 7)}: ${evt.title}\n` +
          `${evt.description}\n` +
          `Files: ${evt.filesChanged.join(', ')}`
      )
      .join('\n\n---\n\n');
  }

  const systemPrompt = `You are an expert software archaeologist.
Answer questions about WHY the codebase changed, not just what changed.
Cite specific commits by their 7-char SHA when relevant.

Always end your response with a fenced \`\`\`json block:
{
  "highlightShas": ["abc1234"],
  "archDiff": { "beforeSha": "...", "afterSha": "..." } | null,
  "timelineRange": { "start": "ISO", "end": "ISO" } | null
}

RETRIEVED CONTEXT (most relevant chunks from repo history):
${contextBlock}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  let upstream: Response;
  try {
    upstream = await pipeshiftChat(messages, true);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'AI service unavailable' },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = '';

      try {
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
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            } catch {
              // malformed SSE line — skip
            }
          }
        }

        if (buffer.trim().startsWith('data: ')) {
          const payload = buffer.trim().slice(6);
          if (payload !== '[DONE]') {
            try {
              const parsed = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) controller.enqueue(encoder.encode(content));
            } catch {
              // skip
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
