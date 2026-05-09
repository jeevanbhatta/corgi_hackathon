'use client';

import { useEffect, useMemo, useRef } from 'react';
import CommitHighlight from '@/components/CommitHighlight';
import TimelineEvent from '@/components/TimelineEvent';
import type { RepositoryMeta, TimelineEvent as TimelineEventType } from '@/types';

type TimelineProps = {
  events?: TimelineEventType[];
  highlightedShas?: string[];
  repoMeta?: RepositoryMeta;
  onAskAboutEvent?: (event: TimelineEventType) => void;
};

const dotStyles: Record<TimelineEventType['significance'], string> = {
  1: 'border-zinc-500 bg-zinc-700',
  2: 'border-amber-200 bg-amber-400',
  3: 'border-rose-200 bg-rose-500',
};

function shortNumber(value?: number) {
  if (value === undefined) return 'Unknown';
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

function shaMatches(sha: string, highlightedShas: string[]) {
  const normalizedSha = sha.toLowerCase();

  return highlightedShas.some((highlight) => {
    const normalizedHighlight = highlight.toLowerCase();
    return normalizedSha === normalizedHighlight || normalizedSha.startsWith(normalizedHighlight);
  });
}

export default function Timeline({ events = [], highlightedShas = [], repoMeta, onAskAboutEvent }: TimelineProps) {
  const firstHighlightedRef = useRef<HTMLDivElement | null>(null);
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );
  const highlightedSetKey = highlightedShas.join('|');
  const firstHighlightedId = useMemo(
    () => sortedEvents.find((event) => shaMatches(event.commitSha, highlightedShas))?.id,
    [highlightedShas, sortedEvents],
  );

  useEffect(() => {
    if (highlightedSetKey && firstHighlightedRef.current) {
      firstHighlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedSetKey]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">Repo Time Machine</p>
              <h1 className="text-3xl font-semibold tracking-normal text-zinc-50">
                {repoMeta?.fullName ?? repoMeta?.name ?? 'Repository timeline'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Architectural milestones, dependency shifts, and commit evidence in one scrollable history.
              </p>
            </div>

            <div className="grid min-w-64 grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <p className="text-xs text-zinc-500">Stars</p>
                <p className="text-sm font-semibold text-zinc-100">{shortNumber(repoMeta?.stars)}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <p className="text-xs text-zinc-500">Language</p>
                <p className="truncate text-sm font-semibold text-zinc-100">{repoMeta?.language ?? 'Mixed'}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <p className="text-xs text-zinc-500">Events</p>
                <p className="text-sm font-semibold text-zinc-100">{sortedEvents.length}</p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-zinc-500">{formatIndexedAt(repoMeta?.indexedAt)}</p>
        </header>

        {sortedEvents.length === 0 ? (
          <section className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <h2 className="text-lg font-semibold text-zinc-100">No timeline events yet</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Paste a repository URL once ingestion is connected, or pass mock TimelineEvent data while building the UI.
            </p>
          </section>
        ) : (
          <section className="relative">
            <div className="absolute bottom-0 left-4 top-0 w-px bg-zinc-800 sm:left-[6.25rem]" aria-hidden="true" />

            <div className="space-y-6">
              {sortedEvents.map((event) => {
                const isHighlighted = shaMatches(event.commitSha, highlightedShas);

                return (
                  <div
                    key={event.id}
                    ref={event.id === firstHighlightedId ? firstHighlightedRef : undefined}
                    className="relative grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]"
                  >
                    <div className="hidden pt-4 text-right text-xs font-medium text-zinc-500 sm:block">
                      {new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(event.date))}
                    </div>

                    <div className="relative pl-10 sm:pl-0">
                      <div className="absolute left-0 top-5 sm:-left-[2.03rem]">
                        <CommitHighlight active={isHighlighted}>
                          <span
                            className={`block size-4 rounded-full border-2 shadow-lg shadow-black/40 ${dotStyles[event.significance]}`}
                          />
                        </CommitHighlight>
                      </div>
                      <TimelineEvent
                        event={event}
                        isHighlighted={isHighlighted}
                        defaultExpanded={isHighlighted}
                        onAskAboutEvent={onAskAboutEvent}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
