'use client';

import { useId } from 'react';
import type { ArchFrame } from '@/lib/arch-frames';

type TimelineScrubberProps = {
  frames: ArchFrame[];
  activeIndex: number;
  highlightedIndices?: number[];
  onChange: (index: number) => void;
};

const significanceMark: Record<1 | 2 | 3, string> = {
  1: 'h-1.5 w-1.5',
  2: 'h-2 w-2',
  3: 'h-2.5 w-2.5',
};

function formatYearMonth(date: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' }).format(new Date(date));
}

function formatLong(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function TimelineScrubber({
  frames,
  activeIndex,
  highlightedIndices = [],
  onChange,
}: TimelineScrubberProps) {
  const inputId = useId();
  if (frames.length === 0) return null;

  const max = frames.length - 1;
  const activeFrame = frames[activeIndex] ?? frames[0];
  const highlightSet = new Set(highlightedIndices);

  return (
    <section aria-labelledby={`${inputId}-label`} className="sticky top-0 z-40 bg-zinc-950 py-4 pb-6 shadow-[0_16px_16px_-16px_rgba(0,0,0,0.8)] -mx-6 px-6 sm:-mx-10 sm:px-10 mt-[-1rem]">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">02 / Scrub</p>
          <h2 id={`${inputId}-label`} className="mt-1 text-lg font-medium text-ink">
            Drag through history.
          </h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Frame {String(activeIndex + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-muted">{formatLong(activeFrame.event.date)}</p>
        </div>
      </div>

      <div className="relative">
        <div className="relative h-12">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule-strong" aria-hidden />

          {frames.map((frame, index) => {
            const left = max === 0 ? 50 : (index / max) * 100;
            const isActive = index === activeIndex;
            const isHighlighted = highlightSet.has(index);
            const isPast = index <= activeIndex;
            return (
              <button
                key={frame.event.id}
                type="button"
                onClick={() => onChange(index)}
                aria-label={`Jump to ${frame.event.title}`}
                aria-current={isActive ? 'step' : undefined}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-3 focus:outline-none"
                style={{ left: `${left}%` }}
              >
                <span
                  className={`block rounded-full border transition ${
                    significanceMark[frame.event.significance]
                  } ${
                    isActive
                      ? 'border-accent bg-accent'
                      : isPast
                        ? 'border-ink-muted bg-ink-muted'
                        : 'border-rule-strong bg-paper'
                  } ${isHighlighted && !isActive ? 'ring-2 ring-accent/50' : ''}`}
                />
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint group-hover:block group-focus-visible:block">
                  {formatYearMonth(frame.event.date)}
                </span>
              </button>
            );
          })}
        </div>

        <input
          id={inputId}
          type="range"
          min={0}
          max={max}
          step={1}
          value={activeIndex}
          onChange={(event) => onChange(Number(event.target.value))}
          className="scrubber-input absolute inset-x-0 top-1/2 -translate-y-1/2"
          aria-label="Scrub through repository history"
        />
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        <span>{formatYearMonth(frames[0].event.date)}</span>
        <span aria-hidden>← →</span>
        <span>{formatYearMonth(frames[max].event.date)}</span>
      </div>
    </section>
  );
}
