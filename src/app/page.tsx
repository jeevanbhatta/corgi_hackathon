'use client';

import { useState } from 'react';
import URLInput from '@/components/URLInput';
import IngestionProgress from '@/components/IngestionProgress';
import Timeline from '@/components/Timeline';
import ChatPanel from '@/components/ChatPanel';
import { mockRepoMeta, mockTimelineEvents } from '@/lib/mock-data';
import type { Message } from '@/types';

export default function Home() {
  const [phase, setPhase] = useState<'input' | 'loading' | 'timeline'>('input');
  const [progress, setProgress] = useState({ message: '', pct: 0 });
  const [repoId, setRepoId] = useState('');
  const [highlightedShas, setHighlightedShas] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleURLSubmit = (_url: string, owner: string, repo: string) => {
    setRepoId(`${owner}/${repo}`);
    setPhase('loading');

    let pct = 0;
    const stages = [
      'Cloning repository...',
      'Extracting commits...',
      'Building timeline...',
      'Finalizing...',
    ];

    setProgress({ message: stages[0], pct: 0 });

    const interval = setInterval(() => {
      pct += 12;
      if (pct >= 100) {
        clearInterval(interval);
        setPhase('timeline');
      } else {
        const stageIndex = Math.min(Math.floor(pct / 25), stages.length - 1);
        setProgress({ message: stages[stageIndex], pct });
      }
    }, 400);
  };

  const handleSendMessage = (content: string) => {
    const userMsg: Message = { role: 'user', content };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    setTimeout(() => {
      const assistantMsg: Message = {
        role: 'assistant',
        content: `I found some relevant history regarding your question: "${content}". I've highlighted the crucial commits on your timeline.`,
      };
      setChatHistory((prev) => [...prev, assistantMsg]);
      setIsChatLoading(false);
      setHighlightedShas(['mock-sha-123']);
    }, 1500);
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
              events={mockTimelineEvents}
              repoMeta={mockRepoMeta}
              highlightedShas={highlightedShas}
              onAskAboutEvent={(event) => setHighlightedShas([event.commitSha])}
            />
            <div className="mt-8 text-zinc-500 text-sm">
              Highlighted SHAs (Mocked): {highlightedShas.join(', ')}
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
