#!/usr/bin/env npx ts-node
/**
 * Merge Wayback Machine scraped data into github-history.json
 *
 * This script takes the backfilled data from github-wayback.json and merges
 * it into the main github-history.json, filling in missing forks, watchers,
 * and openIssues values.
 *
 * Run: npx ts-node scripts/merge-wayback-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WAYBACK_FILE = path.join(__dirname, '../public/data/seed/github-wayback.json');
const HISTORY_FILE = path.join(__dirname, '../public/data/github-history.json');

interface WaybackEntry {
  date: string;
  timestamp: string;
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  openIssues: number | null;
  source: 'wayback';
}

interface HistoryEntry {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  source: string;
  sourceDetail: string;
}

interface GithubHistory {
  lastUpdated: string;
  daily: HistoryEntry[];
  weekly: HistoryEntry[];
  monthly: HistoryEntry[];
}

interface WaybackData {
  lastUpdated: string;
  description: string;
  repo: string;
  data: WaybackEntry[];
}

function getMonthFromDate(dateStr: string): string {
  // Convert "2019-10-08" to "2019-10"
  return dateStr.slice(0, 7);
}

function main() {
  console.log('Merging Wayback data into GitHub history...\n');

  // Load both files
  const waybackData: WaybackData = JSON.parse(fs.readFileSync(WAYBACK_FILE, 'utf-8'));
  const historyData: GithubHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));

  // Create a map of Wayback data by month (using the closest data point to month start)
  const waybackByMonth = new Map<string, WaybackEntry>();
  for (const entry of waybackData.data) {
    const month = getMonthFromDate(entry.date);
    // Keep the first entry for each month (closest to month start)
    if (!waybackByMonth.has(month)) {
      waybackByMonth.set(month, entry);
    }
  }

  console.log(`Wayback data available for ${waybackByMonth.size} months`);
  console.log(`History has ${historyData.monthly.length} monthly entries\n`);

  // Track changes
  let forksAdded = 0;
  let watchersAdded = 0;
  let issuesAdded = 0;

  // Merge into monthly data
  for (const historyEntry of historyData.monthly) {
    const waybackEntry = waybackByMonth.get(historyEntry.date);

    if (waybackEntry) {
      // Fill in forks if missing (history has 0)
      if (historyEntry.forks === 0 && waybackEntry.forks !== null) {
        historyEntry.forks = waybackEntry.forks;
        forksAdded++;
      }

      // Fill in watchers if missing
      if (historyEntry.watchers === 0 && waybackEntry.watchers !== null) {
        historyEntry.watchers = waybackEntry.watchers;
        watchersAdded++;
      }

      // Fill in openIssues if missing
      if (historyEntry.openIssues === 0 && waybackEntry.openIssues !== null) {
        historyEntry.openIssues = waybackEntry.openIssues;
        issuesAdded++;
      }

      // Update source to indicate mixed sources if we added data
      if (historyEntry.source === 'ossinsight' &&
          (waybackEntry.forks !== null || waybackEntry.watchers !== null || waybackEntry.openIssues !== null)) {
        historyEntry.sourceDetail = 'ossinsight+wayback';
      }
    }
  }

  // Update timestamp
  historyData.lastUpdated = new Date().toISOString();

  // Save merged data
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));

  console.log('Merge complete!');
  console.log(`  Forks backfilled: ${forksAdded} months`);
  console.log(`  Watchers backfilled: ${watchersAdded} months`);
  console.log(`  Open Issues backfilled: ${issuesAdded} months`);
  console.log(`\nSaved to: ${HISTORY_FILE}`);

  // Show summary of data coverage
  const monthsWithForks = historyData.monthly.filter(m => m.forks > 0).length;
  const monthsWithWatchers = historyData.monthly.filter(m => m.watchers > 0).length;
  const monthsWithIssues = historyData.monthly.filter(m => m.openIssues > 0).length;

  console.log(`\nData coverage (monthly):`);
  console.log(`  Forks: ${monthsWithForks}/${historyData.monthly.length} months`);
  console.log(`  Watchers: ${monthsWithWatchers}/${historyData.monthly.length} months`);
  console.log(`  Open Issues: ${monthsWithIssues}/${historyData.monthly.length} months`);
}

main();
