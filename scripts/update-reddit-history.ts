/**
 * Reddit History Update Script
 *
 * Fetches daily snapshot of r/n8n subreddit stats:
 * - Subscriber count
 * - Active users
 * - Recent post/comment activity
 *
 * No authentication required - uses public Reddit API.
 * Rate limit: 10 requests/minute for unauthenticated.
 *
 * Run with: npx tsx scripts/update-reddit-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUBREDDIT = 'n8n';
const REDDIT_API = `https://www.reddit.com/r/${SUBREDDIT}`;
const USER_AGENT = 'n8n-stats/1.0 (community dashboard)';

const DATA_DIR = join(process.cwd(), 'public', 'data', 'history');
const HISTORY_FILE = join(DATA_DIR, 'reddit.json');

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

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        console.log('  Rate limited, waiting 60s...');
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  Retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function fetchSubredditInfo(): Promise<any> {
  console.log(`Fetching r/${SUBREDDIT} info...`);
  const data = await fetchWithRetry(`${REDDIT_API}/about.json`);
  return data.data;
}

async function fetchRecentPosts(): Promise<any[]> {
  console.log(`Fetching recent posts...`);
  const data = await fetchWithRetry(`${REDDIT_API}/new.json?limit=100`);
  return data.data.children.map((c: any) => c.data);
}

function countLast24h(posts: any[]): { posts: number; comments: number } {
  const now = Date.now() / 1000;
  const dayAgo = now - 86400;

  const recentPosts = posts.filter(p => p.created_utc >= dayAgo);

  return {
    posts: recentPosts.length,
    comments: recentPosts.reduce((sum, p) => sum + (p.num_comments || 0), 0),
  };
}

function loadHistory(): RedditHistory | null {
  if (!existsSync(HISTORY_FILE)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveHistory(data: RedditHistory): void {
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  console.log('Updating Reddit history...\n');

  // Ensure directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch subreddit info
  const subredditInfo = await fetchSubredditInfo();

  console.log(`  Subscribers: ${subredditInfo.subscribers.toLocaleString()}`);
  console.log(`  Active users: ${subredditInfo.active_user_count || subredditInfo.accounts_active || 'N/A'}`);

  // Small delay to respect rate limits
  await new Promise(r => setTimeout(r, 1000));

  // Fetch recent posts for activity metrics
  const posts = await fetchRecentPosts();
  const activity = countLast24h(posts);

  console.log(`  Posts (24h): ${activity.posts}`);
  console.log(`  Comments (24h): ${activity.comments}`);

  const today = new Date().toISOString().split('T')[0];
  const snapshot: DailySnapshot = {
    date: today,
    subscribers: subredditInfo.subscribers,
    activeUsers: subredditInfo.active_user_count || subredditInfo.accounts_active || null,
    postsLast24h: activity.posts,
    commentsLast24h: activity.comments,
  };

  // Load existing history
  const existing = loadHistory();
  let daily = existing?.daily || [];

  // Check if we already have today's entry
  const existingIndex = daily.findIndex(d => d.date === today);
  if (existingIndex >= 0) {
    daily[existingIndex] = snapshot;
    console.log(`\n  Updated existing entry for ${today}`);
  } else {
    daily.push(snapshot);
    console.log(`\n  Added new entry for ${today}`);
  }

  // Sort by date
  daily.sort((a, b) => a.date.localeCompare(b.date));

  // Build history object
  const history: RedditHistory = {
    lastUpdated: new Date().toISOString(),
    subreddit: subredditInfo.display_name_prefixed,
    description: subredditInfo.public_description || '',
    created: new Date(subredditInfo.created_utc * 1000).toISOString(),
    daily,
    current: {
      subscribers: snapshot.subscribers,
      activeUsers: snapshot.activeUsers,
    },
  };

  // Save
  saveHistory(history);
  console.log(`\nSaved ${daily.length} entries to ${HISTORY_FILE}`);

  // Show growth if we have history
  if (daily.length > 1) {
    const first = daily[0];
    const last = daily[daily.length - 1];
    const subscriberGrowth = last.subscribers - first.subscribers;
    const days = Math.ceil(
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days > 0) {
      console.log(`\nGrowth since ${first.date}:`);
      console.log(`  Subscribers: ${subscriberGrowth >= 0 ? '+' : ''}${subscriberGrowth.toLocaleString()} (${(subscriberGrowth / days).toFixed(1)}/day)`);
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
