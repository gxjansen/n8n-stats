/**
 * Backfill npm download history for n8n
 * Fetches daily data from npm API and aggregates by week
 *
 * Usage: npx tsx scripts/backfill-npm-history.ts
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_FILE = join(process.cwd(), 'public', 'data', 'history', 'npm-downloads.json');
const PACKAGE_NAME = 'n8n';
const START_DATE = '2019-05-01'; // Shortly after n8n was published

interface DailyDownload {
  downloads: number;
  day: string;
}

interface WeeklyData {
  weekStart: string;
  downloads: number;
}

interface NpmHistory {
  package: string;
  lastUpdated: string;
  description: string;
  weekly: WeeklyData[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDownloadRange(startDate: string, endDate: string): Promise<DailyDownload[]> {
  const url = `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${PACKAGE_NAME}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'n8n-stats-backfill' },
  });

  if (!response.ok) {
    throw new Error(`npm API error: ${response.status}`);
  }

  const data = await response.json();
  return data.downloads || [];
}

function aggregateByWeek(dailyData: DailyDownload[]): WeeklyData[] {
  const weeklyMap = new Map<string, number>();

  for (const day of dailyData) {
    // Get the Monday of the week for this date
    const date = new Date(day.day);
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(date.setDate(diff));
    const weekStart = monday.toISOString().split('T')[0];

    const current = weeklyMap.get(weekStart) || 0;
    weeklyMap.set(weekStart, current + day.downloads);
  }

  // Convert to array and sort
  return Array.from(weeklyMap.entries())
    .map(([weekStart, downloads]) => ({ weekStart, downloads }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

async function main() {
  console.log(`Backfilling npm download history for ${PACKAGE_NAME}...\n`);

  // Calculate date ranges (npm API allows max ~18 months per request)
  const endDate = new Date();
  const startDate = new Date(START_DATE);

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

    console.log(`Fetching ${startStr} to ${endStr}...`);

    try {
      const data = await fetchDownloadRange(startStr, endStr);
      allDailyData.push(...data);
      console.log(`  Got ${data.length} days of data`);
    } catch (error) {
      console.error(`  Error: ${error}`);
    }

    // Move to next chunk
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);

    // Rate limit
    await sleep(500);
  }

  console.log(`\nTotal daily records: ${allDailyData.length}`);

  // Aggregate by week
  const weeklyData = aggregateByWeek(allDailyData);
  console.log(`Aggregated to ${weeklyData.length} weekly records`);

  // Calculate some stats
  const totalDownloads = weeklyData.reduce((sum, w) => sum + w.downloads, 0);
  const latestWeek = weeklyData[weeklyData.length - 1];
  const firstWeek = weeklyData[0];

  console.log(`\n--- Summary ---`);
  console.log(`First week: ${firstWeek?.weekStart} - ${firstWeek?.downloads.toLocaleString()} downloads`);
  console.log(`Latest week: ${latestWeek?.weekStart} - ${latestWeek?.downloads.toLocaleString()} downloads`);
  console.log(`Total all-time: ${totalDownloads.toLocaleString()} downloads`);
  console.log(`Growth: ${((latestWeek?.downloads || 0) / (firstWeek?.downloads || 1)).toFixed(0)}x`);

  // Save to file
  const history: NpmHistory = {
    package: PACKAGE_NAME,
    lastUpdated: new Date().toISOString(),
    description: 'Weekly npm download counts for n8n package',
    weekly: weeklyData,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(history, null, 2));
  console.log(`\nSaved to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
