'use client';

import { useEffect, useRef } from 'react';
import type { ArchFrame } from '@/lib/arch-frames';
import type { TimelineEvent } from '@/types';

type HistoryListProps = {
  frames: ArchFrame[];
  activeIndex: number;
  highlightedIndices?: number[];
  onSelect: (index: number) => void;
};

const significanceDot: Record<TimelineEvent['significance'], string> = {
  1: 'bg-ink-faint',
  2: 'bg-changed',
  3: 'bg-accent',
};

const significanceCopy: Record<TimelineEvent['significance'], string> = {
  1: 'Minor',
  2: 'Notable',
  3: 'Major',
};

const eventTypeCopy: Record<TimelineEvent['type'], string> = {
  commit: 'commit',
  pr_merge: 'pr',
  dep_change: 'dep',
  arch_shift: 'arch',
};

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function formatShort(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function HistoryList({
  frames,
  activeIndex,
  highlightedIndices = [],
  onSelect,
}: HistoryListProps) {
  const activeRef = useRef<HTMLLIElement | null>(null);
  const highlightSet = new Set(highlightedIndices);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeIndex]);

  const ordered = [...frames].sort(
    (a, b) => new Date(b.event.date).getTime() - new Date(a.event.date).getTime(),
  );

  return (
    <section aria-labelledby="history-title" className="space-y-6">
      <div className="flex items-end justify-between gap-6 border-b border-rule pb-4">
        <div>
          <p className="eyebrow">04 / Full history</p>
          <h2 id="history-title" className="mt-1 text-lg font-medium text-ink">
            Every event, oldest at the bottom.
          </h2>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          {frames.length} events
        </p>
      </div>

      <ol className="divide-y divide-rule">
        {ordered.map((frame) => {
          const isActive = frame.index === activeIndex;
          const isHighlighted = highlightSet.has(frame.index);
          return (
            <li
              key={frame.event.id}
              ref={isActive ? activeRef : undefined}
              className={`grid grid-cols-[auto_5.5rem_minmax(0,1fr)_auto] items-start gap-4 py-4 transition ${
                isActive ? 'bg-paper-elev/60' : ''
              }`}
            >
              <span
                className={`mt-2 block h-2 w-2 rounded-full ${significanceDot[frame.event.significance]} ${
                  isHighlighted ? 'ring-2 ring-accent/60' : ''
                }`}
                aria-hidden
              />

              <button
                type="button"
                onClick={() => onSelect(frame.index)}
                className="group min-w-0 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint transition hover:text-ink"
                aria-label={`View ${frame.event.title}`}
              >
                {formatShort(frame.event.date)}
              </button>

              <button
                type="button"
                onClick={() => onSelect(frame.index)}
                className="group min-w-0 text-left"
              >
                <p className="text-sm font-medium text-ink group-hover:text-accent">
                  {frame.event.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">
                  {frame.event.description}
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  {eventTypeCopy[frame.event.type]} · {shortSha(frame.event.commitSha)} ·{' '}
                  {frame.event.filesChanged.length} files
                  {frame.depChangeCount > 0 && ` · ${frame.depChangeCount} dep moves`}
                  {frame.addedDirCount + frame.removedDirCount > 0 &&
                    ` · ${frame.addedDirCount + frame.removedDirCount} folder shifts`}
                </p>
              </button>

              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                {significanceCopy[frame.event.significance]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
