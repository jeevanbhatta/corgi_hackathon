const PIPESHIFT_URL = 'https://api.pipeshift.com/api/v0/chat/completions';
const PIPESHIFT_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

interface ChatMessage {
  role: string;
  content: string;
}

export async function pipeshiftChat(
  messages: ChatMessage[],
  stream = false
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
      stream,
    }),
  });
  if (!res.ok) throw new Error(`Pipeshift ${res.status}: ${await res.text()}`);
  return res;
}

export async function pipeshiftComplete(
  messages: ChatMessage[]
): Promise<string> {
  const res = await pipeshiftChat(messages, false);
  const data = await res.json();
  return data.choices[0].message.content as string;
}
