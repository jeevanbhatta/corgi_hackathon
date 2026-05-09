'use client';

import { useState } from 'react';
import URLInput from '@/components/URLInput';
import IngestionProgress from '@/components/IngestionProgress';
import Timeline from '@/components/Timeline';
import ChatPanel from '@/components/ChatPanel';
import type { TimelineEvent, Message, RepositoryMeta } from '@/types';

export default function Home() {
  const [phase, setPhase] = useState<'input' | 'loading' | 'timeline'>('input');
  const [progress, setProgress] = useState({ message: '', pct: 0 });
  const [repoId, setRepoId] = useState('');
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [repoMeta, setRepoMeta] = useState<RepositoryMeta | undefined>();
  const [highlightedShas, setHighlightedShas] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleURLSubmit = async (url: string, owner: string, repo: string) => {
    setRepoId(`${owner}/${repo}`);
    setPhase('loading');
    setProgress({ message: 'Starting ingestion...', pct: 0 });

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }), // maxCommits could be passed here
      });

      if (!res.body) throw new Error('No body returned from API');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'progress') {
              setProgress({ message: data.message, pct: data.pct || 0 });
            } else if (data.type === 'done') {
              setTimelineEvents(data.timeline || []);
              setRepoMeta({
                name: repo,
                fullName: `${owner}/${repo}`,
                indexedAt: new Date().toISOString(),
                // Mock stars and language for now if API doesn't provide them yet
                stars: 0,
                language: 'Mixed',
              });
              setPhase('timeline');
            } else if (data.type === 'error') {
              setProgress({ message: `Error: ${data.message}`, pct: 0 });
              console.error('Ingest error:', data.message);
            }
          } catch (e) {
            // Ignore malformed JSON chunks
          }
        }
      }
    } catch (err) {
      console.error(err);
      setProgress({ message: 'Failed to connect to ingestion server.', pct: 0 });
      setTimeout(() => setPhase('input'), 3000);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMsg: Message = { role: 'user', content };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId,
          question: content,
          conversationHistory: chatHistory,
        }),
      });

      if (!res.body) throw new Error('No body returned');

      // Add a placeholder message for the assistant output
      setChatHistory((prev) => [...prev, { role: 'assistant', content: '' }]);
      setIsChatLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        setChatHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = assistantContent;
          return updated;
        });
      }

      // 1. Attempt to extract the trailing JSON block requested in query route prompt
      const jsonMatch = assistantContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.highlightShas && Array.isArray(parsed.highlightShas)) {
            setHighlightedShas(parsed.highlightShas);
          }
          
          // Optionally hidden from the user by updating the final message to strip the json
          const cleanedContent = assistantContent.replace(/```json\s*\{[\s\S]*?\}\s*```/, '').trim();
          setChatHistory((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].content = cleanedContent;
            return updated;
          });
        } catch (e) {
          // JSON parse failed
        }
      }
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: 'An error occurred while fetching the response.' }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col pt-12 px-8">
      {phase === 'input' && (
        <div className="flex flex-col items-center justify-center flex-1">
          <URLInput onSubmit={handleURLSubmit} />
        </div>
      )}

      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center flex-1">
          <IngestionProgress progress={progress.pct} status={progress.message} />
        </div>
      )}

      {phase === 'timeline' && (
        <div className="flex flex-1 gap-6 w-full max-w-[1600px] mx-auto h-[calc(100vh-6rem)]">
          <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 p-6 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{repoId} Timeline</h2>
            <Timeline
              events={timelineEvents}
              repoMeta={repoMeta}
              highlightedShas={highlightedShas}
              onAskAboutEvent={(event) => setHighlightedShas([event.commitSha])}
            />
            <div className="mt-8 text-zinc-500 text-sm">
              Highlighted SHAs: {highlightedShas.join(', ')}
            </div>
          </div>

          <div className="w-[450px]">
            <ChatPanel
              messages={chatHistory}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
