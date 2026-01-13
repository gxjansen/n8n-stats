/**
 * Bluesky History Update Script
 *
 * This script runs daily to:
 * 1. Fetch today's n8n mentions from Bluesky
 * 2. Append new posts to the history file
 * 3. Recalculate daily/weekly/monthly aggregations
 *
 * Requires:
 *   BLUESKY_HANDLE - Your Bluesky handle (e.g., gui.do)
 *   BLUESKY_APP_PASSWORD - App password from Bluesky settings
 *
 * Run with: npx tsx scripts/update-bluesky-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Constants
const BLUESKY_PDS = 'https://bsky.social';
const BLUESKY_SEARCH_API = `${BLUESKY_PDS}/xrpc/app.bsky.feed.searchPosts`;
const BLUESKY_SESSION_API = `${BLUESKY_PDS}/xrpc/com.atproto.server.createSession`;

const DATA_DIR = join(process.cwd(), 'public', 'data');
const HISTORY_DIR = join(DATA_DIR, 'history');
const POSTS_FILE = join(HISTORY_DIR, 'bluesky-posts.json');
const HISTORY_FILE = join(HISTORY_DIR, 'bluesky.json');

const N8N_HANDLE = 'n8n.io';
const DELAY_BETWEEN_REQUESTS = 500;

// Session token
let accessToken: string | null = null;

// Types
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

interface BlueskyPostsData {
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

interface BlueskyHistory {
  lastUpdated: string;
  daily: DailyStats[];
  weekly: Array<{
    date: string;
    posts: number;
    uniqueAuthors: number;
    totalLikes: number;
    avgPostsPerDay: number;
  }>;
  monthly: Array<{
    date: string;
    posts: number;
    uniqueAuthors: number;
    totalLikes: number;
    avgPostsPerDay: number;
  }>;
  totals: {
    posts: number;
    uniqueAuthors: number;
    totalLikes: number;
    totalReposts: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function authenticate(): Promise<void> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !password) {
    throw new Error(
      'Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD environment variables.'
    );
  }

  console.log(`Authenticating as @${handle}...`);

  const response = await fetch(BLUESKY_SESSION_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'n8n-stats/1.0',
    },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentication failed: ${response.status} ${error}`);
  }

  const session = await response.json();
  accessToken = session.accessJwt;
  console.log(`  Authenticated successfully\n`);
}

async function searchPosts(
  query: string,
  since: string,
  until: string
): Promise<BlueskyPost[]> {
  const posts: BlueskyPost[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = 20;

  if (!accessToken) {
    throw new Error('Not authenticated');
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

    try {
      const response = await fetch(`${BLUESKY_SEARCH_API}?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'n8n-stats/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('    Rate limited, waiting 60s...');
          await sleep(60000);
          continue;
        }
        throw new Error(`API error: ${response.status}`);
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
          searchType: 'keyword',
          fetchedAt: new Date().toISOString(),
        });
      }

      cursor = data.cursor;
      pageCount++;

      if (cursor) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      console.error(`    Error:`, error);
      break;
    }
  } while (cursor && pageCount < maxPages);

  return posts;
}

function loadPostsData(): BlueskyPostsData | null {
  if (!existsSync(POSTS_FILE)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(POSTS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function savePostsData(data: BlueskyPostsData): void {
  writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
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
    stats.push({
      date,
      posts: dayPosts.length,
      uniqueAuthors: new Set(dayPosts.map(p => p.author.did)).size,
      totalLikes: dayPosts.reduce((sum, p) => sum + p.likeCount, 0),
      totalReposts: dayPosts.reduce((sum, p) => sum + p.repostCount, 0),
      totalReplies: dayPosts.reduce((sum, p) => sum + p.replyCount, 0),
    });
  }

  return stats.sort((a, b) => a.date.localeCompare(b.date));
}

function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function generateHistory(dailyStats: DailyStats[], posts: BlueskyPost[]): BlueskyHistory {
  // Weekly aggregation
  const weeklyMap = new Map<string, DailyStats[]>();
  for (const day of dailyStats) {
    const week = getWeekKey(day.date);
    if (!weeklyMap.has(week)) {
      weeklyMap.set(week, []);
    }
    weeklyMap.get(week)!.push(day);
  }

  const weekly = Array.from(weeklyMap.entries()).map(([week, days]) => ({
    date: week,
    posts: days.reduce((sum, d) => sum + d.posts, 0),
    uniqueAuthors: days.reduce((sum, d) => sum + d.uniqueAuthors, 0),
    totalLikes: days.reduce((sum, d) => sum + d.totalLikes, 0),
    avgPostsPerDay: Math.round(days.reduce((sum, d) => sum + d.posts, 0) / days.length * 10) / 10,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Monthly aggregation
  const monthlyMap = new Map<string, DailyStats[]>();
  for (const day of dailyStats) {
    const month = day.date.slice(0, 7);
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, []);
    }
    monthlyMap.get(month)!.push(day);
  }

  const monthly = Array.from(monthlyMap.entries()).map(([month, days]) => ({
    date: month,
    posts: days.reduce((sum, d) => sum + d.posts, 0),
    uniqueAuthors: days.reduce((sum, d) => sum + d.uniqueAuthors, 0),
    totalLikes: days.reduce((sum, d) => sum + d.totalLikes, 0),
    avgPostsPerDay: Math.round(days.reduce((sum, d) => sum + d.posts, 0) / days.length * 10) / 10,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Totals
  const totals = {
    posts: posts.length,
    uniqueAuthors: new Set(posts.map(p => p.author.did)).size,
    totalLikes: posts.reduce((sum, p) => sum + p.likeCount, 0),
    totalReposts: posts.reduce((sum, p) => sum + p.repostCount, 0),
  };

  return {
    lastUpdated: new Date().toISOString(),
    daily: dailyStats.slice(-90), // Last 90 days for daily
    weekly,
    monthly,
    totals,
  };
}

function deduplicatePosts(posts: BlueskyPost[]): BlueskyPost[] {
  const seen = new Map<string, BlueskyPost>();
  for (const post of posts) {
    const existing = seen.get(post.uri);
    if (!existing || post.likeCount > existing.likeCount) {
      seen.set(post.uri, post);
    }
  }
  return Array.from(seen.values());
}

async function main() {
  console.log('Updating Bluesky history...\n');

  // Ensure directories exist
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true });
  }

  // Authenticate
  await authenticate();

  // Load existing data
  const existingData = loadPostsData();
  let allPosts = existingData?.posts || [];
  console.log(`Loaded ${allPosts.length} existing posts`);

  // Determine date range to fetch (last 3 days to catch any missed + update engagement counts)
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const fromDate = threeDaysAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];

  console.log(`Fetching posts from ${fromDate} to ${toDate}...`);

  // Fetch keyword search
  console.log('  Searching "n8n" keyword...');
  const keywordPosts = await searchPosts('n8n', fromDate, toDate);
  console.log(`    Found ${keywordPosts.length} posts`);

  await sleep(DELAY_BETWEEN_REQUESTS);

  // Fetch @mentions
  console.log(`  Searching @${N8N_HANDLE} mentions...`);
  const mentionPosts = await searchPosts(`@${N8N_HANDLE}`, fromDate, toDate);
  console.log(`    Found ${mentionPosts.length} posts`);

  // Combine and deduplicate with existing
  const newPosts = deduplicatePosts([...keywordPosts, ...mentionPosts]);
  const combinedPosts = deduplicatePosts([...allPosts, ...newPosts]);

  const addedCount = combinedPosts.length - allPosts.length;
  console.log(`\nAdded ${addedCount} new posts`);

  // Sort by date
  combinedPosts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Calculate stats
  const dailyStats = calculateDailyStats(combinedPosts);
  const uniqueAuthors = new Set(combinedPosts.map(p => p.author.did)).size;

  // Get date range
  const dates = combinedPosts.map(p => p.createdAt.split('T')[0]).sort();
  const dateRange = {
    from: dates[0] || fromDate,
    to: dates[dates.length - 1] || toDate,
  };

  // Save posts data
  const postsData: BlueskyPostsData = {
    posts: combinedPosts,
    dailyStats,
    meta: {
      firstFetch: existingData?.meta.firstFetch || new Date().toISOString(),
      lastFetch: new Date().toISOString(),
      totalPosts: combinedPosts.length,
      uniqueAuthors,
      dateRange,
    },
  };

  savePostsData(postsData);
  console.log(`Saved ${combinedPosts.length} posts to ${POSTS_FILE}`);

  // Generate and save aggregated history
  const history = generateHistory(dailyStats, combinedPosts);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log(`\nGenerated history:`);
  console.log(`  Daily: ${history.daily.length} entries (last 90 days)`);
  console.log(`  Weekly: ${history.weekly.length} entries`);
  console.log(`  Monthly: ${history.monthly.length} entries`);
  console.log(`  Total posts: ${history.totals.posts}`);
  console.log(`  Total likes: ${history.totals.totalLikes}`);

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
