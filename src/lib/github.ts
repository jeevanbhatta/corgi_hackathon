import { CommitSnapshot, PullRequest, ArchitectureSnapshot } from '@/types';

export async function fetchCommits(
  owner: string,
  repo: string,
  count: number
): Promise<CommitSnapshot[]> {
  // TODO: implement GitHub REST calls
  throw new Error('Not implemented');
}

export async function fetchPRs(
  owner: string,
  repo: string,
  count: number
): Promise<PullRequest[]> {
  // TODO: implement GitHub REST calls
  throw new Error('Not implemented');
}

export async function sampleArchitecture(
  owner: string,
  repo: string,
  commits: CommitSnapshot[]
): Promise<ArchitectureSnapshot[]> {
  // TODO: sample file tree at evenly-spaced commits
  throw new Error('Not implemented');
}

export function parseGitHubUrl(url: string): [string, string] {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  return [match[1], match[2].replace(/\.git$/, '')];
}
