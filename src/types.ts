export interface CommitSnapshot {
  sha: string;
  date: string;
  message: string;
  author: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  pr?: PullRequest;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  mergedAt: string;
  labels: string[];
}

export interface ArchitectureSnapshot {
  commitSha: string;
  date: string;
  directories: string[];
  packageJson?: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  entryPoints: string[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'commit' | 'pr_merge' | 'dep_change' | 'arch_shift';
  title: string;
  description: string;
  significance: 1 | 2 | 3;
  commitSha: string;
  filesChanged: string[];
  archBefore?: ArchitectureSnapshot;
  archAfter?: ArchitectureSnapshot;
}

export interface RepoIndex {
  repoId: string;
  owner: string;
  repo: string;
  timeline: TimelineEvent[];
  archSnapshots: ArchitectureSnapshot[];
  indexedAt: string;
}

/** Response shape for GET /api/diff */
export interface ArchDiff {
  addedDirs: string[];
  removedDirs: string[];
  addedDeps: Record<string, string>;
  removedDeps: Record<string, string>;
  changedDeps: Record<string, { before: string; after: string }>;
}

export interface RepositoryMeta {
  name: string;
  owner?: string;
  fullName?: string;
  url?: string;
  stars?: number;
  language?: string;
  indexedAt?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
