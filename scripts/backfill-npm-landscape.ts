/**
 * Backfill npm download history for all automation platforms
 * Fetches daily data from npm API and aggregates by week
 *
 * Usage: npx tsx scripts/backfill-npm-landscape.ts
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_FILE = join(process.cwd(), 'public', 'data', 'history', 'npm-landscape.json');

// Platform npm packages (same as fetch-landscape.ts)
const PACKAGES: Record<string, string> = {
  n8n: 'n8n',
  activepieces: '@activepieces/pieces-apps',
  windmill: 'windmill-client',
  pipedream: '@pipedream/sdk',
  nodered: 'node-red',
  // huginn is Ruby-based, no npm package
};

interface DailyDownload {
  downloads: number;
  day: string;
}

interface WeeklyEntry {
  weekStart: string;
  [platform: string]: string | number; // platform downloads + weekStart
}

interface NpmLandscapeHistory {
  lastUpdated: string;
  description: string;
  packages: Record<string, string>;
  weekly: WeeklyEntry[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDownloadRange(packageName: string, startDate: string, endDate: string): Promise<DailyDownload[]> {
  const url = `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${encodeURIComponent(packageName)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'n8n-stats-backfill' },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Package might not exist for this date range
      return [];
    }
    throw new Error(`npm API error: ${response.status}`);
  }

  const data = await response.json();
  return data.downloads || [];
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function aggregateByWeek(dailyData: DailyDownload[]): Map<string, number> {
  const weeklyMap = new Map<string, number>();

  for (const day of dailyData) {
    const weekStart = getWeekStart(day.day);
    const current = weeklyMap.get(weekStart) || 0;
    weeklyMap.set(weekStart, current + day.downloads);
  }

  return weeklyMap;
}

async function fetchPackageHistory(packageName: string, platformId: string): Promise<Map<string, number>> {
  console.log(`\nFetching ${platformId} (${packageName})...`);

  // First, check when the package was created
  let startDate = '2019-01-01'; // Default start
  try {
    const metaResponse = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      const created = meta.time?.created;
      if (created) {
        const createdDate = new Date(created);
        // Start from the month after creation
        createdDate.setMonth(createdDate.getMonth() + 1);
        startDate = createdDate.toISOString().split('T')[0];
        console.log(`  Package created: ${meta.time.created}, starting from: ${startDate}`);
      }
    }
  } catch (e) {
    console.log(`  Could not fetch metadata, using default start date`);
  }

  const endDate = new Date();
  const allDailyData: DailyDownload[] = [];
  let currentStart = new Date(startDate);

  // Fetch in chunks of 365 days
  while (currentStart < endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 365);

    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }

    const startStr = currentStart.toISOString().split('T')[0];
    const endStr = currentEnd.toISOString().split('T')[0];

    try {
      const data = await fetchDownloadRange(packageName, startStr, endStr);
      allDailyData.push(...data);
      process.stdout.write(`  ${startStr} to ${endStr}: ${data.length} days\n`);
    } catch (error) {
      console.error(`  Error fetching ${startStr} to ${endStr}: ${error}`);
    }

    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);

    await sleep(300); // Rate limit
  }

  console.log(`  Total: ${allDailyData.length} days of data`);
  return aggregateByWeek(allDailyData);
}

async function main() {
  console.log('Backfilling npm download history for all platforms...');

  // Fetch history for each package
  const platformWeeklyData: Record<string, Map<string, number>> = {};

  for (const [platformId, packageName] of Object.entries(PACKAGES)) {
    try {
      platformWeeklyData[platformId] = await fetchPackageHistory(packageName, platformId);
      await sleep(500); // Extra delay between packages
    } catch (error) {
      console.error(`Failed to fetch ${platformId}: ${error}`);
      platformWeeklyData[platformId] = new Map();
    }
  }

  // Collect all unique weeks
  const allWeeks = new Set<string>();
  for (const weeklyMap of Object.values(platformWeeklyData)) {
    for (const week of weeklyMap.keys()) {
      allWeeks.add(week);
    }
  }

  // Sort weeks
  const sortedWeeks = Array.from(allWeeks).sort();
  console.log(`\nTotal weeks: ${sortedWeeks.length}`);

  // Build combined weekly data
  const weekly: WeeklyEntry[] = sortedWeeks.map(weekStart => {
    const entry: WeeklyEntry = { weekStart };
    for (const [platformId, weeklyMap] of Object.entries(platformWeeklyData)) {
      entry[platformId] = weeklyMap.get(weekStart) || 0;
    }
    return entry;
  });

  // Calculate summary stats
  console.log('\n--- Summary ---');
  for (const [platformId, weeklyMap] of Object.entries(platformWeeklyData)) {
    const values = Array.from(weeklyMap.values());
    const total = values.reduce((a, b) => a + b, 0);
    const latest = weekly[weekly.length - 1]?.[platformId] || 0;
    console.log(`${platformId}: ${total.toLocaleString()} total, ${Number(latest).toLocaleString()}/week latest`);
  }

  // Save to file
  const history: NpmLandscapeHistory = {
    lastUpdated: new Date().toISOString(),
    description: 'Weekly npm download counts for automation platforms',
    packages: PACKAGES,
    weekly,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(history, null, 2));
  console.log(`\nSaved to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
