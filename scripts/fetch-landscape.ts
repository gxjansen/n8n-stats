/**
 * Fetch metrics for competitor automation tools
 * Collects: GitHub stars, npm downloads, Docker pulls, commit activity, releases
 * Run weekly via GitHub Actions to track the automation landscape
 *
 * Usage: npx tsx scripts/fetch-landscape.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const LANDSCAPE_FILE = join(process.cwd(), 'public', 'data', 'history', 'landscape.json');

// Platform configurations
const PLATFORMS = {
  n8n: {
    github: 'n8n-io/n8n',
    npm: 'n8n',
    docker: 'n8nio/n8n',
  },
  activepieces: {
    github: 'activepieces/activepieces',
    npm: '@activepieces/pieces-apps',
    docker: 'activepieces/activepieces',
  },
  windmill: {
    github: 'windmill-labs/windmill',
    npm: 'windmill-client',
    docker: 'ghcr.io/windmill-labs/windmill', // GitHub Container Registry - different API
  },
  pipedream: {
    github: 'PipedreamHQ/pipedream',
    npm: '@pipedream/sdk',
    docker: null, // No official Docker image
  },
  huginn: {
    github: 'huginn/huginn',
    npm: null, // Ruby-based
    docker: 'huginn/huginn',
  },
  nodered: {
    github: 'node-red/node-red',
    npm: 'node-red',
    docker: 'nodered/node-red',
  },
};

interface LandscapeData {
  lastUpdated: string;
  platforms: Record<string, any>;
  github: {
    description: string;
    daily: Array<Record<string, any>>;
  };
  npm: {
    description: string;
    daily: Array<Record<string, any>>;
  };
  docker: {
    description: string;
    daily: Array<Record<string, any>>;
  };
  velocity: {
    description: string;
    daily: Array<Record<string, any>>;
  };
  linkedin: {
    description: string;
    daily: Array<Record<string, any>>;
  };
  community: {
    description: string;
    current: Record<string, any>;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GitHub API helpers
function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'n8n-stats-landscape',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGitHubStars(repo: string): Promise<number> {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: getGitHubHeaders(),
  });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  const data = await response.json();
  return data.stargazers_count;
}

async function fetchGitHubCommitActivity(repo: string): Promise<{ weeklyCommits: number; totalLast90Days: number }> {
  // Get commit activity for the last year (weekly breakdown)
  const response = await fetch(`https://api.github.com/repos/${repo}/stats/commit_activity`, {
    headers: getGitHubHeaders(),
  });
  if (!response.ok) throw new Error(`GitHub commit activity error: ${response.status}`);
  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    return { weeklyCommits: 0, totalLast90Days: 0 };
  }

  // Last week's commits
  const weeklyCommits = data[data.length - 1]?.total || 0;

  // Last ~13 weeks (90 days)
  const last13Weeks = data.slice(-13);
  const totalLast90Days = last13Weeks.reduce((sum: number, week: any) => sum + (week.total || 0), 0);

  return { weeklyCommits, totalLast90Days };
}

async function fetchGitHubReleases(repo: string): Promise<{ releasesLast90Days: number; latestRelease: string | null }> {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, {
    headers: getGitHubHeaders(),
  });
  if (!response.ok) throw new Error(`GitHub releases error: ${response.status}`);
  const data = await response.json();

  if (!Array.isArray(data)) {
    return { releasesLast90Days: 0, latestRelease: null };
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const recentReleases = data.filter((release: any) => {
    const releaseDate = new Date(release.published_at);
    return releaseDate >= ninetyDaysAgo;
  });

  const latestRelease = data[0]?.tag_name || null;

  return { releasesLast90Days: recentReleases.length, latestRelease };
}

// npm API
async function fetchNpmDownloads(packageName: string): Promise<number> {
  const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${packageName}`, {
    headers: { 'User-Agent': 'n8n-stats-landscape' },
  });
  if (!response.ok) throw new Error(`npm API error: ${response.status}`);
  const data = await response.json();
  return data.downloads || 0;
}

// Docker Hub API
async function fetchDockerPulls(image: string): Promise<number> {
  // Docker Hub format: namespace/repo
  const [namespace, repo] = image.split('/');
  const response = await fetch(`https://hub.docker.com/v2/repositories/${namespace}/${repo}/`, {
    headers: { 'User-Agent': 'n8n-stats-landscape' },
  });
  if (!response.ok) throw new Error(`Docker Hub API error: ${response.status}`);
  const data = await response.json();
  return data.pull_count || 0;
}

async function main() {
  console.log('Fetching landscape metrics...\n');

  const today = new Date().toISOString().split('T')[0];

  // Load existing data
  if (!existsSync(LANDSCAPE_FILE)) {
    console.error(`Landscape file not found: ${LANDSCAPE_FILE}`);
    process.exit(1);
  }

  const landscape: LandscapeData = JSON.parse(readFileSync(LANDSCAPE_FILE, 'utf-8'));

  // Initialize new sections if they don't exist
  if (!landscape.npm) {
    landscape.npm = {
      description: 'npm weekly downloads for automation tools',
      daily: [],
    };
  }
  if (!landscape.docker) {
    landscape.docker = {
      description: 'Docker Hub pull counts for automation tools',
      daily: [],
    };
  }
  if (!landscape.velocity) {
    landscape.velocity = {
      description: 'Development velocity: commits and releases (90-day window)',
      daily: [],
    };
  }

  // Collect all metrics
  const githubStars: Record<string, number> = {};
  const npmDownloads: Record<string, number> = {};
  const dockerPulls: Record<string, number> = {};
  const velocity: Record<string, any> = {};

  console.log('--- GitHub Stars ---');
  for (const [id, config] of Object.entries(PLATFORMS)) {
    try {
      const stars = await fetchGitHubStars(config.github);
      githubStars[id] = stars;
      console.log(`  ${id}: ${stars.toLocaleString()} stars`);
      await sleep(1000);
    } catch (error) {
      console.error(`  ${id}: ERROR - ${error}`);
    }
  }

  console.log('\n--- npm Weekly Downloads ---');
  for (const [id, config] of Object.entries(PLATFORMS)) {
    if (!config.npm) continue;
    try {
      const downloads = await fetchNpmDownloads(config.npm);
      npmDownloads[id] = downloads;
      console.log(`  ${id}: ${downloads.toLocaleString()} downloads/week`);
      await sleep(500);
    } catch (error) {
      console.error(`  ${id}: ERROR - ${error}`);
    }
  }

  console.log('\n--- Docker Hub Pulls ---');
  for (const [id, config] of Object.entries(PLATFORMS)) {
    if (!config.docker || config.docker.startsWith('ghcr.io')) continue; // Skip GitHub Container Registry
    try {
      const pulls = await fetchDockerPulls(config.docker);
      dockerPulls[id] = pulls;
      console.log(`  ${id}: ${pulls.toLocaleString()} pulls`);
      await sleep(500);
    } catch (error) {
      console.error(`  ${id}: ERROR - ${error}`);
    }
  }

  console.log('\n--- Development Velocity (90 days) ---');
  for (const [id, config] of Object.entries(PLATFORMS)) {
    try {
      const commits = await fetchGitHubCommitActivity(config.github);
      await sleep(1500); // GitHub stats endpoints can be slow
      const releases = await fetchGitHubReleases(config.github);

      velocity[id] = {
        weeklyCommits: commits.weeklyCommits,
        commits90d: commits.totalLast90Days,
        releases90d: releases.releasesLast90Days,
        latestRelease: releases.latestRelease,
      };
      console.log(`  ${id}: ${commits.totalLast90Days} commits, ${releases.releasesLast90Days} releases (latest: ${releases.latestRelease})`);
      await sleep(1000);
    } catch (error) {
      console.error(`  ${id}: ERROR - ${error}`);
    }
  }

  // Helper to update or add daily entry
  function updateDaily(section: { daily: Array<Record<string, any>> }, entry: Record<string, any>) {
    const existingIndex = section.daily.findIndex((d: any) => d.date === today);
    if (existingIndex >= 0) {
      section.daily[existingIndex] = entry;
    } else {
      section.daily.push(entry);
    }
    section.daily.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Save GitHub stars
  if (Object.keys(githubStars).length > 0) {
    updateDaily(landscape.github, { date: today, ...githubStars, source: 'api' });
  }

  // Save npm downloads
  if (Object.keys(npmDownloads).length > 0) {
    updateDaily(landscape.npm, { date: today, ...npmDownloads, source: 'api' });
  }

  // Save Docker pulls
  if (Object.keys(dockerPulls).length > 0) {
    updateDaily(landscape.docker, { date: today, ...dockerPulls, source: 'api' });
  }

  // Save velocity data
  if (Object.keys(velocity).length > 0) {
    const velocityEntry: Record<string, any> = { date: today, source: 'api' };
    for (const [id, data] of Object.entries(velocity)) {
      velocityEntry[`${id}_commits90d`] = data.commits90d;
      velocityEntry[`${id}_releases90d`] = data.releases90d;
      velocityEntry[`${id}_weeklyCommits`] = data.weeklyCommits;
      velocityEntry[`${id}_latestRelease`] = data.latestRelease;
    }
    updateDaily(landscape.velocity, velocityEntry);
  }

  // Update timestamp
  landscape.lastUpdated = new Date().toISOString();

  // Write back
  writeFileSync(LANDSCAPE_FILE, JSON.stringify(landscape, null, 2));
  console.log(`\nLandscape data saved to ${LANDSCAPE_FILE}`);

  // Print summary
  console.log('\n--- Summary ---');
  console.log(`Date: ${today}`);
  console.log(`GitHub: ${Object.keys(githubStars).length} platforms`);
  console.log(`npm: ${Object.keys(npmDownloads).length} platforms`);
  console.log(`Docker: ${Object.keys(dockerPulls).length} platforms`);
  console.log(`Velocity: ${Object.keys(velocity).length} platforms`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
