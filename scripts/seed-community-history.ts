/**
 * Seed historical community data from Wayback Machine
 *
 * Fetches archived snapshots of community.n8n.io/about and extracts stats.
 * Respects rate limits with delays between requests.
 *
 * Run with: npx tsx scripts/seed-community-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface CommunityDataPoint {
  date: string;
  users: number;
  topics: number;
  posts: number;
  likes: number;
}

interface CommunityDailyLog {
  entries: CommunityDataPoint[];
}

const DATA_DIR = join(process.cwd(), 'public', 'data');
const RAW_LOG_PATH = join(DATA_DIR, 'community-raw-log.json');

// Rate limit: wait between requests (ms)
const REQUEST_DELAY = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWaybackSnapshots(): Promise<string[]> {
  const cdxUrl = 'http://web.archive.org/cdx/search/cdx?url=community.n8n.io/about&output=json';

  const response = await fetch(cdxUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CDX: ${response.status}`);
  }

  const data = await response.json();

  // Skip header row, extract timestamps
  return data.slice(1).map((row: string[]) => row[1]);
}

async function fetchArchivedStats(timestamp: string): Promise<CommunityDataPoint | null> {
  const url = `http://web.archive.org/web/${timestamp}/https://community.n8n.io/about`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`  Skipping ${timestamp}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract stats from HTML table
    // Pattern: <td class="title">Topics</td>\n        <td>6698</td>
    const statsMatch = html.match(/<section class="about stats">([\s\S]*?)<\/section>/);
    if (!statsMatch) {
      console.log(`  Skipping ${timestamp}: No stats section found`);
      return null;
    }

    const statsHtml = statsMatch[1];

    // Extract values - look for rows with All Time values
    const extractValue = (label: string): number => {
      // Pattern: <td>Label</td> or <td class="title">Label</td> followed by <td>NUMBER</td>
      const regex = new RegExp(`<td[^>]*>${label}</td>\\s*<td>([0-9,]+)</td>`, 'i');
      const match = statsHtml.match(regex);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
      return 0;
    };

    const topics = extractValue('Topics');
    const posts = extractValue('Posts');
    const users = extractValue('Users');
    const likes = extractValue('Likes');

    if (topics === 0 && posts === 0 && users === 0) {
      console.log(`  Skipping ${timestamp}: No valid data extracted`);
      return null;
    }

    // Convert timestamp to date (YYYYMMDDHHMMSS -> YYYY-MM-DD)
    const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;

    return { date, users, topics, posts, likes };

  } catch (error) {
    console.log(`  Error fetching ${timestamp}:`, error);
    return null;
  }
}

function loadRawLog(): CommunityDailyLog {
  if (!existsSync(RAW_LOG_PATH)) {
    return { entries: [] };
  }
  const content = readFileSync(RAW_LOG_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveRawLog(log: CommunityDailyLog): void {
  writeFileSync(RAW_LOG_PATH, JSON.stringify(log, null, 2));
}

async function main() {
  console.log('Seeding community history from Wayback Machine...\n');

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch available snapshots
  console.log('Fetching Wayback Machine snapshot list...');
  const timestamps = await fetchWaybackSnapshots();
  console.log(`Found ${timestamps.length} snapshots\n`);

  // Load existing log
  const rawLog = loadRawLog();
  const existingDates = new Set(rawLog.entries.map(e => e.date));
  console.log(`Existing log has ${rawLog.entries.length} entries\n`);

  // Fetch stats from each snapshot (with rate limiting)
  let added = 0;
  let skipped = 0;

  for (const timestamp of timestamps) {
    const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;

    // Skip if we already have this date
    if (existingDates.has(date)) {
      console.log(`Skipping ${date}: already exists`);
      skipped++;
      continue;
    }

    console.log(`Fetching ${timestamp} (${date})...`);
    const stats = await fetchArchivedStats(timestamp);

    if (stats) {
      rawLog.entries.push(stats);
      existingDates.add(date);
      added++;
      console.log(`  Added: Users=${stats.users}, Topics=${stats.topics}, Posts=${stats.posts}, Likes=${stats.likes}`);
    }

    // Rate limit
    await sleep(REQUEST_DELAY);
  }

  // Sort by date
  rawLog.entries.sort((a, b) => a.date.localeCompare(b.date));

  // Save
  saveRawLog(rawLog);

  console.log(`\nResult:`);
  console.log(`  Added: ${added} new entries`);
  console.log(`  Skipped: ${skipped} (already existed or failed)`);
  console.log(`  Total: ${rawLog.entries.length} entries`);

  console.log('\nNow run "npm run update-community-history" to regenerate aggregated history.');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
