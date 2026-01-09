/**
 * Discord History Update Script
 *
 * This script runs before each build to:
 * 1. Fetch current Discord stats from public invite API
 * 2. Append to raw daily log
 * 3. Generate aggregated history (daily/weekly/monthly)
 *
 * Run with: npx tsx scripts/update-discord-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Types
interface DiscordDataPoint {
  date: string;
  members: number;
  online: number | null; // Online count at time of fetch (snapshot only)
  source?: string;
}

interface DiscordHistory {
  lastUpdated: string;
  daily: DiscordDataPoint[];
  weekly: DiscordDataPoint[];
  monthly: DiscordDataPoint[];
}

interface DiscordDailyLog {
  entries: DiscordDataPoint[];
}

// Paths
const DATA_DIR = join(process.cwd(), 'public', 'data');
const HISTORY_DIR = join(DATA_DIR, 'history');
const RAW_LOG_PATH = join(HISTORY_DIR, 'discord-raw-log.json');
const HISTORY_PATH = join(HISTORY_DIR, 'discord.json');

// Config
const DISCORD_INVITE_CODE = 'n8n';
const DAILY_RETENTION_DAYS = 90;
const WEEKLY_RETENTION_DAYS = 730; // ~2 years

async function fetchDiscordStats(): Promise<DiscordDataPoint> {
  const response = await fetch(
    `https://discord.com/api/v9/invites/${DISCORD_INVITE_CODE}?with_counts=true`,
    {
      headers: {
        'User-Agent': 'n8n-stats',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Discord API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    members: data.approximate_member_count,
    online: data.approximate_presence_count,
    source: 'discord-api',
  };
}

function loadRawLog(): DiscordDailyLog {
  if (!existsSync(RAW_LOG_PATH)) {
    return { entries: [] };
  }
  const content = readFileSync(RAW_LOG_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveRawLog(log: DiscordDailyLog): void {
  writeFileSync(RAW_LOG_PATH, JSON.stringify(log, null, 2));
}

function saveHistory(history: DiscordHistory): void {
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
  entries: DiscordDataPoint[],
  getKey: (date: string) => string
): DiscordDataPoint[] {
  const grouped = new Map<string, DiscordDataPoint[]>();

  for (const entry of entries) {
    const key = getKey(entry.date);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // For each period, take the last entry (most recent for cumulative metrics)
  const aggregated: DiscordDataPoint[] = [];
  for (const [key, periodEntries] of grouped) {
    const lastEntry = periodEntries[periodEntries.length - 1];
    aggregated.push({
      ...lastEntry,
      date: key,
    });
  }

  return aggregated.sort((a, b) => a.date.localeCompare(b.date));
}

function loadExistingHistory(): DiscordHistory | null {
  if (!existsSync(HISTORY_PATH)) {
    return null;
  }
  try {
    const content = readFileSync(HISTORY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function generateHistory(rawLog: DiscordDailyLog): DiscordHistory {
  const now = new Date();
  const entries = rawLog.entries;

  // Load existing history to preserve any backfilled data
  const existingHistory = loadExistingHistory();

  // Daily: last 90 days from raw log
  const dailyCutoff = new Date(now);
  dailyCutoff.setDate(dailyCutoff.getDate() - DAILY_RETENTION_DAYS);
  const dailyCutoffStr = dailyCutoff.toISOString().split('T')[0];

  const daily = entries
    .filter(e => e.date >= dailyCutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Weekly: preserve existing + add new from raw log
  let weekly: DiscordDataPoint[];
  if (existingHistory?.weekly?.length) {
    const existingWeeklyMap = new Map(existingHistory.weekly.map(w => [w.date, w]));
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - WEEKLY_RETENTION_DAYS);
    const weeklyCutoffStr = weeklyCutoff.toISOString().split('T')[0];
    const weeklyEntries = entries.filter(e => e.date >= weeklyCutoffStr);
    const newWeekly = aggregateByPeriod(weeklyEntries, getWeekKey);
    for (const entry of newWeekly) {
      existingWeeklyMap.set(entry.date, { ...entry, source: 'daily-log' });
    }
    weekly = Array.from(existingWeeklyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - WEEKLY_RETENTION_DAYS);
    const weeklyCutoffStr = weeklyCutoff.toISOString().split('T')[0];
    const weeklyEntries = entries.filter(e => e.date >= weeklyCutoffStr);
    weekly = aggregateByPeriod(weeklyEntries, getWeekKey);
  }

  // Monthly: preserve existing + add/update from raw log
  let monthly: DiscordDataPoint[];
  if (existingHistory?.monthly?.length) {
    const existingMonthlyMap = new Map(existingHistory.monthly.map(m => [m.date, m]));
    const newMonthly = aggregateByPeriod(entries, getMonthKey);
    for (const entry of newMonthly) {
      const existing = existingMonthlyMap.get(entry.date);
      if (!existing || !existing.source || existing.source === 'daily-log' || existing.source === 'discord-api') {
        existingMonthlyMap.set(entry.date, { ...entry, source: 'discord-api' });
      }
    }
    monthly = Array.from(existingMonthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } else {
    monthly = aggregateByPeriod(entries, getMonthKey);
  }

  return {
    lastUpdated: now.toISOString(),
    daily,
    weekly,
    monthly,
  };
}

async function main() {
  console.log('Updating Discord history...\n');

  // Ensure directories exist
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true });
    console.log('Created history directory');
  }

  // Load existing raw log
  const rawLog = loadRawLog();
  console.log(`Loaded ${rawLog.entries.length} existing entries`);

  // Fetch current stats
  console.log('Fetching current Discord stats...');
  const todayStats = await fetchDiscordStats();
  console.log(`  Members: ${todayStats.members.toLocaleString()}`);
  console.log(`  Online: ${todayStats.online?.toLocaleString() || 'N/A'}`);

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
