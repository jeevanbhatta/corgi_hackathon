'use client';

import { useState } from 'react';
import Timeline from '@/components/Timeline';
import { mockRepoMeta, mockTimelineEvents } from '@/lib/mock-data';

export default function Home() {
  const [highlightedShas, setHighlightedShas] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Timeline
        events={mockTimelineEvents}
        repoMeta={mockRepoMeta}
        highlightedShas={highlightedShas}
        onAskAboutEvent={(event) => setHighlightedShas([event.commitSha])}
      />
    </div>
  );
}
