'use client';

import type {
  ArchFrame,
  DependencyChange,
  DirectoryChange,
  EntryPointChange,
} from '@/lib/arch-frames';
import type { TimelineEvent } from '@/types';

type ArchStageProps = {
  frame: ArchFrame;
  isHighlighted?: boolean;
  onAskAboutEvent?: (event: TimelineEvent) => void;
};

const eventTypeCopy: Record<TimelineEvent['type'], string> = {
  commit: 'Commit',
  pr_merge: 'PR merge',
  dep_change: 'Dependency',
  arch_shift: 'Architecture shift',
};

const significanceCopy: Record<TimelineEvent['significance'], string> = {
  1: 'Minor',
  2: 'Notable',
  3: 'Major',
};

const dirGlyph: Record<DirectoryChange['status'], string> = {
  added: '+',
  removed: '−',
  unchanged: ' ',
};

const dirColor: Record<DirectoryChange['status'], string> = {
  added: 'text-added',
  removed: 'text-removed line-through opacity-70',
  unchanged: 'text-ink-muted',
};

const entryColor: Record<EntryPointChange['status'], string> = {
  added: 'text-added',
  removed: 'text-removed line-through opacity-70',
  unchanged: 'text-ink',
};

const depBadge: Record<DependencyChange['status'], string> = {
  added: 'border-added/40 text-added',
  removed: 'border-removed/40 text-removed',
  changed: 'border-changed/40 text-changed',
  unchanged: 'border-rule text-ink-faint',
};

