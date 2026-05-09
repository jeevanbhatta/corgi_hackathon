'use client';

import { useState } from 'react';
import ArchDiff from '@/components/ArchDiff';
import type { TimelineEvent as TimelineEventType } from '@/types';

type TimelineEventProps = {
  event: TimelineEventType;
  isHighlighted?: boolean;
  defaultExpanded?: boolean;
  onAskAboutEvent?: (event: TimelineEventType) => void;
};

const eventTypeLabels: Record<TimelineEventType['type'], string> = {
  commit: 'Commit',
  pr_merge: 'PR merge',
  dep_change: 'Dependency',
  arch_shift: 'Architecture',
};

const significanceCopy: Record<TimelineEventType['significance'], string> = {
  1: 'Minor',
  2: 'Notable',
  3: 'Major',
};

const significanceStyles: Record<TimelineEventType['significance'], string> = {
  1: 'border-zinc-700 bg-zinc-800 text-zinc-200',
  2: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  3: 'border-rose-300/40 bg-rose-400/15 text-rose-100',
};

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function TimelineEvent({
  event,
  isHighlighted = false,
  defaultExpanded = false,
  onAskAboutEvent,
}: TimelineEventProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasArchDiff = Boolean(event.archBefore && event.archAfter);
  const visibleExpanded = expanded || isHighlighted;

  return (
    <article
      className={`rounded-lg border bg-zinc-950/90 p-4 shadow-lg shadow-black/20 transition duration-300 ${
        isHighlighted
          ? 'border-cyan-300/70 ring-2 ring-cyan-300/40 shadow-cyan-500/20'
          : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="block w-full text-left"
        aria-expanded={visibleExpanded}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">{formatDate(event.date)}</span>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-300">
                {shortSha(event.commitSha)}
              </span>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                {eventTypeLabels[event.type]}
              </span>
            </div>
            <h3 className="text-lg font-semibold leading-snug text-zinc-50">{event.title}</h3>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${significanceStyles[event.significance]}`}>
              {significanceCopy[event.significance]}
            </span>
            <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400">
              {visibleExpanded ? 'Collapse' : 'Expand'}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-zinc-300">{event.description}</p>
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span className="rounded-full bg-zinc-900 px-2.5 py-1">{event.filesChanged.length} files changed</span>
        {hasArchDiff && <span className="rounded-full bg-zinc-900 px-2.5 py-1">Architecture diff ready</span>}
        {isHighlighted && <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-200">Referenced by chat</span>}
      </div>

      {visibleExpanded && (
        <div className="mt-5 space-y-5 border-t border-zinc-800 pt-5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-zinc-100">Changed files</h4>
              {onAskAboutEvent && (
                <button
                  type="button"
                  onClick={() => onAskAboutEvent(event)}
                  className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  Ask about this
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {event.filesChanged.map((file) => (
                <div
                  key={file}
                  className="min-w-0 truncate rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 font-mono text-xs text-zinc-300"
                  title={file}
                >
                  {file}
                </div>
              ))}
            </div>
          </section>

          {hasArchDiff && <ArchDiff before={event.archBefore} after={event.archAfter} />}
        </div>
      )}
    </article>
  );
}
