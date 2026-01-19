/**
 * Community Nodes History Update Script
 *
 * This script runs after fetch-community-nodes.ts to:
 * 1. Read the current community-nodes.json snapshot
 * 2. Append to weekly history in community-nodes-history.json
 *
 * Data format follows playground standards (weekly array with date field).
 *
 * Run weekly: npx tsx scripts/update-community-nodes-history.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Types
interface CommunityNodesSnapshot {
  lastUpdated: string;
  totalPackages: number;
  totalDownloadsWeekly: number;
  totalDownloadsMonthly: number;
  byCategory: Record<string, number>;
  packages: Array<{
    name: string;
    downloadsWeekly: number;
    downloadsMonthly: number;
    category: string;
  }>;
}

interface WeeklyDataPoint {
  date: string; // YYYY-MM-DD (start of week)
  totalPackages: number;
  newPackages: number;
  totalDownloadsWeekly: number;
  totalDownloadsMonthly: number;
  byCategory: Record<string, number>;
  topPackages: Array<{
    name: string;
    downloadsWeekly: number;
  }>;
}

interface CommunityNodesHistory {
  lastUpdated: string;
  measuredSince: string;
  weekly: WeeklyDataPoint[];
}

// Paths
const DATA_DIR = join(process.cwd(), 'public', 'data');
const HISTORY_DIR = join(DATA_DIR, 'history');
const SNAPSHOT_PATH = join(DATA_DIR, 'community-nodes.json');
const HISTORY_PATH = join(HISTORY_DIR, 'community-nodes.json');

function getWeekStart(dateStr: string): string {
  // Get the Monday of the week containing this date
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function loadSnapshot(): CommunityNodesSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.log('No snapshot file found at', SNAPSHOT_PATH);
    return null;
  }
  const content = readFileSync(SNAPSHOT_PATH, 'utf-8');
  return JSON.parse(content);
}

function loadHistory(): CommunityNodesHistory {
  if (!existsSync(HISTORY_PATH)) {
    return {
      lastUpdated: new Date().toISOString(),
      measuredSince: new Date().toISOString().split('T')[0],
      weekly: [],
    };
  }
  const content = readFileSync(HISTORY_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveHistory(history: CommunityNodesHistory): void {
  // Ensure history directory exists
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true });
  }
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function main() {
  console.log('Updating community nodes history...\n');

  // Load current snapshot
  const snapshot = loadSnapshot();
  if (!snapshot) {
    console.log('Run fetch-community-nodes.ts first to create snapshot');
    process.exit(1);
  }

  console.log(`Snapshot date: ${snapshot.lastUpdated}`);
  console.log(`Total packages: ${snapshot.totalPackages.toLocaleString()}`);

  // Load existing history
  const history = loadHistory();
  console.log(`Existing history entries: ${history.weekly.length}`);

  // Get week start date for this snapshot
  const snapshotDate = snapshot.lastUpdated.split('T')[0];
  const weekStart = getWeekStart(snapshotDate);

  // Calculate new packages since last week (if we have history)
  let newPackages = 0;
  if (history.weekly.length > 0) {
    const lastEntry = history.weekly[history.weekly.length - 1];
    newPackages = Math.max(0, snapshot.totalPackages - lastEntry.totalPackages);
  }

  // Create data point for this week
  const dataPoint: WeeklyDataPoint = {
    date: weekStart,
    totalPackages: snapshot.totalPackages,
    newPackages,
    totalDownloadsWeekly: snapshot.totalDownloadsWeekly,
    totalDownloadsMonthly: snapshot.totalDownloadsMonthly,
    byCategory: snapshot.byCategory,
    topPackages: snapshot.packages.slice(0, 20).map(p => ({
      name: p.name,
      downloadsWeekly: p.downloadsWeekly,
    })),
  };

  // Check if we already have an entry for this week
  const existingIndex = history.weekly.findIndex(w => w.date === weekStart);
  if (existingIndex >= 0) {
    console.log(`\nUpdating existing entry for week ${weekStart}`);
    history.weekly[existingIndex] = dataPoint;
  } else {
    console.log(`\nAdding new entry for week ${weekStart}`);
    history.weekly.push(dataPoint);
    // Sort by date
    history.weekly.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Update metadata
  history.lastUpdated = new Date().toISOString();
  if (history.weekly.length > 0) {
    history.measuredSince = history.weekly[0].date;
  }

  // Save history
  saveHistory(history);

  console.log(`\nHistory summary:`);
  console.log(`  Total entries: ${history.weekly.length}`);
  console.log(`  Date range: ${history.weekly[0]?.date} to ${history.weekly[history.weekly.length - 1]?.date}`);
  console.log(`  New packages this week: ${newPackages}`);
  console.log(`\nSaved to ${HISTORY_PATH}`);
}

main();
