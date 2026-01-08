/**
 * Backfill GitHub Star History from ossinsight.io
 *
 * This script fetches historical star counts from ossinsight.io API
 * and backfills the github-raw-log.json with monthly data points.
 *
 * Run with: npx tsx scripts/backfill-github-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface GitHubDataPoint {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  source?: string;
  sourceDetail?: string;
}

interface GitHubDailyLog {
  entries: GitHubDataPoint[];
}

interface OssInsightRow {
  date: string;
  stargazers: string;
}

interface OssInsightResponse {
  data: {
    rows: OssInsightRow[];
  };
}

const DATA_DIR = join(process.cwd(), 'public', 'data');
const RAW_LOG_PATH = join(DATA_DIR, 'github-raw-log.json');

async function fetchOssInsightData(): Promise<OssInsightRow[]> {
  console.log('Fetching star history from ossinsight.io...');

  const response = await fetch(
    'https://api.ossinsight.io/v1/repos/n8n-io/n8n/stargazers/history',
    {
      headers: {
        'User-Agent': 'n8n-pulse',
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`ossinsight API error: ${response.status}`);
  }

  const data: OssInsightResponse = await response.json();
  return data.data.rows;
}

function loadRawLog(): GitHubDailyLog {
  if (!existsSync(RAW_LOG_PATH)) {
    return { entries: [] };
  }
  const content = readFileSync(RAW_LOG_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveRawLog(log: GitHubDailyLog): void {
  writeFileSync(RAW_LOG_PATH, JSON.stringify(log, null, 2));
}

async function main() {
  console.log('Backfilling GitHub star history...\n');

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch ossinsight data
  const ossData = await fetchOssInsightData();
  console.log(`Fetched ${ossData.length} data points from ossinsight\n`);

  // Load existing raw log
  const rawLog = loadRawLog();
  console.log(`Existing raw log has ${rawLog.entries.length} entries`);

  // Create a map of existing entries by date
  const existingDates = new Set(rawLog.entries.map((e) => e.date));

  // Convert ossinsight data to our format and add missing entries
  let addedCount = 0;
  let updatedCount = 0;

  for (const row of ossData) {
    // ossinsight dates are YYYY-MM-01, convert to YYYY-MM-15 for mid-month
    const date = row.date.replace(/-01$/, '-15');
    const stars = parseInt(row.stargazers, 10);

    if (existingDates.has(date)) {
      // Update existing entry if it's a seed entry
      const existing = rawLog.entries.find((e) => e.date === date);
      if (existing && existing.source === 'seed') {
        existing.stars = stars;
        existing.source = 'ossinsight';
        existing.sourceDetail = 'api.ossinsight.io';
        updatedCount++;
      }
    } else {
      // Add new entry
      rawLog.entries.push({
        date,
        stars,
        forks: 0, // ossinsight doesn't provide these
        watchers: 0,
        openIssues: 0,
        source: 'ossinsight',
        sourceDetail: 'api.ossinsight.io',
      } as GitHubDataPoint);
      addedCount++;
    }
  }

  // Sort entries by date
  rawLog.entries.sort((a, b) => a.date.localeCompare(b.date));

  // Save raw log
  saveRawLog(rawLog);

  console.log(`\nAdded ${addedCount} new entries`);
  console.log(`Updated ${updatedCount} existing seed entries`);
  console.log(`Total entries: ${rawLog.entries.length}`);

  // Print data range
  const firstEntry = rawLog.entries[0];
  const lastEntry = rawLog.entries[rawLog.entries.length - 1];
  console.log(`\nData range: ${firstEntry.date} to ${lastEntry.date}`);
  console.log(`Stars: ${firstEntry.stars.toLocaleString()} → ${lastEntry.stars.toLocaleString()}`);

  // List 2024-2025 entries specifically
  console.log('\n2024-2025 data points:');
  const recentEntries = rawLog.entries.filter(
    (e) => e.date >= '2024-01-01' && e.date < '2026-01-01'
  );
  for (const entry of recentEntries) {
    console.log(`  ${entry.date}: ${entry.stars.toLocaleString()} stars (${entry.source})`);
  }

  console.log('\nDone! Now run: npm run update-github-history');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
