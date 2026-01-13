/**
 * Backfill historical Bluesky data for n8n mentions
 *
 * Fetches posts mentioning "n8n" keyword and @n8n.io handle
 * from Bluesky's public launch (Feb 6, 2024) to present.
 *
 * Run once to collect historical data, then use fetch-bluesky.ts for daily updates.
 *
 * Requires:
 *   BLUESKY_HANDLE - Your Bluesky handle (e.g., gui.do)
 *   BLUESKY_APP_PASSWORD - App password from Bluesky settings
 *
 * Usage:
 *   npx tsx scripts/backfill-bluesky.ts
 *   npx tsx scripts/backfill-bluesky.ts --from 2024-06-01 --to 2024-06-30
 *   npx tsx scripts/backfill-bluesky.ts --resume
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Constants
const BLUESKY_PDS = 'https://bsky.social';
const BLUESKY_SEARCH_API = `${BLUESKY_PDS}/xrpc/app.bsky.feed.searchPosts`;
const BLUESKY_SESSION_API = `${BLUESKY_PDS}/xrpc/com.atproto.server.createSession`;
const DATA_DIR = join(process.cwd(), 'public', 'data', 'history');
const OUTPUT_FILE = join(DATA_DIR, 'bluesky-posts.json');
const PROGRESS_FILE = join(DATA_DIR, 'bluesky-backfill-progress.json');

// Bluesky public launch date
const BLUESKY_LAUNCH = '2024-02-06';

// Rate limiting: be conservative
const DELAY_BETWEEN_REQUESTS = 500; // ms
const DELAY_BETWEEN_DAYS = 1000; // ms

// n8n's Bluesky handle (we'll search for mentions of this)
const N8N_HANDLE = 'n8n.io';

// Session token (set after authentication)
let accessToken: string | null = null;

interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  indexedAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;
  // Metadata
  searchType: 'keyword' | 'mention';
  fetchedAt: string;
}

interface DailyStats {
  date: string;
  posts: number;
  uniqueAuthors: number;
  totalLikes: number;
  totalReposts: number;
  totalReplies: number;
}

interface BackfillData {
  posts: BlueskyPost[];
  dailyStats: DailyStats[];
  meta: {
    firstFetch: string;
    lastFetch: string;
    totalPosts: number;
    uniqueAuthors: number;
    dateRange: { from: string; to: string };
  };
}

interface Progress {
  lastCompletedDate: string;
  postsCollected: number;
  startedAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function authenticate(): Promise<void> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !password) {
    throw new Error(
      'Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD environment variables.\n' +
      'Set them before running:\n' +
      '  export BLUESKY_HANDLE="your.handle"\n' +
      '  export BLUESKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"'
    );
  }

  console.log(`Authenticating as @${handle}...`);

  const response = await fetch(BLUESKY_SESSION_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'n8n-stats/1.0 (community dashboard)',
    },
    body: JSON.stringify({
      identifier: handle,
      password: password,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentication failed: ${response.status} ${error}`);
  }

  const session = await response.json();
  accessToken = session.accessJwt;
  console.log(`  Authenticated successfully (DID: ${session.did})\n`);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = parseDate(from);
  const end = parseDate(to);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function searchPosts(
  query: string,
  since: string,
  until: string,
  searchType: 'keyword' | 'mention'
): Promise<BlueskyPost[]> {
  const posts: BlueskyPost[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = 10; // Safety limit per day

  if (!accessToken) {
    throw new Error('Not authenticated. Call authenticate() first.');
  }

  do {
    const params = new URLSearchParams({
      q: query,
      sort: 'latest',
      since: `${since}T00:00:00Z`,
      until: `${until}T23:59:59Z`,
      limit: '100',
    });

    if (cursor) {
      params.set('cursor', cursor);
    }

    const url = `${BLUESKY_SEARCH_API}?${params}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'n8n-stats/1.0 (community dashboard)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('    Rate limited, waiting 60s...');
          await sleep(60000);
          continue;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      for (const post of data.posts || []) {
        posts.push({
          uri: post.uri,
          cid: post.cid,
          author: {
            did: post.author.did,
            handle: post.author.handle,
            displayName: post.author.displayName,
            avatar: post.author.avatar,
          },
          text: post.record?.text || '',
          createdAt: post.record?.createdAt || post.indexedAt,
          indexedAt: post.indexedAt,
          likeCount: post.likeCount || 0,
          repostCount: post.repostCount || 0,
          replyCount: post.replyCount || 0,
          quoteCount: post.quoteCount || 0,
          searchType,
          fetchedAt: new Date().toISOString(),
        });
      }

      cursor = data.cursor;
      pageCount++;

      if (cursor) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }

    } catch (error) {
      console.error(`    Error fetching page ${pageCount}:`, error);
      break;
    }

  } while (cursor && pageCount < maxPages);

  return posts;
}

async function fetchMentions(
  handle: string,
  since: string,
  until: string
): Promise<BlueskyPost[]> {
  const posts: BlueskyPost[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = 10;

  if (!accessToken) {
    throw new Error('Not authenticated. Call authenticate() first.');
  }

  do {
    // For mentions, we use a different approach - search for @handle in text
    const params = new URLSearchParams({
      q: `@${handle}`,
      sort: 'latest',
      since: `${since}T00:00:00Z`,
      until: `${until}T23:59:59Z`,
      limit: '100',
    });

    if (cursor) {
      params.set('cursor', cursor);
    }

    const url = `${BLUESKY_SEARCH_API}?${params}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'n8n-stats/1.0 (community dashboard)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('    Rate limited, waiting 60s...');
          await sleep(60000);
          continue;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      for (const post of data.posts || []) {
        posts.push({
          uri: post.uri,
          cid: post.cid,
          author: {
            did: post.author.did,
            handle: post.author.handle,
            displayName: post.author.displayName,
            avatar: post.author.avatar,
          },
          text: post.record?.text || '',
          createdAt: post.record?.createdAt || post.indexedAt,
          indexedAt: post.indexedAt,
          likeCount: post.likeCount || 0,
          repostCount: post.repostCount || 0,
          replyCount: post.replyCount || 0,
          quoteCount: post.quoteCount || 0,
          searchType: 'mention',
          fetchedAt: new Date().toISOString(),
        });
      }

      cursor = data.cursor;
      pageCount++;

      if (cursor) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }

    } catch (error) {
      console.error(`    Error fetching mentions page ${pageCount}:`, error);
      break;
    }

  } while (cursor && pageCount < maxPages);

  return posts;
}

function deduplicatePosts(posts: BlueskyPost[]): BlueskyPost[] {
  const seen = new Map<string, BlueskyPost>();

  for (const post of posts) {
    const existing = seen.get(post.uri);
    if (!existing) {
      seen.set(post.uri, post);
    } else {
      // Keep the one with higher engagement (might have been updated)
      const existingScore = existing.likeCount + existing.repostCount;
      const newScore = post.likeCount + post.repostCount;
      if (newScore > existingScore) {
        seen.set(post.uri, post);
      }
    }
  }

  return Array.from(seen.values());
}

function calculateDailyStats(posts: BlueskyPost[]): DailyStats[] {
  const byDate = new Map<string, BlueskyPost[]>();

  for (const post of posts) {
    const date = post.createdAt.split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(post);
  }

  const stats: DailyStats[] = [];

  for (const [date, dayPosts] of byDate) {
    const uniqueAuthors = new Set(dayPosts.map(p => p.author.did)).size;
    stats.push({
      date,
      posts: dayPosts.length,
      uniqueAuthors,
      totalLikes: dayPosts.reduce((sum, p) => sum + p.likeCount, 0),
      totalReposts: dayPosts.reduce((sum, p) => sum + p.repostCount, 0),
      totalReplies: dayPosts.reduce((sum, p) => sum + p.replyCount, 0),
    });
  }

  return stats.sort((a, b) => a.date.localeCompare(b.date));
}

function loadProgress(): Progress | null {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function loadExistingData(): BackfillData | null {
  if (existsSync(OUTPUT_FILE)) {
    try {
      return JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveData(data: BackfillData): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');

  // Parse date arguments
  let fromDate = BLUESKY_LAUNCH;
  let toDate = formatDate(new Date());

  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && args[fromIdx + 1]) {
    fromDate = args[fromIdx + 1];
  }

  const toIdx = args.indexOf('--to');
  if (toIdx !== -1 && args[toIdx + 1]) {
    toDate = args[toIdx + 1];
  }

  console.log('=== Bluesky Historical Backfill ===\n');
  console.log(`Date range: ${fromDate} to ${toDate}`);
  console.log(`Searching for: "n8n" keyword + @${N8N_HANDLE} mentions\n`);

  // Authenticate with Bluesky
  await authenticate();

  // Load existing data or start fresh
  let existingData = loadExistingData();
  let allPosts: BlueskyPost[] = existingData?.posts || [];

  // Check for resume
  let startDate = fromDate;
  if (resume) {
    const progress = loadProgress();
    if (progress) {
      startDate = progress.lastCompletedDate;
      console.log(`Resuming from ${startDate} (${progress.postsCollected} posts collected)\n`);
    }
  }

  const dates = getDateRange(startDate, toDate);
  console.log(`Processing ${dates.length} days...\n`);

  let newPostsCount = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const nextDate = i < dates.length - 1 ? dates[i + 1] : formatDate(new Date(parseDate(date).getTime() + 86400000));

    console.log(`[${i + 1}/${dates.length}] ${date}`);

    // Fetch keyword search
    console.log('  Searching "n8n" keyword...');
    const keywordPosts = await searchPosts('n8n', date, date, 'keyword');
    console.log(`    Found ${keywordPosts.length} posts`);

    await sleep(DELAY_BETWEEN_REQUESTS);

    // Fetch @mentions
    console.log(`  Searching @${N8N_HANDLE} mentions...`);
    const mentionPosts = await fetchMentions(N8N_HANDLE, date, date);
    console.log(`    Found ${mentionPosts.length} posts`);

    // Combine and deduplicate
    const dayPosts = deduplicatePosts([...keywordPosts, ...mentionPosts]);
    const newPosts = dayPosts.filter(p => !allPosts.some(ep => ep.uri === p.uri));

    allPosts = [...allPosts, ...newPosts];
    newPostsCount += newPosts.length;

    console.log(`  Total for day: ${dayPosts.length} (${newPosts.length} new)\n`);

    // Save progress periodically
    if (i % 7 === 0 || i === dates.length - 1) {
      const progress: Progress = {
        lastCompletedDate: date,
        postsCollected: allPosts.length,
        startedAt: existingData?.meta.firstFetch || new Date().toISOString(),
      };
      saveProgress(progress);

      // Also save data
      const dailyStats = calculateDailyStats(allPosts);
      const uniqueAuthors = new Set(allPosts.map(p => p.author.did)).size;

      const data: BackfillData = {
        posts: allPosts,
        dailyStats,
        meta: {
          firstFetch: progress.startedAt,
          lastFetch: new Date().toISOString(),
          totalPosts: allPosts.length,
          uniqueAuthors,
          dateRange: { from: fromDate, to: date },
        },
      };

      saveData(data);
      console.log(`  [Checkpoint saved: ${allPosts.length} total posts]\n`);
    }

    await sleep(DELAY_BETWEEN_DAYS);
  }

  // Final save
  const dailyStats = calculateDailyStats(allPosts);
  const uniqueAuthors = new Set(allPosts.map(p => p.author.did)).size;

  const finalData: BackfillData = {
    posts: allPosts,
    dailyStats,
    meta: {
      firstFetch: existingData?.meta.firstFetch || new Date().toISOString(),
      lastFetch: new Date().toISOString(),
      totalPosts: allPosts.length,
      uniqueAuthors,
      dateRange: { from: fromDate, to: toDate },
    },
  };

  saveData(finalData);

  // Clean up progress file
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(PROGRESS_FILE);
  }

  console.log('=== Backfill Complete ===\n');
  console.log(`Total posts: ${allPosts.length}`);
  console.log(`New posts this run: ${newPostsCount}`);
  console.log(`Unique authors: ${uniqueAuthors}`);
  console.log(`Date range: ${fromDate} to ${toDate}`);
  console.log(`\nData saved to: ${OUTPUT_FILE}`);

  // Show daily stats summary
  console.log('\n--- Daily Summary (last 10 days) ---');
  const recentStats = dailyStats.slice(-10);
  for (const stat of recentStats) {
    console.log(`${stat.date}: ${stat.posts} posts, ${stat.uniqueAuthors} authors, ${stat.totalLikes} likes`);
  }
}

main().catch(console.error);
