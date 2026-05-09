'use client';

import { useState } from 'react';
import URLInput from '@/components/URLInput';
import IngestionProgress from '@/components/IngestionProgress';
import Timeline from '@/components/Timeline';
import ChatPanel from '@/components/ChatPanel';
import { TimelineEvent, Message } from '@/types';

export default function Home() {
  const [phase, setPhase] = useState<'input' | 'loading' | 'timeline'>('input');
  const [progress, setProgress] = useState({ message: '', pct: 0 });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [repoId, setRepoId] = useState('');
  const [highlightedShas, setHighlightedShas] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {phase === 'input' && <URLInput />}
      {phase === 'loading' && <IngestionProgress />}
      {phase === 'timeline' && (
        <div className="flex">
          <div className="flex-1">
            <Timeline />
          </div>
          <div className="w-[380px] border-l border-zinc-800">
            <ChatPanel />
          </div>
        </div>
      )}
    </div>
  );
}