const depLabel: Record<DependencyChange['status'], string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Bumped',
  unchanged: 'Same',
};

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function formatLong(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function buildTreeLines(directories: DirectoryChange[]): DirectoryChange[] {
  return [...directories].sort((a, b) => a.path.localeCompare(b.path));
}

function depthOf(path: string) {
  return Math.max(0, path.split('/').length - 1);
}

export default function ArchStage({ frame, isHighlighted, onAskAboutEvent }: ArchStageProps) {
  const { event, snapshot, previousSnapshot, directories, entryPoints, dependencies } = frame;
  const visibleDeps = dependencies.filter((dep) => dep.status !== 'unchanged');
  const dirLines = buildTreeLines(directories);
  const dirCount = directories.filter((d) => d.status !== 'removed').length;
  const addedDirs = directories.filter((d) => d.status === 'added').length;
  const removedDirs = directories.filter((d) => d.status === 'removed').length;
  const depChangeCount = visibleDeps.length;

  return (
    <section aria-labelledby="arch-stage-title" className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">03 / Architecture at this moment</p>
          <h2 id="arch-stage-title" className="mt-2 text-2xl font-medium leading-tight text-ink">
            {event.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{event.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            <span>{formatLong(event.date)}</span>
            <span aria-hidden>·</span>
            <span>{eventTypeCopy[event.type]}</span>
            <span aria-hidden>·</span>
            <span>{significanceCopy[event.significance]}</span>
            <span aria-hidden>·</span>
            <span className="text-ink">{shortSha(event.commitSha)}</span>
            {isHighlighted && (
              <>
                <span aria-hidden>·</span>
                <span className="text-accent">Referenced by chat</span>
              </>
            )}
          </div>
        </div>

        {onAskAboutEvent && (
          <button
            type="button"
            onClick={() => onAskAboutEvent(event)}
            className="border border-rule-strong px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink transition hover:border-accent hover:text-accent"
          >
            Ask the agent →
          </button>
        )}
      </header>

      {!snapshot ? (
        <p className="border border-dashed border-rule p-6 text-sm text-ink-muted">
          No architecture snapshot was sampled at this point. Scrub to a major event to see the
          repo&rsquo;s shape morph.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-4">
            <Stat label="Top-level dirs" value={dirCount} />
            <Stat label="New folders" value={addedDirs} tone={addedDirs > 0 ? 'added' : 'muted'} />
            <Stat
              label="Removed folders"
              value={removedDirs}
              tone={removedDirs > 0 ? 'removed' : 'muted'}
            />
            <Stat
              label="Dependency moves"
              value={depChangeCount}
              tone={depChangeCount > 0 ? 'changed' : 'muted'}
            />
          </dl>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <article aria-labelledby="dirs-title" className="space-y-4">
              <header className="flex items-baseline justify-between border-b border-rule pb-3">
                <h3 id="dirs-title" className="text-sm font-medium text-ink">
                  Directory tree
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  vs {previousSnapshot ? shortSha(previousSnapshot.commitSha) : 'initial'}
                </p>
              </header>

              <pre className="overflow-x-auto font-mono text-xs leading-6">
                <code>
                  {dirLines.map((line) => (
                    <span key={line.path} className={`block ${dirColor[line.status]}`}>
                      <span className="inline-block w-4 select-none text-center">
                        {dirGlyph[line.status]}
                      </span>
                      <span style={{ paddingLeft: depthOf(line.path) * 12 }}>
                        {line.path.split('/').slice(-1)[0]}/
                      </span>
                      {line.path.includes('/') && (
                        <span className="ml-2 text-ink-faint">
                          {line.path.split('/').slice(0, -1).join('/')}/
                        </span>
                      )}
                    </span>
                  ))}
                </code>
              </pre>

              {entryPoints.length > 0 && (
                <div className="space-y-2 border-t border-rule pt-4">
                  <p className="eyebrow">Entry points</p>
                  <ul className="space-y-1 font-mono text-xs">
                    {entryPoints.map((entry) => (
                      <li key={entry.path} className={entryColor[entry.status]}>
                        {entry.path}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            <article aria-labelledby="deps-title" className="space-y-4">
              <header className="flex items-baseline justify-between border-b border-rule pb-3">
                <h3 id="deps-title" className="text-sm font-medium text-ink">
                  Dependencies
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  package.json
                </p>
              </header>

              {visibleDeps.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No dependency changes between this frame and the previous one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {visibleDeps.map((dep) => (
                    <li
                      key={`${dep.group}-${dep.name}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule/60 pb-2 last:border-b-0"
                    >
                      <span
                        className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${depBadge[dep.status]}`}
                      >
                        {depLabel[dep.status]}
                      </span>
                      <span className="min-w-0 truncate font-mono text-sm text-ink">{dep.name}</span>
                      <span className="font-mono text-xs text-ink-muted">
                        {dep.status === 'added' && `+ ${dep.after}`}
                        {dep.status === 'removed' && `− ${dep.before}`}
                        {dep.status === 'changed' && `${dep.before} → ${dep.after}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {snapshot && (
                <div className="space-y-2 border-t border-rule pt-4">
                  <p className="eyebrow">Total at this point</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {Object.keys(snapshot.packageJson?.dependencies ?? {}).length} runtime ·{' '}
                    {Object.keys(snapshot.packageJson?.devDependencies ?? {}).length} dev
                  </p>
                </div>
              )}
            </article>
          </div>

          {event.filesChanged.length > 0 && (
            <article className="space-y-3 border-t border-rule pt-6">
              <header className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium text-ink">Files touched in this commit</h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  {event.filesChanged.length} file{event.filesChanged.length === 1 ? '' : 's'}
                </p>
              </header>
              <ul className="grid gap-1 font-mono text-xs text-ink-muted sm:grid-cols-2">
                {event.filesChanged.map((file) => (
                  <li key={file} className="truncate" title={file}>
                    {file}
                  </li>
                ))}
              </ul>
            </article>
          )}
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: number;
  tone?: 'muted' | 'added' | 'removed' | 'changed';
}) {
  const toneClass =
    tone === 'added'
      ? 'text-added'
      : tone === 'removed'
        ? 'text-removed'
        : tone === 'changed'
          ? 'text-changed'
          : 'text-ink';

  return (
    <div className="bg-paper px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">{label}</p>
      <p className={`mt-1 font-mono text-xl ${toneClass}`}>{String(value).padStart(2, '0')}</p>
    </div>
  );
}
