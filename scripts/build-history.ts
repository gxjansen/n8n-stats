/**
 * Build history files from snapshots and seed data
 * Transforms raw API responses into time series for frontend charts
 * Run after fetch-daily.ts and fetch-external.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'public', 'data');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');
const SEED_DIR = join(DATA_DIR, 'seed');
const HISTORY_DIR = join(DATA_DIR, 'history');
const EXTERNAL_DIR = join(DATA_DIR, 'external');

// Data point with source tracking
interface DataPoint {
  date: string;
  value: number;
  source: 'api' | 'external' | 'seed';
  sourceDetail?: string;
}

interface HistoryFile {
  lastUpdated: string;
  daily: DataPoint[];
  weekly: Array<{ date: string; value: number; source: string }>;
  monthly: Array<{ date: string; value: number; source: string }>;
}

interface GitHubHistory extends HistoryFile {
  daily: Array<DataPoint & { forks?: number; openIssues?: number }>;
}

interface CommunityHistory extends HistoryFile {
  daily: Array<DataPoint & { topics?: number; posts?: number; likes?: number }>;
}

interface TemplatesHistory {
  lastUpdated: string;
  daily: Array<{
    date: string;
    total: number;
    categories: Record<string, number>;
    topNodes: Array<{ name: string; count: number }>;
    source: string;
  }>;
}

interface CreatorsHistory {
  lastUpdated: string;
  totalCreators: number;
  verifiedCreators: number;
  totalViews: number;
  totalInserters: number;
  creators: Array<{
    username: string;
    name: string;
    verified: boolean;
    avatar: string;
    bio: string;
    links: string[];
    templateCount: number;
    totalViews: number;
    totalInserters: number;
    monthlyViews: number;
    monthlyInserters: number;
    weeklyViews: number;
    weeklyInserters: number;
  }>;
  _attribution: {
    source: string;
    url: string;
    fetchedAt: string;
  };
}

// Load all snapshot files
function loadSnapshots(): Map<string, any> {
  const snapshots = new Map();

  if (!existsSync(SNAPSHOTS_DIR)) {
    return snapshots;
  }

  const files = readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const date = file.replace('.json', '');
    const content = JSON.parse(readFileSync(join(SNAPSHOTS_DIR, file), 'utf-8'));
    snapshots.set(date, content);
  }

  console.log(`Loaded ${snapshots.size} snapshots`);
  return snapshots;
}

// Load seed data for historical backfill
function loadSeedData(filename: string): DataPoint[] {
  const seedPath = join(SEED_DIR, filename);

  if (!existsSync(seedPath)) {
    return [];
  }

  const data = JSON.parse(readFileSync(seedPath, 'utf-8'));
  console.log(`Loaded ${data.length} seed data points from ${filename}`);
  return data;
}

// Load existing history to preserve old data
function loadExistingHistory(filename: string): any {
  const historyPath = join(HISTORY_DIR, filename);

  if (!existsSync(historyPath)) {
    return null;
  }

  return JSON.parse(readFileSync(historyPath, 'utf-8'));
}

// Aggregate daily data to weekly
function aggregateToWeekly(daily: DataPoint[]): Array<{ date: string; value: number; source: string }> {
  const weeks = new Map<string, { values: number[]; sources: Set<string> }>();

  for (const point of daily) {
    const date = new Date(point.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-W${String(week).padStart(2, '0')}`;

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, { values: [], sources: new Set() });
    }

    const w = weeks.get(weekKey)!;
    w.values.push(point.value);
    w.sources.add(point.source);
  }

  return Array.from(weeks.entries())
    .map(([date, { values, sources }]) => ({
      date,
      value: values[values.length - 1], // Use last value of week
      source: sources.has('api') ? 'api' : Array.from(sources)[0],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Aggregate daily data to monthly
function aggregateToMonthly(daily: DataPoint[]): Array<{ date: string; value: number; source: string }> {
  const months = new Map<string, { values: number[]; sources: Set<string> }>();

  for (const point of daily) {
    const monthKey = point.date.slice(0, 7); // YYYY-MM

    if (!months.has(monthKey)) {
      months.set(monthKey, { values: [], sources: new Set() });
    }

    const m = months.get(monthKey)!;
    m.values.push(point.value);
    m.sources.add(point.source);
  }

  return Array.from(months.entries())
    .map(([date, { values, sources }]) => ({
      date,
      value: values[values.length - 1], // Use last value of month
      source: sources.has('api') ? 'api' : Array.from(sources)[0],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Build GitHub history
function buildGitHubHistory(snapshots: Map<string, any>): GitHubHistory {
  const seedData = loadSeedData('github-stars.json');
  const existing = loadExistingHistory('github.json');

  // Start with seed data
  const daily: Array<DataPoint & { forks?: number; openIssues?: number }> = seedData.map(d => ({
    ...d,
    source: d.source || 'seed' as const,
    sourceDetail: d.sourceDetail || 'historical-import',
  }));

  // Add data from existing history that isn't in seed
  if (existing?.daily) {
    for (const point of existing.daily) {
      if (!daily.some(d => d.date === point.date)) {
        daily.push({
          date: point.date,
          value: point.stars || point.value,
          forks: point.forks,
          openIssues: point.openIssues,
          source: point.source || 'api',
          sourceDetail: point.sourceDetail,
        });
      }
    }
  }

  // Add data from snapshots
  for (const [date, snapshot] of snapshots) {
    if (snapshot.github && !daily.some(d => d.date === date)) {
      daily.push({
        date,
        value: snapshot.github.stars,
        forks: snapshot.github.forks,
        openIssues: snapshot.github.openIssues,
        source: 'api',
      });
    }
  }

  // Sort by date
  daily.sort((a, b) => a.date.localeCompare(b.date));

  return {
    lastUpdated: new Date().toISOString(),
    daily,
    weekly: aggregateToWeekly(daily),
    monthly: aggregateToMonthly(daily),
  };
}

// Build Community history
function buildCommunityHistory(snapshots: Map<string, any>): CommunityHistory {
  const seedData = loadSeedData('community.json');
  const existing = loadExistingHistory('community.json');

  const daily: Array<DataPoint & { topics?: number; posts?: number; likes?: number }> = seedData.map(d => ({
    ...d,
    source: d.source || 'seed' as const,
  }));

  // Add from existing
  if (existing?.daily) {
    for (const point of existing.daily) {
      if (!daily.some(d => d.date === point.date)) {
        daily.push({
          date: point.date,
          value: point.users || point.value,
          topics: point.topics,
          posts: point.posts,
          likes: point.likes,
          source: point.source || 'api',
        });
      }
    }
  }

  // Add from snapshots
  for (const [date, snapshot] of snapshots) {
    if (snapshot.discourse && !daily.some(d => d.date === date)) {
      daily.push({
        date,
        value: snapshot.discourse.users,
        topics: snapshot.discourse.topics,
        posts: snapshot.discourse.posts,
        likes: snapshot.discourse.likes,
        source: 'api',
      });
    }
  }

  daily.sort((a, b) => a.date.localeCompare(b.date));

  return {
    lastUpdated: new Date().toISOString(),
    daily,
    weekly: aggregateToWeekly(daily),
    monthly: aggregateToMonthly(daily),
  };
}

// Build Templates history
function buildTemplatesHistory(snapshots: Map<string, any>): TemplatesHistory {
  const existing = loadExistingHistory('templates.json');

  const daily: TemplatesHistory['daily'] = [];

  // Add from existing
  if (existing?.daily) {
    for (const point of existing.daily) {
      daily.push({
        date: point.date,
        total: point.total,
        categories: point.categories || {},
        topNodes: point.topNodes || [],
        source: point.source || 'api',
      });
    }
  }

  // Add from snapshots
  for (const [date, snapshot] of snapshots) {
    if (snapshot.templates && !daily.some(d => d.date === date)) {
      daily.push({
        date,
        total: snapshot.templates.total,
        categories: snapshot.templates.categories,
        topNodes: snapshot.templates.topNodes,
        source: 'api',
      });
    }
  }

  daily.sort((a, b) => a.date.localeCompare(b.date));

  return {
    lastUpdated: new Date().toISOString(),
    daily,
  };
}

// Build Events history for playground (normalized from events.json)
// Only includes past events - excludes future months to avoid skewing correlation statistics
interface EventsHistoryEntry {
  date: string;
  events: number;
  registrations: number;
  inPersonEvents: number;
  inPersonRegistrations: number;
  onlineEvents: number;
  onlineRegistrations: number;
}

function buildEventsHistory(): { monthly: EventsHistoryEntry[] } | null {
  const eventsPath = join(DATA_DIR, 'history', 'events.json');

  if (!existsSync(eventsPath)) {
    console.log('No events data found, skipping');
    return null;
  }

  const eventsData = JSON.parse(readFileSync(eventsPath, 'utf-8'));

  if (!eventsData.byMonth || !Array.isArray(eventsData.byMonth)) {
    console.log('No byMonth data in events.json, skipping');
    return null;
  }

  // Get current month in YYYY-MM format
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Transform to playground-compatible format, filtering out future months
  // Includes split data for in-person and online events
  const monthly = eventsData.byMonth
    .filter((m: { month: string }) => m.month <= currentMonth)
    .map((m: {
      month: string;
      count: number;
      registrations: number;
      inPersonCount?: number;
      inPersonRegistrations?: number;
      onlineCount?: number;
      onlineRegistrations?: number;
    }) => ({
      date: m.month, // Already in YYYY-MM format
      events: m.count,
      registrations: m.registrations,
      inPersonEvents: m.inPersonCount || 0,
      inPersonRegistrations: m.inPersonRegistrations || 0,
      onlineEvents: m.onlineCount || 0,
      onlineRegistrations: m.onlineRegistrations || 0,
    }));

  return { monthly };
}

// Build Creators history from n8n Arena
function buildCreatorsHistory(): CreatorsHistory {
  const creatorsPath = join(EXTERNAL_DIR, 'n8narena-creators.json');
  const metaPath = join(EXTERNAL_DIR, 'n8narena.meta.json');

  if (!existsSync(creatorsPath)) {
    console.log('No n8n Arena creators data found, skipping');
    return {
      lastUpdated: new Date().toISOString(),
      totalCreators: 0,
      verifiedCreators: 0,
      totalViews: 0,
      totalInserters: 0,
      creators: [],
      _attribution: {
        source: 'n8n Arena',
        url: 'https://n8narena.com',
        fetchedAt: '',
      },
    };
  }

  const creators = JSON.parse(readFileSync(creatorsPath, 'utf-8'));
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf-8')) : {};

  const totalViews = creators.reduce((sum: number, c: any) => sum + (c.totalViews || 0), 0);
  const totalInserters = creators.reduce((sum: number, c: any) => sum + (c.totalInserters || 0), 0);
  const verifiedCount = creators.filter((c: any) => c.verified).length;

  return {
    lastUpdated: new Date().toISOString(),
    totalCreators: creators.length,
    verifiedCreators: verifiedCount,
    totalViews,
    totalInserters,
    creators: creators.slice(0, 100), // Top 100 for the page
    _attribution: {
      source: 'n8n Arena',
      url: 'https://n8narena.com',
      fetchedAt: meta.fetchedAt || '',
    },
  };
}

async function main() {
  // Ensure history directory exists
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true });
  }

  // Load snapshots
  const snapshots = loadSnapshots();

  // Build each history file
  console.log('\nBuilding GitHub history...');
  const github = buildGitHubHistory(snapshots);
  writeFileSync(join(HISTORY_DIR, 'github.json'), JSON.stringify(github, null, 2));
  console.log(`  ${github.daily.length} daily, ${github.weekly.length} weekly, ${github.monthly.length} monthly`);

  console.log('\nBuilding Community history...');
  const community = buildCommunityHistory(snapshots);
  writeFileSync(join(HISTORY_DIR, 'community.json'), JSON.stringify(community, null, 2));
  console.log(`  ${community.daily.length} daily, ${community.weekly.length} weekly, ${community.monthly.length} monthly`);

  console.log('\nBuilding Templates history...');
  const templates = buildTemplatesHistory(snapshots);
  writeFileSync(join(HISTORY_DIR, 'templates.json'), JSON.stringify(templates, null, 2));
  console.log(`  ${templates.daily.length} daily entries`);

  console.log('\nBuilding Creators history...');
  const creators = buildCreatorsHistory();
  writeFileSync(join(HISTORY_DIR, 'creators.json'), JSON.stringify(creators, null, 2));
  console.log(`  ${creators.totalCreators} creators, ${creators.totalInserters.toLocaleString()} total inserters`);

  console.log('\nBuilding Events history...');
  const events = buildEventsHistory();
  if (events) {
    writeFileSync(join(HISTORY_DIR, 'events-history.json'), JSON.stringify(events, null, 2));
    console.log(`  ${events.monthly.length} monthly entries`);
  }

  console.log('\n--- Done ---');
  console.log(`History files written to ${HISTORY_DIR}`);
}

main().catch(console.error);
