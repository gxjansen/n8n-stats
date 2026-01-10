import type { GitHubStats, GitHubRelease } from '../types';

const REPO = 'n8n-io/n8n';

/**
 * Fetch GitHub repository stats
 * Returns fallback values if API fails (rate limit, etc.)
 */
export async function fetchGitHubStats(): Promise<GitHubStats> {
  try {
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
      console.warn(`GitHub API returned ${response.status}, using fallback data`);
      return getFallbackStats();
    }

    const data = await response.json();

    return {
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      subscribers: data.subscribers_count,
    };
  } catch (error) {
    console.warn('Failed to fetch GitHub stats:', error);
    return getFallbackStats();
  }
}

/**
 * Get fallback stats (hardcoded recent values)
 */
function getFallbackStats(): GitHubStats {
  // Hardcoded fallback based on recent values
  return {
    stars: 167915,
    forks: 53369,
    watchers: 998,
    openIssues: 1224,
    subscribers: 998,
  };
}

/**
 * Fetch releases from GitHub (single page)
 * Returns empty array if API fails (rate limit, etc.)
 */
export async function fetchGitHubReleases(limit = 10): Promise<GitHubRelease[]> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${limit}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(import.meta.env.GITHUB_TOKEN && {
          'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`
        }),
      },
    });

    if (!response.ok) {
      console.warn(`GitHub releases API returned ${response.status}, returning empty array`);
      return [];
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
  } catch (error) {
    console.warn('Failed to fetch GitHub releases:', error);
    return [];
  }
}

/**
 * Fetch all releases from GitHub (paginated)
 * Use this when you need the complete release history
 * Returns empty array if API fails
 */
export async function fetchAllGitHubReleases(): Promise<GitHubRelease[]> {
  try {
    const allReleases: GitHubRelease[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/repos/${REPO}/releases?per_page=${perPage}&page=${page}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            ...(import.meta.env.GITHUB_TOKEN && {
              'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`
            }),
          },
        }
      );

      if (!response.ok) {
        console.warn(`GitHub releases API returned ${response.status}`);
        return allReleases; // Return what we have so far
      }

      const data = await response.json();

      if (data.length === 0) break;

      const releases = data.map((release: Record<string, unknown>) => ({
        tagName: release.tag_name,
        name: release.name,
        publishedAt: release.published_at,
        htmlUrl: release.html_url,
        prerelease: release.prerelease,
        body: release.body,
      }));

      allReleases.push(...releases);

      if (data.length < perPage) break;
      page++;
    }

    return allReleases;
  } catch (error) {
    console.warn('Failed to fetch all GitHub releases:', error);
    return [];
  }
}

/**
 * Fetch contributor count
 * Returns 0 if API fails
 */
export async function fetchContributorCount(): Promise<number> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=1&anon=true`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(import.meta.env.GITHUB_TOKEN && {
          'Authorization': `token ${import.meta.env.GITHUB_TOKEN}`
        }),
      },
    });

    if (!response.ok) {
      console.warn(`GitHub contributors API returned ${response.status}`);
      return 0;
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
  } catch (error) {
    console.warn('Failed to fetch contributors:', error);
    return 0;
  }
}
