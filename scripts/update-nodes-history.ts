/**
 * Update Nodes History
 *
 * Tracks node usage over time from all-nodes-data.json snapshots.
 * Run weekly after fetch-all-nodes.ts to build historical trend data.
 *
 * Output: public/data/nodes-history.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'public', 'data');
const NODES_DATA_PATH = join(DATA_DIR, 'all-nodes-data.json');
const HISTORY_PATH = join(DATA_DIR, 'nodes-history.json');

interface NodeSnapshot {
  type: string;
  displayName: string;
  category: string;
  count: number;
  percentage: number;
}

interface AllNodesData {
  lastUpdated: string;
  totalTemplates: number;
  nodes: {
    total: number;
    withData: number;
    all: NodeSnapshot[];
  };
}

interface HistoryEntry {
  date: string;
  totalTemplates: number;
  nodes: Record<string, number>; // type -> count
}

interface NodesHistory {
  lastUpdated: string;
  entries: HistoryEntry[];
  // Aggregated stats for quick access
  nodeStats: Record<string, {
    displayName: string;
    category: string;
    currentCount: number;
    trend: 'up' | 'down' | 'stable' | 'new';
    change: number; // absolute change from previous week
    changePercent: number;
    history: { date: string; count: number }[];
  }>;
}

function loadCurrentData(): AllNodesData | null {
  try {
    return JSON.parse(readFileSync(NODES_DATA_PATH, 'utf-8'));
  } catch (e) {
    console.error('Failed to load all-nodes-data.json:', e);
    return null;
  }
}

function loadHistory(): NodesHistory {
  try {
    if (existsSync(HISTORY_PATH)) {
      return JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('Failed to load existing history, starting fresh');
  }

  return {
    lastUpdated: new Date().toISOString(),
    entries: [],
    nodeStats: {},
  };
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function updateHistory(): void {
  console.log('Updating nodes history...\n');

  const currentData = loadCurrentData();
  if (!currentData) {
    console.error('No current node data available');
    process.exit(1);
  }

  const history = loadHistory();
  const today = getDateKey(new Date(currentData.lastUpdated));

  console.log(`Loaded ${history.entries.length} existing entries`);
  console.log(`Current data from: ${today}`);
  console.log(`Total templates: ${currentData.totalTemplates}`);
  console.log(`Nodes with data: ${currentData.nodes.withData}\n`);

  // Check if we already have an entry for today
  const existingIndex = history.entries.findIndex(e => e.date === today);

  // Create new entry
  const newEntry: HistoryEntry = {
    date: today,
    totalTemplates: currentData.totalTemplates,
    nodes: {},
  };

  // Populate node counts
  for (const node of currentData.nodes.all) {
    newEntry.nodes[node.type] = node.count;
  }

  // Add or update entry
  if (existingIndex >= 0) {
    console.log(`Updating existing entry for ${today}`);
    history.entries[existingIndex] = newEntry;
  } else {
    console.log(`Adding new entry for ${today}`);
    history.entries.push(newEntry);
  }

  // Sort entries by date
  history.entries.sort((a, b) => a.date.localeCompare(b.date));

  // Keep last 52 weeks of data (1 year)
  if (history.entries.length > 52) {
    history.entries = history.entries.slice(-52);
  }

  // Update node stats
  history.nodeStats = {};
  const previousEntry = history.entries.length > 1
    ? history.entries[history.entries.length - 2]
    : null;

  for (const node of currentData.nodes.all) {
    const nodeHistory = history.entries.map(e => ({
      date: e.date,
      count: e.nodes[node.type] || 0,
    }));

    const previousCount = previousEntry?.nodes[node.type] || 0;
    const change = node.count - previousCount;
    const changePercent = previousCount > 0
      ? Math.round((change / previousCount) * 100)
      : (node.count > 0 ? 100 : 0);

    let trend: 'up' | 'down' | 'stable' | 'new' = 'stable';
    if (!previousEntry || previousCount === 0) {
      trend = 'new';
    } else if (change > 0) {
      trend = 'up';
    } else if (change < 0) {
      trend = 'down';
    }

    history.nodeStats[node.type] = {
      displayName: node.displayName,
      category: node.category,
      currentCount: node.count,
      trend,
      change,
      changePercent,
      history: nodeHistory,
    };
  }

  // Update timestamp
  history.lastUpdated = new Date().toISOString();

  // Save history
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log(`\nSaved history with ${history.entries.length} entries`);
  console.log(`Tracking ${Object.keys(history.nodeStats).length} nodes`);

  // Show some stats
  if (previousEntry) {
    const trending = Object.entries(history.nodeStats)
      .filter(([_, stats]) => stats.trend === 'up' && stats.change > 10)
      .sort((a, b) => b[1].change - a[1].change)
      .slice(0, 5);

    if (trending.length > 0) {
      console.log('\nTop growing nodes:');
      for (const [type, stats] of trending) {
        console.log(`  ${stats.displayName}: +${stats.change} (+${stats.changePercent}%)`);
      }
    }
  }
}

updateHistory();
