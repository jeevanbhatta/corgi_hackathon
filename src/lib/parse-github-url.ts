export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const trimmed = url.trim();
  const match = trimmed.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!match) throw new Error('Invalid GitHub URL');

  let repo = match[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  return { owner: match[1], repo };
}
