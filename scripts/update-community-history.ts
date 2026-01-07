/**
 * Community History Update Script
 *
 * This script runs before each build to:
 * 1. Fetch current community stats from Discourse
 * 2. Append to raw daily log
 * 3. Generate aggregated history (daily/weekly/monthly)
 *
 * Run with: npx tsx scripts/update-community-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Types
interface CommunityDataPoint {
  date: string;
  users: number;
  topics: number;
  posts: number;
  likes: number;
}

interface CommunityHistory {
  lastUpdated: string;
  daily: CommunityDataPoint[];
  weekly: CommunityDataPoint[];
  monthly: CommunityDataPoint[];
}

interface CommunityDailyLog {
  entries: CommunityDataPoint[];
}

// Paths
const DATA_DIR = join(process.cwd(), 'public', 'data');
const RAW_LOG_PATH = join(DATA_DIR, 'community-raw-log.json');
const HISTORY_PATH = join(DATA_DIR, 'community-history.json');

// Config
const DAILY_RETENTION_DAYS = 90;
const WEEKLY_RETENTION_DAYS = 730; // ~2 years

async function fetchCommunityStats(): Promise<CommunityDataPoint> {
  const response = await fetch('https://community.n8n.io/site/statistics.json', {
    headers: {
      'User-Agent': 'n8n-stats',
    },
  });

  if (!response.ok) {
    throw new Error(`Discourse API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    users: data.users_count,
    topics: data.topics_count,
    posts: data.posts_count,
    likes: data.likes_count,
  };
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

function saveHistory(history: CommunityHistory): void {
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function aggregateByPeriod(
  entries: CommunityDataPoint[],
  getKey: (date: string) => string
): CommunityDataPoint[] {
  const grouped = new Map<string, CommunityDataPoint[]>();

  for (const entry of entries) {
    const key = getKey(entry.date);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // For each period, take the last entry (most recent for cumulative metrics)
  const aggregated: CommunityDataPoint[] = [];
  for (const [key, periodEntries] of grouped) {
    const lastEntry = periodEntries[periodEntries.length - 1];
    aggregated.push({
      ...lastEntry,
      date: key,
    });
  }

  return aggregated.sort((a, b) => a.date.localeCompare(b.date));
}

function generateHistory(rawLog: CommunityDailyLog): CommunityHistory {
  const now = new Date();
  const entries = rawLog.entries;

  // Daily: last 90 days
  const dailyCutoff = new Date(now);
  dailyCutoff.setDate(dailyCutoff.getDate() - DAILY_RETENTION_DAYS);
  const dailyCutoffStr = dailyCutoff.toISOString().split('T')[0];

  const daily = entries
    .filter(e => e.date >= dailyCutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Weekly: last 2 years
  const weeklyCutoff = new Date(now);
  weeklyCutoff.setDate(weeklyCutoff.getDate() - WEEKLY_RETENTION_DAYS);
  const weeklyCutoffStr = weeklyCutoff.toISOString().split('T')[0];

  const weeklyEntries = entries.filter(e => e.date >= weeklyCutoffStr);
  const weekly = aggregateByPeriod(weeklyEntries, getWeekKey);

  // Monthly: all time
  const monthly = aggregateByPeriod(entries, getMonthKey);

  return {
    lastUpdated: now.toISOString(),
    daily,
    weekly,
    monthly,
  };
}

async function main() {
  console.log('Updating community history...\n');

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory');
  }

  // Load existing raw log
  const rawLog = loadRawLog();
  console.log(`Loaded ${rawLog.entries.length} existing entries`);

  // Fetch current stats
  console.log('Fetching current community stats...');
  const todayStats = await fetchCommunityStats();
  console.log(`  Users: ${todayStats.users.toLocaleString()}`);
  console.log(`  Topics: ${todayStats.topics.toLocaleString()}`);
  console.log(`  Posts: ${todayStats.posts.toLocaleString()}`);
  console.log(`  Likes: ${todayStats.likes.toLocaleString()}`);

  // Check if we already have an entry for today
  const existingToday = rawLog.entries.find(e => e.date === todayStats.date);
  if (existingToday) {
    console.log(`\nEntry for ${todayStats.date} already exists, updating...`);
    Object.assign(existingToday, todayStats);
  } else {
    console.log(`\nAdding new entry for ${todayStats.date}`);
    rawLog.entries.push(todayStats);
  }

  // Sort entries by date
  rawLog.entries.sort((a, b) => a.date.localeCompare(b.date));

  // Save raw log
  saveRawLog(rawLog);
  console.log(`Saved raw log (${rawLog.entries.length} entries)`);

  // Generate and save aggregated history
  const history = generateHistory(rawLog);
  saveHistory(history);
  console.log(`\nGenerated history:`);
  console.log(`  Daily: ${history.daily.length} entries`);
  console.log(`  Weekly: ${history.weekly.length} entries`);
  console.log(`  Monthly: ${history.monthly.length} entries`);

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
