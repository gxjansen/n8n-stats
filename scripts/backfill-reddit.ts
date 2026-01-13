/**
 * Reddit History Backfill Script
 *
 * Extracts historical subscriber counts from Wayback Machine snapshots of r/n8n.
 * Uses the CDX API to find snapshots and scrapes member counts from archived pages.
 * Checks both reddit.com and old.reddit.com for better coverage.
 *
 * Run with: npx tsx scripts/backfill-reddit.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WAYBACK_CDX = 'https://web.archive.org/cdx/search/cdx';
const WAYBACK_WEB = 'https://web.archive.org/web';
const SUBREDDIT_URLS = [
  { cdxUrl: 'reddit.com/r/n8n', fullUrl: 'https://www.reddit.com/r/n8n/' },
  { cdxUrl: 'old.reddit.com/r/n8n', fullUrl: 'https://old.reddit.com/r/n8n/' },
];

const DATA_DIR = join(process.cwd(), 'public', 'data', 'history');
const HISTORY_FILE = join(DATA_DIR, 'reddit.json');

interface Snapshot {
  timestamp: string;
  fullUrl: string;
}

interface DailySnapshot {
  date: string;
  subscribers: number;
  activeUsers: number | null;
  postsLast24h: number;
  commentsLast24h: number;
}

interface RedditHistory {
  lastUpdated: string;
  subreddit: string;
  description: string;
  created: string;
  daily: DailySnapshot[];
  current: {
    subscribers: number;
    activeUsers: number | null;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSnapshots(): Promise<Snapshot[]> {
  console.log('Fetching Wayback Machine snapshot list...');

  const allSnapshots: Snapshot[] = [];

  for (const { cdxUrl, fullUrl } of SUBREDDIT_URLS) {
    const url = `${WAYBACK_CDX}?url=${cdxUrl}&output=json&filter=statuscode:200&filter=mimetype:text/html`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`  Warning: CDX API error for ${cdxUrl}: ${response.status}`);
      continue;
    }

    const data = await response.json();
    // Skip header row, extract timestamps
    const timestamps: string[] = data.slice(1).map((row: string[]) => row[1]);

    for (const ts of timestamps) {
      allSnapshots.push({ timestamp: ts, fullUrl });
    }

    console.log(`  Found ${timestamps.length} snapshots for ${cdxUrl}`);
  }

  // Dedupe by date (YYYYMMDD) - keep first snapshot per day
  // Prefer old.reddit.com since it has simpler HTML
  const dateMap = new Map<string, Snapshot>();

  for (const snapshot of allSnapshots) {
    const date = snapshot.timestamp.substring(0, 8); // YYYYMMDD
    const existing = dateMap.get(date);

    // Prefer old.reddit.com, or take first if same type
    if (!existing ||
        (snapshot.fullUrl.includes('old.reddit') && !existing.fullUrl.includes('old.reddit'))) {
      dateMap.set(date, snapshot);
    }
  }

  const uniqueSnapshots = Array.from(dateMap.values());
  uniqueSnapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  console.log(`Found ${uniqueSnapshots.length} unique date snapshots total\n`);
  return uniqueSnapshots;
}

async function extractSubscribers(snapshot: Snapshot): Promise<number | null> {
  const url = `${WAYBACK_WEB}/${snapshot.timestamp}/${snapshot.fullUrl}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'n8n-stats/1.0 (historical data collection)',
      },
    });

    if (!response.ok) {
      console.log(`HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Pattern 1: Old Reddit sidebar (most reliable)
    // <span class="subscribers"><span class="number">545</span>
    let match = html.match(/class="subscribers"[^>]*>\s*<span class="number">([0-9,]+)</);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }

    // Pattern 2: New Reddit design (IdCard--Subscribers)
    // <div class="...">391</div><p ... id="IdCard--Subscribers...">Members</p>
    match = html.match(/>([0-9,]+)<\/div><p[^>]*id="IdCard--Subscribers/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }

    // Pattern 3: JSON data embedded in page
    match = html.match(/"subscribers":\s*(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    // Pattern 4: subscriberCount in JSON-LD
    match = html.match(/"subscriberCount":\s*(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    console.log(`could not find subscriber count`);
    return null;
  } catch (error) {
    console.log(`error: ${error}`);
    return null;
  }
}

function timestampToDate(ts: string): string {
  // Convert YYYYMMDDHHMMSS to YYYY-MM-DD
  return `${ts.substring(0, 4)}-${ts.substring(4, 6)}-${ts.substring(6, 8)}`;
}

async function main() {
  console.log('Backfilling Reddit history from Wayback Machine...\n');

  // Get all snapshots
  const snapshots = await getSnapshots();

  // Extract subscriber counts
  const results: DailySnapshot[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const date = timestampToDate(snapshot.timestamp);
    const source = snapshot.fullUrl.includes('old.reddit') ? 'old' : 'new';

    process.stdout.write(`[${i + 1}/${snapshots.length}] ${date} (${source})... `);

    const subscribers = await extractSubscribers(snapshot);

    if (subscribers !== null) {
      console.log(`${subscribers.toLocaleString()} subscribers`);
      results.push({
        date,
        subscribers,
        activeUsers: null, // Not available from archived pages
        postsLast24h: 0,   // Not available
        commentsLast24h: 0, // Not available
      });
    } else {
      console.log('skipped');
    }

    // Rate limit: be nice to Wayback Machine
    await sleep(1500);
  }

  console.log(`\nExtracted ${results.length} data points`);

  // Load existing history
  let existing: RedditHistory | null = null;
  if (existsSync(HISTORY_FILE)) {
    existing = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  }

  // Merge with existing data (existing takes precedence for same dates)
  const existingDates = new Set(existing?.daily.map(d => d.date) || []);
  const newSnapshots = results.filter(s => !existingDates.has(s.date));

  const allDaily = [...(existing?.daily || []), ...newSnapshots];
  allDaily.sort((a, b) => a.date.localeCompare(b.date));

  // Build final history
  const history: RedditHistory = {
    lastUpdated: existing?.lastUpdated || new Date().toISOString(),
    subreddit: existing?.subreddit || 'r/n8n',
    description: existing?.description || '',
    created: existing?.created || '2020-09-29T17:39:42.000Z',
    daily: allDaily,
    current: existing?.current || {
      subscribers: allDaily[allDaily.length - 1]?.subscribers || 0,
      activeUsers: null,
    },
  };

  // Save
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log(`\nSaved ${allDaily.length} total entries to ${HISTORY_FILE}`);

  // Show growth summary
  if (allDaily.length > 1) {
    const first = allDaily[0];
    const last = allDaily[allDaily.length - 1];
    const growth = last.subscribers - first.subscribers;

    console.log(`\nGrowth from ${first.date} to ${last.date}:`);
    console.log(`  ${first.subscribers.toLocaleString()} → ${last.subscribers.toLocaleString()}`);
    console.log(`  +${growth.toLocaleString()} subscribers (${((growth / first.subscribers) * 100).toFixed(0)}% growth)`);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
