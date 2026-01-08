/**
 * Templates History Update Script
 *
 * This script runs before each build to:
 * 1. Fetch current template stats from n8n API
 * 2. Append to raw daily log
 * 3. Generate aggregated history (daily/weekly/monthly)
 *
 * Run with: npx tsx scripts/update-templates-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Types
interface TemplatesDataPoint {
  date: string;
  total: number;
  categories: Record<string, number>;
  topNodes: Array<{ name: string; count: number }>;
}

interface TemplatesHistory {
  lastUpdated: string;
  daily: TemplatesDataPoint[];
  weekly: TemplatesDataPoint[];
  monthly: TemplatesDataPoint[];
}

interface TemplatesDailyLog {
  entries: TemplatesDataPoint[];
}

interface ApiFilter {
  field_name: string;
  counts: Array<{ value: string; count: number }>;
}

// Paths
const DATA_DIR = join(process.cwd(), 'public', 'data');
const RAW_LOG_PATH = join(DATA_DIR, 'templates-raw-log.json');
const HISTORY_PATH = join(DATA_DIR, 'templates-history.json');

// Config
const DAILY_RETENTION_DAYS = 90;
const WEEKLY_RETENTION_DAYS = 730; // ~2 years

async function fetchTemplatesStats(): Promise<TemplatesDataPoint> {
  const response = await fetch('https://api.n8n.io/api/templates/search?rows=1', {
    headers: {
      'User-Agent': 'n8n-stats',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract category counts from filters
  const categoryFilter = data.filters?.find((f: ApiFilter) => f.field_name === 'categories');
  const categories: Record<string, number> = {};
  if (categoryFilter) {
    for (const item of categoryFilter.counts) {
      categories[item.value] = item.count;
    }
  }

  // Extract top node counts from filters
  const nodesFilter = data.filters?.find((f: ApiFilter) => f.field_name === 'apps');
  const topNodes: Array<{ name: string; count: number }> = [];
  if (nodesFilter) {
    for (const item of nodesFilter.counts.slice(0, 20)) {
      topNodes.push({ name: item.value, count: item.count });
    }
  }

  return {
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    total: data.totalWorkflows,
    categories,
    topNodes,
  };
}

function loadRawLog(): TemplatesDailyLog {
  if (!existsSync(RAW_LOG_PATH)) {
    return { entries: [] };
  }
  const content = readFileSync(RAW_LOG_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveRawLog(log: TemplatesDailyLog): void {
  writeFileSync(RAW_LOG_PATH, JSON.stringify(log, null, 2));
}

function saveHistory(history: TemplatesHistory): void {
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
  entries: TemplatesDataPoint[],
  getKey: (date: string) => string
): TemplatesDataPoint[] {
  const grouped = new Map<string, TemplatesDataPoint[]>();

  for (const entry of entries) {
    const key = getKey(entry.date);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  // For each period, take the last entry (most recent for cumulative metrics)
  const aggregated: TemplatesDataPoint[] = [];
  for (const [key, periodEntries] of grouped) {
    const lastEntry = periodEntries[periodEntries.length - 1];
    aggregated.push({
      ...lastEntry,
      date: key,
    });
  }

  return aggregated.sort((a, b) => a.date.localeCompare(b.date));
}

function generateHistory(rawLog: TemplatesDailyLog): TemplatesHistory {
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
  console.log('Updating templates history...\n');

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory');
  }

  // Load existing raw log
  const rawLog = loadRawLog();
  console.log(`Loaded ${rawLog.entries.length} existing entries`);

  // Fetch current stats
  console.log('Fetching current template stats...');
  const todayStats = await fetchTemplatesStats();
  console.log(`  Total templates: ${todayStats.total.toLocaleString()}`);
  console.log(`  Categories tracked: ${Object.keys(todayStats.categories).length}`);
  console.log(`  Top nodes tracked: ${todayStats.topNodes.length}`);

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
