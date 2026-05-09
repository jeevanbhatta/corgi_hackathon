import type { RepositoryMeta, TimelineEvent } from '@/types';

const initialArchitecture = {
  commitSha: '2f9b1a7c44c2d6a01d1b9d64d3d7e3c6b4f81210',
  date: '2023-09-18T10:14:00.000Z',
  directories: ['src', 'src/api', 'src/components', 'src/lib', 'src/styles', 'tests'],
  packageJson: {
    dependencies: {
      '@octokit/rest': '^20.0.2',
      next: '16.2.6',
      react: '19.2.4',
      'react-dom': '19.2.4',
    },
    devDependencies: {
      typescript: '^5.0.0',
      tailwindcss: '^4.0.0',
    },
  },
  entryPoints: ['src/app/page.tsx', 'src/app/api/ingest/route.ts'],
};

const queryArchitecture = {
  commitSha: '71c4b6d9a724a6bb8dfc4fb263f482f7cfac842e',
  date: '2024-01-22T16:36:00.000Z',
  directories: [
    'src',
    'src/api',
    'src/app',
    'src/app/api',
    'src/components',
    'src/lib',
    'src/lib/ai',
    'src/lib/github',
    'src/styles',
    'tests',
  ],
  packageJson: {
    dependencies: {
      '@octokit/rest': '^20.0.2',
      next: '16.2.6',
      react: '19.2.4',
      'react-dom': '19.2.4',
      zod: '^3.24.1',
    },
    devDependencies: {
      typescript: '^5.0.0',
      tailwindcss: '^4.0.0',
    },
  },
  entryPoints: ['src/app/page.tsx', 'src/app/api/ingest/route.ts', 'src/app/api/query/route.ts'],
};

const memoryArchitecture = {
  commitSha: 'e44d89f10a8fb9dd94db0766714f9ef0a2d316bd',
  date: '2024-03-19T19:08:00.000Z',
  directories: [
    'src',
    'src/app',
    'src/app/api',
    'src/app/api/diff',
    'src/app/api/ingest',
    'src/app/api/query',
    'src/components',
    'src/lib',
    'src/lib/ai',
    'src/lib/github',
    'src/lib/hydra',
    'src/lib/store',
    'tests',
  ],
  packageJson: {
    dependencies: {
      '@octokit/rest': '^20.0.2',
      next: '16.2.6',
      react: '19.2.4',
      'react-dom': '19.2.4',
      zod: '^3.24.1',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.4.0',
      tailwindcss: '^4.0.0',
    },
  },
  entryPoints: [
    'src/app/page.tsx',
    'src/app/api/ingest/route.ts',
    'src/app/api/query/route.ts',
    'src/app/api/diff/route.ts',
  ],
};

export const mockRepoMeta: RepositoryMeta = {
  name: 'repoplay',
  owner: 'corgi-labs',
  fullName: 'corgi-labs/repoplay',
  url: 'https://github.com/corgi-labs/repoplay',
  stars: 1284,
  language: 'TypeScript',
  indexedAt: '2024-03-21T21:18:00.000Z',
};

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 'evt_bootstrap',
    date: '2023-09-18T10:14:00.000Z',
    type: 'commit',
    title: 'Initial repository analyzer shell',
    description:
      'The app started as a thin Next.js shell with GitHub fetch helpers and a first pass at repository metadata. This gave the team a place to plug ingestion into the UI without deciding on storage yet.',
    significance: 1,
    commitSha: initialArchitecture.commitSha,
    filesChanged: ['src/app/page.tsx', 'src/lib/github.ts', 'src/types.ts'],
    archAfter: initialArchitecture,
  },
  {
    id: 'evt_pr_context',
    date: '2023-11-02T14:42:00.000Z',
    type: 'pr_merge',
    title: 'PR context joins commit history',
    description:
      'Pull request titles and bodies became part of the timeline input so the AI could infer intent instead of only summarizing changed files.',
    significance: 2,
    commitSha: '44d2eb9a9035710f4f4a02151e29d23a6340cdee',
    filesChanged: ['src/lib/github.ts', 'src/app/api/ingest/route.ts', 'src/types.ts'],
  },
  {
    id: 'evt_query_agent',
    date: '2024-01-22T16:36:00.000Z',
    type: 'arch_shift',
    title: 'Query agent split from ingestion',
    description:
      'Conversation moved into its own route so indexing and question answering could scale independently. That split also made room for a focused prompt with commit citations.',
    significance: 3,
    commitSha: queryArchitecture.commitSha,
    filesChanged: ['src/app/api/query/route.ts', 'src/lib/pipeshift.ts', 'src/components/ChatPanel.tsx'],
    archBefore: initialArchitecture,
    archAfter: queryArchitecture,
  },
  {
    id: 'evt_zod_dep',
    date: '2024-02-05T09:23:00.000Z',
    type: 'dep_change',
    title: 'Request validation added',
    description:
      'The API routes gained schema validation after malformed GitHub URLs caused brittle failures during early demos. The change made errors easier to show in the progress UI.',
    significance: 2,
    commitSha: '8ab14e24a5c948116799c857f54fa44a7d6e7e91',
    filesChanged: ['package.json', 'src/app/api/ingest/route.ts', 'src/app/api/query/route.ts'],
    archBefore: initialArchitecture,
    archAfter: queryArchitecture,
  },
  {
    id: 'evt_memory',
    date: '2024-03-19T19:08:00.000Z',
    type: 'arch_shift',
    title: 'Hydra memory layer becomes source of truth',
    description:
      'Commit snapshots, PR summaries, and architecture samples moved into a recall layer. The chat path stopped carrying a giant raw context dump and instead retrieved the most relevant history.',
    significance: 3,
    commitSha: memoryArchitecture.commitSha,
    filesChanged: ['src/lib/hydra.ts', 'src/lib/store.ts', 'src/app/api/query/route.ts'],
    archBefore: queryArchitecture,
    archAfter: memoryArchitecture,
  },
  {
    id: 'evt_diff_api',
    date: '2024-03-20T12:11:00.000Z',
    type: 'commit',
    title: 'Architecture diff endpoint lands',
    description:
      'The app gained a dedicated diff route for comparing sampled snapshots. This kept the timeline visual simple while still letting chat request precise before-and-after views.',
    significance: 2,
    commitSha: 'bd7ec34df0617e67d1bd072b83303a671f2f8011',
    filesChanged: ['src/app/api/diff/route.ts', 'src/types.ts'],
    archBefore: queryArchitecture,
    archAfter: memoryArchitecture,
  },
  {
    id: 'evt_highlights',
    date: '2024-03-21T21:18:00.000Z',
    type: 'pr_merge',
    title: 'Chat highlights timeline evidence',
    description:
      'Agent responses started returning referenced SHAs so the UI could point users back to the exact architectural moments behind an answer.',
    significance: 3,
    commitSha: 'a7d093c2195de56f4f6d52f93f91f8c8e14b8752',
    filesChanged: ['src/components/ChatPanel.tsx', 'src/components/Timeline.tsx', 'src/types.ts'],
  },
];
