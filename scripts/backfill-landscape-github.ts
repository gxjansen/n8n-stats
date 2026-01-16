/**
 * Backfill GitHub Star History for Landscape Competitors
 *
 * Fetches historical star counts from ossinsight.io API for all
 * open-source automation platforms tracked in landscape.json.
 *
 * Run with: npx tsx scripts/backfill-landscape-github.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface OssInsightRow {
  date: string;
  stargazers: string;
}

interface OssInsightResponse {
  data: {
    rows: OssInsightRow[];
  };
}

interface LandscapeData {
  lastUpdated: string;
  platforms: Record<string, {
    name: string;
    github: string | null;
    [key: string]: any;
  }>;
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

const LANDSCAPE_PATH = join(process.cwd(), 'public', 'data', 'history', 'landscape.json');

// Repos to fetch (id -> owner/repo)
const GITHUB_REPOS: Record<string, string> = {
  n8n: 'n8n-io/n8n',
  activepieces: 'activepieces/activepieces',
  windmill: 'windmill-labs/windmill',
  pipedream: 'PipedreamHQ/pipedream',
  huginn: 'huginn/huginn',
  nodered: 'node-red/node-red',
};

async function fetchOssInsightData(repo: string): Promise<OssInsightRow[]> {
  console.log(`  Fetching ${repo}...`);

  const response = await fetch(
    `https://api.ossinsight.io/v1/repos/${repo}/stargazers/history`,
    {
      headers: {
        'User-Agent': 'n8n-pulse',
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.warn(`  Warning: ossinsight API error for ${repo}: ${response.status}`);
    return [];
  }

  const data: OssInsightResponse = await response.json();
  return data.data.rows;
}

function loadLandscape(): LandscapeData {
  if (!existsSync(LANDSCAPE_PATH)) {
    throw new Error('landscape.json not found. Run fetch-landscape first.');
  }
  return JSON.parse(readFileSync(LANDSCAPE_PATH, 'utf-8'));
}

function saveLandscape(data: LandscapeData): void {
  writeFileSync(LANDSCAPE_PATH, JSON.stringify(data, null, 2));
}

async function main() {
  console.log('Backfilling landscape GitHub star history from ossinsight.io\n');

  const landscape = loadLandscape();

  // Collect all historical data by date
  const dataByDate: Record<string, Record<string, number>> = {};

  // Process each repo
  for (const [id, repo] of Object.entries(GITHUB_REPOS)) {
    const ossData = await fetchOssInsightData(repo);
    console.log(`  Got ${ossData.length} data points`);

    for (const row of ossData) {
      // ossinsight dates are YYYY-MM-01, convert to YYYY-MM-15 for mid-month
      const date = row.date.replace(/-01$/, '-15');
      const stars = parseInt(row.stargazers, 10);

      if (!dataByDate[date]) {
        dataByDate[date] = {};
      }
      dataByDate[date][id] = stars;
    }

    // Rate limit: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Convert to daily array format, sorted by date
  const dates = Object.keys(dataByDate).sort();
  console.log(`\nCollected data for ${dates.length} dates`);
  console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);

  // Keep existing daily entries that have 'api' source (real-time data)
  const existingApiEntries = landscape.github.daily.filter(
    entry => entry.source === 'api'
  );

  // Create new daily array with historical + api data
  const newDaily: Array<Record<string, any>> = [];

  for (const date of dates) {
    const entry: Record<string, any> = {
      date,
      ...dataByDate[date],
      source: 'ossinsight',
    };
    newDaily.push(entry);
  }

  // Add back the API entries (they should be more recent)
  for (const apiEntry of existingApiEntries) {
    // Check if this date already exists
    const existingIndex = newDaily.findIndex(e => e.date === apiEntry.date);
    if (existingIndex >= 0) {
      // API data takes precedence
      newDaily[existingIndex] = apiEntry;
    } else {
      newDaily.push(apiEntry);
    }
  }

  // Sort by date
  newDaily.sort((a, b) => a.date.localeCompare(b.date));

  // Update landscape
  landscape.github.daily = newDaily;
  landscape.github.description = 'GitHub stars for open-source automation tools (historical from ossinsight.io, current updated weekly)';
  landscape.lastUpdated = new Date().toISOString();

  saveLandscape(landscape);

  console.log(`\nSaved ${newDaily.length} entries to landscape.json`);

  // Show recent data
  console.log('\nRecent entries (last 5):');
  const recent = newDaily.slice(-5);
  for (const entry of recent) {
    const platforms = Object.entries(entry)
      .filter(([k]) => !['date', 'source'].includes(k))
      .map(([k, v]) => `${k}: ${(v as number).toLocaleString()}`)
      .join(', ');
    console.log(`  ${entry.date}: ${platforms}`);
  }

  // Calculate growth stats
  console.log('\n--- Growth Analysis ---');
  const latestEntry = newDaily[newDaily.length - 1];

  // Find entry from ~1 month ago
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
  const monthAgoEntry = newDaily.filter(e => e.date <= oneMonthAgoStr).slice(-1)[0];

  // Find entry from ~3 months ago
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];
  const threeMonthAgoEntry = newDaily.filter(e => e.date <= threeMonthsAgoStr).slice(-1)[0];

  if (monthAgoEntry) {
    console.log(`\n1-month growth (${monthAgoEntry.date} -> ${latestEntry.date}):`);
    for (const id of Object.keys(GITHUB_REPOS)) {
      const current = latestEntry[id] || 0;
      const previous = monthAgoEntry[id] || 0;
      if (current && previous) {
        const growth = current - previous;
        const pct = ((growth / previous) * 100).toFixed(1);
        console.log(`  ${id}: +${growth.toLocaleString()} (+${pct}%)`);
      }
    }
  }

  if (threeMonthAgoEntry) {
    console.log(`\n3-month growth (${threeMonthAgoEntry.date} -> ${latestEntry.date}):`);
    for (const id of Object.keys(GITHUB_REPOS)) {
      const current = latestEntry[id] || 0;
      const previous = threeMonthAgoEntry[id] || 0;
      if (current && previous) {
        const growth = current - previous;
        const pct = ((growth / previous) * 100).toFixed(1);
        console.log(`  ${id}: +${growth.toLocaleString()} (+${pct}%)`);
      }
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
