'use client';

import type { ArchitectureSnapshot } from '@/types';

type ArchDiffProps = {
  before?: ArchitectureSnapshot;
  after?: ArchitectureSnapshot;
};

type ChangeStatus = 'added' | 'removed' | 'changed' | 'unchanged';

type DependencyChange = {
  name: string;
  before?: string;
  after?: string;
  group: 'dependencies' | 'devDependencies';
  status: ChangeStatus;
};

const statusStyles: Record<ChangeStatus, string> = {
  added: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  removed: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  changed: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  unchanged: 'border-zinc-700 bg-zinc-900/70 text-zinc-300',
};

const statusLabels: Record<ChangeStatus, string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Same',
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

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function directoryStatus(dir: string, before: Set<string>, after: Set<string>): ChangeStatus {
  if (!before.has(dir) && after.has(dir)) return 'added';
  if (before.has(dir) && !after.has(dir)) return 'removed';
  return 'unchanged';
}

function dependencyChanges(before: ArchitectureSnapshot, after: ArchitectureSnapshot) {
  const groups: Array<'dependencies' | 'devDependencies'> = ['dependencies', 'devDependencies'];

  return groups.flatMap((group) => {
    const beforeDeps = before.packageJson?.[group] ?? {};
    const afterDeps = after.packageJson?.[group] ?? {};
    const names = sortedUnique([...Object.keys(beforeDeps), ...Object.keys(afterDeps)]);

    return names.map<DependencyChange>((name) => {
      const beforeVersion = beforeDeps[name];
      const afterVersion = afterDeps[name];

      if (!beforeVersion && afterVersion) {
        return { name, after: afterVersion, group, status: 'added' };
      }

      if (beforeVersion && !afterVersion) {
        return { name, before: beforeVersion, group, status: 'removed' };
      }

      if (beforeVersion !== afterVersion) {
        return { name, before: beforeVersion, after: afterVersion, group, status: 'changed' };
      }

      return { name, before: beforeVersion, after: afterVersion, group, status: 'unchanged' };
    });
  });
}

function DirectoryList({
  title,
  date,
  sha,
  directories,
  beforeSet,
  afterSet,
}: {
  title: string;
  date: string;
  sha: string;
  directories: string[];
  beforeSet: Set<string>;
  afterSet: Set<string>;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
          <p className="text-xs text-zinc-500">
            {formatDate(date)} at {shortSha(sha)}
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
          {directories.length} dirs
        </span>
      </div>

      <div className="space-y-1 font-mono text-xs">
        {directories.map((dir) => {
          const depth = dir.split('/').length - 1;
          const status = directoryStatus(dir, beforeSet, afterSet);

          return (
            <div
              key={dir}
              className={`flex min-h-7 items-center justify-between gap-3 rounded-md border px-2 py-1 ${statusStyles[status]}`}
              style={{ marginLeft: `${Math.min(depth, 2) * 12}px` }}
            >
              <span className="min-w-0 truncate">{dir}/</span>
              {status !== 'unchanged' && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide">{statusLabels[status]}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ArchDiff({ before, after }: ArchDiffProps) {
  if (!before || !after) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-400">
        Architecture snapshots are not available for this event yet.
      </div>
    );
  }

  const beforeDirectories = sortedUnique(before.directories);
  const afterDirectories = sortedUnique(after.directories);
  const beforeSet = new Set(beforeDirectories);
  const afterSet = new Set(afterDirectories);
  const addedDirs = afterDirectories.filter((dir) => !beforeSet.has(dir));
  const removedDirs = beforeDirectories.filter((dir) => !afterSet.has(dir));
  const deps = dependencyChanges(before, after);
  const visibleDeps = deps.filter((dep) => dep.status !== 'unchanged');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <DirectoryList
          title="Before"
          date={before.date}
          sha={before.commitSha}
          directories={beforeDirectories}
          beforeSet={beforeSet}
          afterSet={afterSet}
        />
        <DirectoryList
          title="After"
          date={after.date}
          sha={after.commitSha}
          directories={afterDirectories}
          beforeSet={beforeSet}
          afterSet={afterSet}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-200/80">Added directories</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-100">{addedDirs.length}</p>
        </div>
        <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-200/80">Removed directories</p>
          <p className="mt-1 text-2xl font-semibold text-rose-100">{removedDirs.length}</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-200/80">Dependency changes</p>
          <p className="mt-1 text-2xl font-semibold text-amber-100">{visibleDeps.length}</p>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-zinc-100">Dependency changes</h4>
          <span className="text-xs text-zinc-500">package.json</span>
        </div>

        {visibleDeps.length > 0 ? (
          <div className="space-y-2">
            {visibleDeps.map((dep) => (
              <div
                key={`${dep.group}-${dep.name}`}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${statusStyles[dep.status]}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{dep.name}</p>
                  <p className="text-xs opacity-75">{dep.group}</p>
                </div>
                <div className="shrink-0 text-right font-mono text-xs">
                  {dep.status === 'added' && <span>+ {dep.after}</span>}
                  {dep.status === 'removed' && <span>- {dep.before}</span>}
                  {dep.status === 'changed' && (
                    <span>
                      {dep.before} to {dep.after}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No package dependency changes between these snapshots.</p>
        )}
      </section>
    </div>
  );
}
