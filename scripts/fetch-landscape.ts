/**
 * Fetch GitHub stars for competitor open-source automation tools
 * Run weekly via GitHub Actions to track the automation landscape
 *
 * Usage: npx tsx scripts/fetch-landscape.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const LANDSCAPE_FILE = join(process.cwd(), 'public', 'data', 'history', 'landscape.json');

// Open-source automation tools to track
const GITHUB_REPOS = [
  { id: 'n8n', repo: 'n8n-io/n8n' },
  { id: 'activepieces', repo: 'activepieces/activepieces' },
  { id: 'windmill', repo: 'windmill-labs/windmill' },
  { id: 'pipedream', repo: 'PipedreamHQ/pipedream' },
  { id: 'huginn', repo: 'huginn/huginn' },
  { id: 'nodered', repo: 'node-red/node-red' },
];

interface GitHubRepoData {
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  open_issues_count: number;
}

interface LandscapeData {
  lastUpdated: string;
  platforms: Record<string, any>;
  github: {
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

async function fetchGitHubStars(repo: string): Promise<number> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'n8n-stats-landscape',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}`, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error for ${repo}: ${response.status} ${response.statusText}`);
  }

  const data: GitHubRepoData = await response.json();
  return data.stargazers_count;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Fetching landscape GitHub stars...\n');

  const today = new Date().toISOString().split('T')[0];

  // Load existing data
  if (!existsSync(LANDSCAPE_FILE)) {
    console.error(`Landscape file not found: ${LANDSCAPE_FILE}`);
    console.error('Please create the initial landscape.json file first.');
    process.exit(1);
  }

  const landscape: LandscapeData = JSON.parse(readFileSync(LANDSCAPE_FILE, 'utf-8'));

  // Fetch all GitHub stars
  const stars: Record<string, number> = {};
  const errors: string[] = [];

  for (const { id, repo } of GITHUB_REPOS) {
    try {
      const starCount = await fetchGitHubStars(repo);
      stars[id] = starCount;
      console.log(`  ${id}: ${starCount.toLocaleString()} stars`);

      // Rate limit: wait 1.5 seconds between requests (to be safe)
      await sleep(1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ${id}: ERROR - ${errorMsg}`);
      errors.push(`${id}: ${errorMsg}`);
    }
  }

  if (Object.keys(stars).length === 0) {
    console.error('\nNo stars fetched. Aborting.');
    process.exit(1);
  }

  // Create the daily entry
  const entry: Record<string, any> = {
    date: today,
    ...stars,
    source: 'api',
  };

  // Check if today's entry already exists
  const existingIndex = landscape.github.daily.findIndex((d: any) => d.date === today);

  if (existingIndex >= 0) {
    // Update existing entry
    landscape.github.daily[existingIndex] = entry;
    console.log(`\nUpdated existing entry for ${today}`);
  } else {
    // Add new entry
    landscape.github.daily.push(entry);
    console.log(`\nAdded new entry for ${today}`);
  }

  // Sort by date
  landscape.github.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Update lastUpdated timestamp
  landscape.lastUpdated = new Date().toISOString();

  // Write back to file
  writeFileSync(LANDSCAPE_FILE, JSON.stringify(landscape, null, 2));
  console.log(`\nLandscape data saved to ${LANDSCAPE_FILE}`);

  if (errors.length > 0) {
    console.warn(`\nWarnings: ${errors.length} repo(s) had errors`);
  }

  // Print summary
  console.log('\n--- Summary ---');
  console.log(`Date: ${today}`);
  console.log(`Repos tracked: ${Object.keys(stars).length}/${GITHUB_REPOS.length}`);
  console.log(`Total entries: ${landscape.github.daily.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
