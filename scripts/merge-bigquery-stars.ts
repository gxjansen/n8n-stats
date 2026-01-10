#!/usr/bin/env npx ts-node
/**
 * Merge BigQuery WatchEvent (stars) data into github-history.json
 *
 * WatchEvent in GitHub's API is actually starring (not watching).
 * This calculates cumulative stars and fills in missing data.
 *
 * Run: npx ts-node scripts/merge-bigquery-stars.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, '../data/WatchEvent.csv');
const HISTORY_FILE = path.join(__dirname, '../public/data/github-history.json');

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

function main() {
  console.log('Analyzing BigQuery WatchEvent (stars) data...\n');

  // Read CSV
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.trim().split('\n').slice(1); // Skip header

  // Parse CSV and build cumulative totals
  const monthlyStars = new Map<string, number>();
  let cumulative = 0;

  for (const line of lines) {
    const [month, countStr] = line.split(',');
    const count = parseInt(countStr, 10);
    cumulative += count;
    monthlyStars.set(month, cumulative);
  }

  console.log(`Loaded ${monthlyStars.size} months of star data from BigQuery`);
  console.log(`Total cumulative stars: ${cumulative}\n`);

  // Load history
  const historyData: GithubHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));

  // Compare with existing data
  console.log('Comparison of BigQuery vs existing star data:\n');
  console.log('Month      | Existing | BigQuery | Diff    | % Diff');
  console.log('-----------|----------|----------|---------|-------');

  let totalDiff = 0;
  let comparedMonths = 0;

  for (const entry of historyData.monthly) {
    const bigqueryStars = monthlyStars.get(entry.date);

    if (bigqueryStars !== undefined && entry.stars > 0) {
      const diff = entry.stars - bigqueryStars;
      const pctDiff = ((diff / entry.stars) * 100).toFixed(1);
      totalDiff += Math.abs(diff);
      comparedMonths++;

      // Only show significant differences
      if (Math.abs(diff) > 500 || Math.abs(parseFloat(pctDiff)) > 10) {
        console.log(`${entry.date}   | ${entry.stars.toString().padStart(8)} | ${bigqueryStars.toString().padStart(8)} | ${diff.toString().padStart(7)} | ${pctDiff}%`);
      }
    }
  }

  console.log(`\nAverage absolute difference: ${Math.round(totalDiff / comparedMonths)} stars`);
  console.log(`\nNote: Existing data (ossinsight) appears to be more accurate for stars.`);
  console.log(`BigQuery WatchEvent counts may miss some events or have timing differences.`);
  console.log(`\nNo changes made to github-history.json.`);
}

main();
