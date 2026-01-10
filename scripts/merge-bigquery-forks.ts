#!/usr/bin/env npx ts-node
/**
 * Merge BigQuery fork data into github-history.json
 *
 * Takes the monthly fork counts from BigQuery and calculates cumulative
 * totals to fill in missing fork data in the history.
 *
 * Run: npx ts-node scripts/merge-bigquery-forks.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, '../data/bquxjob_25decbde_19ba89bb058.csv');
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
  console.log('Merging BigQuery fork data into GitHub history...\n');

  // Read CSV
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.trim().split('\n').slice(1); // Skip header

  // Parse CSV and build cumulative totals
  const monthlyForks = new Map<string, number>();
  let cumulative = 0;

  for (const line of lines) {
    const [month, countStr] = line.split(',');
    const count = parseInt(countStr, 10);
    cumulative += count;
    monthlyForks.set(month, cumulative);
  }

  console.log(`Loaded ${monthlyForks.size} months of fork data from BigQuery`);
  console.log(`Total cumulative forks: ${cumulative}\n`);

  // Load history
  const historyData: GithubHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));

  // Track changes
  let updated = 0;
  let skipped = 0;

  // Merge into monthly data
  for (const entry of historyData.monthly) {
    const bigqueryForks = monthlyForks.get(entry.date);

    if (bigqueryForks !== undefined) {
      // Only update if current forks is 0 (missing)
      if (entry.forks === 0) {
        entry.forks = bigqueryForks;
        // Update source detail
        if (entry.sourceDetail === 'api.ossinsight.io') {
          entry.sourceDetail = 'ossinsight+bigquery';
        } else if (entry.sourceDetail === 'ossinsight+wayback') {
          entry.sourceDetail = 'ossinsight+wayback+bigquery';
        }
        updated++;
        console.log(`  ${entry.date}: Set forks to ${bigqueryForks}`);
      } else {
        // Compare with existing data
        const diff = Math.abs(entry.forks - bigqueryForks);
        const pctDiff = (diff / entry.forks * 100).toFixed(1);
        if (diff > 10) {
          console.log(`  ${entry.date}: Kept existing ${entry.forks}, BigQuery has ${bigqueryForks} (${pctDiff}% diff)`);
        }
        skipped++;
      }
    }
  }

  // Update timestamp
  historyData.lastUpdated = new Date().toISOString();

  // Save
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));

  console.log(`\nMerge complete!`);
  console.log(`  Updated: ${updated} months`);
  console.log(`  Skipped (already had data): ${skipped} months`);

  // Show coverage
  const monthsWithForks = historyData.monthly.filter(m => m.forks > 0).length;
  console.log(`\nFork coverage: ${monthsWithForks}/${historyData.monthly.length} months`);
}

main();
