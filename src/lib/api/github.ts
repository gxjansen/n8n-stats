import type { GitHubStats, GitHubRelease } from '../types';

const REPO = 'n8n-io/n8n';

/**
 * Fetch GitHub repository stats
 */
export async function fetchGitHubStats(): Promise<GitHubStats> {
  const response = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      // Add token if available for higher rate limits
      ...(import.meta.env.GITHUB_TOKEN && {
        'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`
      }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub stats: ${response.status}`);
  }

  const data = await response.json();

  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    watchers: data.watchers_count,
    openIssues: data.open_issues_count,
    subscribers: data.subscribers_count,
  };
}

/**
 * Fetch recent releases from GitHub
 */
export async function fetchGitHubReleases(limit = 10): Promise<GitHubRelease[]> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${limit}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      ...(import.meta.env.GITHUB_TOKEN && {
        'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`
      }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub releases: ${response.status}`);
  }

  const data = await response.json();

  return data.map((release: Record<string, unknown>) => ({
    tagName: release.tag_name,
    name: release.name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    prerelease: release.prerelease,
    body: release.body,
  }));
}

/**
 * Fetch contributor count
 */
export async function fetchContributorCount(): Promise<number> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=1&anon=true`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      ...(import.meta.env.GITHUB_TOKEN && {
        'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`
      }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contributors: ${response.status}`);
  }

  // GitHub returns total count in Link header
  const linkHeader = response.headers.get('Link');
  if (linkHeader) {
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Fallback: count the response
  const data = await response.json();
  return data.length;
}
