/**
 * Bluesky Profile History Update Script
 *
 * Fetches daily snapshot of n8n.io Bluesky profile stats:
 * - Followers count
 * - Following count
 * - Posts count
 *
 * No authentication required - uses public API.
 *
 * Run with: npx tsx scripts/update-bluesky-profile-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BLUESKY_PUBLIC_API = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile';
const N8N_HANDLE = 'n8n.io';

const DATA_DIR = join(process.cwd(), 'public', 'data', 'history');
const HISTORY_FILE = join(DATA_DIR, 'bluesky-profile.json');

interface DailySnapshot {
  date: string;
  followers: number;
  following: number;
  posts: number;
}

interface BlueskyProfileHistory {
  lastUpdated: string;
  handle: string;
  displayName: string;
  description: string;
  avatar: string;
  createdAt: string;
  daily: DailySnapshot[];
  current: {
    followers: number;
    following: number;
    posts: number;
  };
}

async function fetchProfile(): Promise<any> {
  const url = `${BLUESKY_PUBLIC_API}?actor=${N8N_HANDLE}`;

  console.log(`Fetching profile for @${N8N_HANDLE}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'n8n-stats/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function loadHistory(): BlueskyProfileHistory | null {
  if (!existsSync(HISTORY_FILE)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveHistory(data: BlueskyProfileHistory): void {
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

async function main() {
  console.log('Updating Bluesky profile history...\n');

  // Ensure directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch current profile
  const profile = await fetchProfile();

  const today = new Date().toISOString().split('T')[0];
  const snapshot: DailySnapshot = {
    date: today,
    followers: profile.followersCount || 0,
    following: profile.followsCount || 0,
    posts: profile.postsCount || 0,
  };

  console.log(`  Followers: ${snapshot.followers.toLocaleString()}`);
  console.log(`  Following: ${snapshot.following.toLocaleString()}`);
  console.log(`  Posts: ${snapshot.posts.toLocaleString()}`);

  // Load existing history
  const existing = loadHistory();
  let daily = existing?.daily || [];

  // Check if we already have today's entry
  const existingIndex = daily.findIndex(d => d.date === today);
  if (existingIndex >= 0) {
    // Update today's entry
    daily[existingIndex] = snapshot;
    console.log(`\n  Updated existing entry for ${today}`);
  } else {
    // Add new entry
    daily.push(snapshot);
    console.log(`\n  Added new entry for ${today}`);
  }

  // Sort by date
  daily.sort((a, b) => a.date.localeCompare(b.date));

  // Build history object
  const history: BlueskyProfileHistory = {
    lastUpdated: new Date().toISOString(),
    handle: profile.handle,
    displayName: profile.displayName || '',
    description: profile.description || '',
    avatar: profile.avatar || '',
    createdAt: profile.createdAt || '',
    daily,
    current: {
      followers: snapshot.followers,
      following: snapshot.following,
      posts: snapshot.posts,
    },
  };

  // Save
  saveHistory(history);
  console.log(`\nSaved ${daily.length} entries to ${HISTORY_FILE}`);

  // Show growth if we have history
  if (daily.length > 1) {
    const first = daily[0];
    const last = daily[daily.length - 1];
    const followerGrowth = last.followers - first.followers;
    const days = Math.ceil((new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24));

    if (days > 0) {
      console.log(`\nGrowth since ${first.date}:`);
      console.log(`  Followers: ${followerGrowth >= 0 ? '+' : ''}${followerGrowth} (${(followerGrowth / days).toFixed(1)}/day)`);
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
