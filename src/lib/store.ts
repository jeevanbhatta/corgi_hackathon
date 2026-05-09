import type { RepoIndex } from '@/types';

/** In-process cache: key = ingest URL string */
export const repoIndex = new Map<string, RepoIndex>();
