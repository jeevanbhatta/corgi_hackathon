import type { ArchitectureSnapshot, TimelineEvent } from '@/types';

export type DependencyChangeStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DependencyChange {
  name: string;
  group: 'dependencies' | 'devDependencies';
  before?: string;
  after?: string;
  status: DependencyChangeStatus;
}

export interface DirectoryChange {
  path: string;
  status: 'added' | 'removed' | 'unchanged';
}

export interface EntryPointChange {
  path: string;
  status: 'added' | 'removed' | 'unchanged';
}

export interface ArchFrame {
  event: TimelineEvent;
  index: number;
  snapshot?: ArchitectureSnapshot;
  previousSnapshot?: ArchitectureSnapshot;
  directories: DirectoryChange[];
  entryPoints: EntryPointChange[];
  dependencies: DependencyChange[];
  addedDirCount: number;
  removedDirCount: number;
  depChangeCount: number;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function diffDirectories(
  prev: ArchitectureSnapshot | undefined,
  current: ArchitectureSnapshot | undefined,
): DirectoryChange[] {
  const prevSet = new Set(prev?.directories ?? []);
  const currentSet = new Set(current?.directories ?? []);
  const all = uniqueSorted([...(prev?.directories ?? []), ...(current?.directories ?? [])]);

  return all.map((path) => {
    const inPrev = prevSet.has(path);
    const inCurrent = currentSet.has(path);
    if (inCurrent && !inPrev) return { path, status: 'added' as const };
    if (!inCurrent && inPrev) return { path, status: 'removed' as const };
    return { path, status: 'unchanged' as const };
  });
}

function diffEntryPoints(
  prev: ArchitectureSnapshot | undefined,
  current: ArchitectureSnapshot | undefined,
): EntryPointChange[] {
  const prevSet = new Set(prev?.entryPoints ?? []);
  const currentSet = new Set(current?.entryPoints ?? []);
  const all = uniqueSorted([...(prev?.entryPoints ?? []), ...(current?.entryPoints ?? [])]);

  return all.map((path) => {
    const inPrev = prevSet.has(path);
    const inCurrent = currentSet.has(path);
    if (inCurrent && !inPrev) return { path, status: 'added' as const };
    if (!inCurrent && inPrev) return { path, status: 'removed' as const };
    return { path, status: 'unchanged' as const };
  });
}

function diffDependencies(
  prev: ArchitectureSnapshot | undefined,
  current: ArchitectureSnapshot | undefined,
): DependencyChange[] {
  const groups: Array<'dependencies' | 'devDependencies'> = ['dependencies', 'devDependencies'];

  return groups.flatMap((group) => {
    const prevDeps = prev?.packageJson?.[group] ?? {};
    const currentDeps = current?.packageJson?.[group] ?? {};
    const names = uniqueSorted([...Object.keys(prevDeps), ...Object.keys(currentDeps)]);

    return names.map<DependencyChange>((name) => {
      const before = prevDeps[name];
      const after = currentDeps[name];
      if (!before && after) return { name, group, after, status: 'added' };
      if (before && !after) return { name, group, before, status: 'removed' };
      if (before !== after) return { name, group, before, after, status: 'changed' };
      return { name, group, before, after, status: 'unchanged' };
    });
  });
}

/**
 * Build per-event architecture frames. Each frame represents the project's
 * architectural state at and immediately after that event. Events without a
 * fresh snapshot inherit the most recent one walking forward in time.
 */
export function buildArchFrames(events: TimelineEvent[]): ArchFrame[] {
  const ordered = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let runningSnapshot: ArchitectureSnapshot | undefined;
  let previousFrameSnapshot: ArchitectureSnapshot | undefined;

  return ordered.map((event, index) => {
    if (event.archAfter) runningSnapshot = event.archAfter;
    const snapshot = runningSnapshot;
    const previousSnapshot = event.archBefore ?? previousFrameSnapshot;

    const directories = diffDirectories(previousSnapshot, snapshot);
    const entryPoints = diffEntryPoints(previousSnapshot, snapshot);
    const dependencies = diffDependencies(previousSnapshot, snapshot);

    const addedDirCount = directories.filter((d) => d.status === 'added').length;
    const removedDirCount = directories.filter((d) => d.status === 'removed').length;
    const depChangeCount = dependencies.filter((d) => d.status !== 'unchanged').length;

    const frame: ArchFrame = {
      event,
      index,
      snapshot,
      previousSnapshot,
      directories,
      entryPoints,
      dependencies,
      addedDirCount,
      removedDirCount,
      depChangeCount,
    };

    previousFrameSnapshot = snapshot;
    return frame;
  });
}
