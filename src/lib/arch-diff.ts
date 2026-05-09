import type { ArchDiff, ArchitectureSnapshot } from '@/types';

function flatDeps(pkg?: ArchitectureSnapshot['packageJson']): Record<string, string> {
  if (!pkg) return {};
  return { ...pkg.devDependencies, ...pkg.dependencies };
}

export function diffArchitectureSnapshots(
  before: ArchitectureSnapshot,
  after: ArchitectureSnapshot
): ArchDiff {
  const a = new Set(before.directories);
  const b = new Set(after.directories);
  const addedDirs = [...b].filter((d) => !a.has(d)).sort();
  const removedDirs = [...a].filter((d) => !b.has(d)).sort();

  const depsBefore = flatDeps(before.packageJson);
  const depsAfter = flatDeps(after.packageJson);
  const keys = new Set([...Object.keys(depsBefore), ...Object.keys(depsAfter)]);

  const addedDeps: Record<string, string> = {};
  const removedDeps: Record<string, string> = {};
  const changedDeps: Record<string, { before: string; after: string }> = {};

  for (const k of keys) {
    const vb = depsBefore[k];
    const va = depsAfter[k];
    if (vb === undefined && va !== undefined) addedDeps[k] = va;
    else if (vb !== undefined && va === undefined) removedDeps[k] = vb;
    else if (vb !== undefined && va !== undefined && vb !== va) {
      changedDeps[k] = { before: vb, after: va };
    }
  }

  return { addedDirs, removedDirs, addedDeps, removedDeps, changedDeps };
}
