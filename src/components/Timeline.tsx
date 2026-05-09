'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ArchStage from '@/components/ArchStage';
import HistoryList from '@/components/HistoryList';
import TimelineScrubber from '@/components/TimelineScrubber';
import { buildArchFrames } from '@/lib/arch-frames';
import type { RepositoryMeta, TimelineEvent } from '@/types';

type ScrubState = {
  highlightKey: string;
  userIndex: number | null;
};

type TimelineProps = {
  events?: TimelineEvent[];
  highlightedShas?: string[];
  repoMeta?: RepositoryMeta;
  onAskAboutEvent?: (event: TimelineEvent) => void;
};

function compactNumber(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
}

function formatIndexedAt(value?: string) {
  if (!value) return 'Not indexed yet';
  return `Indexed ${new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`;
}

function shaMatches(target: string, candidates: string[]) {
  const normalized = target.toLowerCase();
  return candidates.some((candidate) => {
    const c = candidate.toLowerCase();
    return normalized === c || normalized.startsWith(c) || c.startsWith(normalized);
  });
}

export default function Timeline({
  events = [],
  highlightedShas = [],
  repoMeta,
  onAskAboutEvent,
}: TimelineProps) {
  const frames = useMemo(() => buildArchFrames(events), [events]);
  const highlightedIndices = useMemo(
    () =>
      frames
        .map((frame, index) => (shaMatches(frame.event.commitSha, highlightedShas) ? index : -1))
        .filter((index) => index !== -1),
    [frames, highlightedShas],
  );

  const highlightKey = highlightedShas.join('|');
  const [scrub, setScrub] = useState<ScrubState>({ highlightKey, userIndex: null });

  // React-recommended pattern: adjust state during render when an external
  // prop key changes, instead of using an effect to sync.
  if (scrub.highlightKey !== highlightKey) {
    setScrub({ highlightKey, userIndex: null });
  }

  const lastIndex = Math.max(0, frames.length - 1);
  const fallbackIndex =
    scrub.userIndex === null && highlightedIndices.length > 0
      ? highlightedIndices[0]
      : lastIndex;
  const desiredIndex = scrub.userIndex ?? fallbackIndex;
  const activeIndex = Math.min(Math.max(0, desiredIndex), lastIndex);

  const setActiveIndex = useCallback(
    (next: number | ((prev: number) => number)) => {
      setScrub((prev) => {
        const baseIndex = prev.userIndex ?? Math.max(0, frames.length - 1);
        const value = typeof next === 'function' ? next(baseIndex) : next;
        return {
          highlightKey: prev.highlightKey,
          userIndex: Math.min(Math.max(0, value), Math.max(0, frames.length - 1)),
        };
      });
    },
    [frames.length],
  );

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setActiveIndex((current) => Math.min(frames.length - 1, current + 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setActiveIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'Home') {
        setActiveIndex(0);
      } else if (event.key === 'End') {
        setActiveIndex(frames.length - 1);
      }
    },
    [frames.length, setActiveIndex],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (frames.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20">
        <p className="eyebrow">Repo Time Machine</p>
        <h1 className="mt-3 text-3xl font-medium text-ink">No events to scrub through yet.</h1>
        <p className="mt-4 max-w-prose text-sm text-ink-muted">
          Once ingestion is wired in, paste a repository URL and the timeline will populate. While
          waiting, mount this component with mock <code className="font-mono">TimelineEvent[]</code>{' '}
          to keep building.
        </p>
      </main>
    );
  }

  const activeFrame = frames[activeIndex];
  const isActiveHighlighted = highlightedIndices.includes(activeIndex);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-32 pt-12 sm:px-10">
      <header className="grid gap-10 border-b border-rule pb-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <p className="eyebrow">01 / Repo Time Machine</p>
          <h1 className="mt-4 text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {repoMeta?.fullName ?? repoMeta?.name ?? 'Repository timeline'}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted">
            Scrub through commits, pull requests, and architectural shifts. Watch the directory
            tree and dependency graph morph one frame at a time.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint">
            {formatIndexedAt(repoMeta?.indexedAt)}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-px bg-rule text-left">
          <Meta label="Stars" value={compactNumber(repoMeta?.stars)} />
          <Meta label="Language" value={repoMeta?.language ?? 'Mixed'} />
          <Meta label="Events" value={String(frames.length).padStart(2, '0')} />
        </dl>
      </header>

      <div className="mt-16 space-y-20">
        <TimelineScrubber
          frames={frames}
          activeIndex={activeIndex}
          highlightedIndices={highlightedIndices}
          onChange={setActiveIndex}
        />

        <ArchStage
          frame={activeFrame}
          isHighlighted={isActiveHighlighted}
          onAskAboutEvent={onAskAboutEvent}
        />

        <HistoryList
          frames={frames}
          activeIndex={activeIndex}
          highlightedIndices={highlightedIndices}
          onSelect={setActiveIndex}
        />
      </div>

      <footer className="mt-24 flex items-center justify-between border-t border-rule pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        <span>← → keys scrub through frames</span>
        <span>{repoMeta?.fullName ?? 'Repo Time Machine'}</span>
      </footer>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-mono text-base text-ink">{value}</dd>
    </div>
  );
}
