const PIPESHIFT_URL = 'https://api.pipeshift.com/api/v0/chat/completions';
const PIPESHIFT_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

interface ChatMessage {
  role: string;
  content: string;
}

async function pipeshiftFetch(
  messages: ChatMessage[],
  stream: boolean
): Promise<Response> {
  const res = await fetch(PIPESHIFT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PIPESHIFT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PIPESHIFT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 8192,
      stream,
    }),
  });
  return res;
}

export async function pipeshiftChat(
  messages: ChatMessage[],
  stream = false
): Promise<Response> {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await pipeshiftFetch(messages, stream);
    if (res.ok) return res;
    if (res.status >= 500 && attempt < maxRetries) {
      console.warn(`[pipeshift] ${res.status} on attempt ${attempt + 1}, retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    throw new Error(`Pipeshift ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error('Pipeshift: exhausted retries');
}

export async function pipeshiftComplete(
  messages: ChatMessage[]
): Promise<string> {
  const res = await pipeshiftChat(messages, false);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    console.error('[pipeshift] Unexpected response shape:', JSON.stringify(data).slice(0, 500));
    throw new Error('Pipeshift returned empty content');
  }
  return content;
}
