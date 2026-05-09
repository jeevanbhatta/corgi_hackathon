'use client';

import { useState } from 'react';
import URLInput from '@/components/URLInput';
import IngestionProgress from '@/components/IngestionProgress';
import Timeline from '@/components/Timeline';
import ChatPanel from '@/components/ChatPanel';
import { TimelineEvent } from '@/types';
import { mockRepoMeta, mockTimelineEvents } from '@/lib/mock-data';

export default function Home() {
  const [phase] = useState<'input' | 'loading' | 'timeline'>('timeline');
  const [timeline] = useState<TimelineEvent[]>(mockTimelineEvents);
  const [highlightedShas, setHighlightedShas] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {phase === 'input' && <URLInput />}
      {phase === 'loading' && <IngestionProgress />}
      {phase === 'timeline' && (
        <div className="flex min-h-screen">
          <div className="min-w-0 flex-1">
            <Timeline
              events={timeline}
              highlightedShas={highlightedShas}
              repoMeta={mockRepoMeta}
              onAskAboutEvent={(event) => setHighlightedShas([event.commitSha])}
            />
          </div>
          <div className="hidden w-[380px] border-l border-zinc-800 bg-zinc-950 lg:block">
            <ChatPanel />
          </div>
        </div>
      )}
    </div>
  );
}
