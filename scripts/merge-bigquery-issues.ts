#!/usr/bin/env npx ts-node
/**
 * Merge BigQuery IssuesEvent data into github-history.json
 *
 * Calculates cumulative open issues from opened/closed counts
 * and fills in missing data.
 *
 * Run: npx ts-node scripts/merge-bigquery-issues.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, '../data/bquxjob_49f3cf2a_19ba8a31443.csv');
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

interface IssueData {
  opened: number;
  closed: number;
  cumulativeOpen: number;
}

function main() {
  console.log('Merging BigQuery IssuesEvent data into GitHub history...\n');

  // Read CSV
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.trim().split('\n').slice(1); // Skip header

  // Parse CSV and build cumulative totals
  const monthlyIssues = new Map<string, IssueData>();
  let cumulativeOpen = 0;

  for (const line of lines) {
    const [month, openedStr, closedStr] = line.split(',');
    const opened = parseInt(openedStr, 10);
    const closed = parseInt(closedStr, 10);
    cumulativeOpen += (opened - closed);

    monthlyIssues.set(month, {
      opened,
      closed,
      cumulativeOpen
    });
  }

  console.log(`Loaded ${monthlyIssues.size} months of issue data from BigQuery`);
  console.log(`Final cumulative open issues (BigQuery): ${cumulativeOpen}\n`);

  // Load history
  const historyData: GithubHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));

  // Find a reference point where we have real data to calibrate
  // Use the most recent github-api data point
  const apiEntry = historyData.monthly.find(e => e.source === 'github-api' && e.openIssues > 0);

  let calibrationOffset = 0;
  if (apiEntry) {
    const bigqueryData = monthlyIssues.get(apiEntry.date);
    if (bigqueryData) {
      calibrationOffset = apiEntry.openIssues - bigqueryData.cumulativeOpen;
      console.log(`Calibration: ${apiEntry.date} has ${apiEntry.openIssues} real open issues`);
      console.log(`BigQuery cumulative at that point: ${bigqueryData.cumulativeOpen}`);
      console.log(`Offset to apply: ${calibrationOffset}\n`);
    }
  }

  // Compare and show differences
  console.log('Comparison of BigQuery vs existing (Wayback) open issues:\n');
  console.log('Month      | Existing | BigQuery | Calibrated | Diff');
  console.log('-----------|----------|----------|------------|------');

  let updated = 0;
  let compared = 0;

  for (const entry of historyData.monthly) {
    const bigqueryData = monthlyIssues.get(entry.date);

    if (bigqueryData) {
      const calibratedValue = bigqueryData.cumulativeOpen + calibrationOffset;

      if (entry.openIssues > 0) {
        // Compare with existing data
        const diff = entry.openIssues - calibratedValue;
        compared++;
        if (Math.abs(diff) > 20) {
          console.log(`${entry.date}   | ${entry.openIssues.toString().padStart(8)} | ${bigqueryData.cumulativeOpen.toString().padStart(8)} | ${calibratedValue.toString().padStart(10)} | ${diff}`);
        }
      } else {
        // Fill in missing data
        entry.openIssues = Math.max(0, calibratedValue); // Ensure non-negative
        if (entry.sourceDetail === 'api.ossinsight.io') {
          entry.sourceDetail = 'ossinsight+bigquery';
        } else if (!entry.sourceDetail.includes('bigquery')) {
          entry.sourceDetail = entry.sourceDetail + '+bigquery';
        }
        updated++;
        console.log(`${entry.date}   | ${'-'.padStart(8)} | ${bigqueryData.cumulativeOpen.toString().padStart(8)} | ${calibratedValue.toString().padStart(10)} | SET`);
      }
    }
  }

  // Update timestamp
  historyData.lastUpdated = new Date().toISOString();

  // Save
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));

  console.log(`\nMerge complete!`);
  console.log(`  Updated: ${updated} months`);
  console.log(`  Compared with existing: ${compared} months`);

  // Show coverage
  const monthsWithIssues = historyData.monthly.filter(m => m.openIssues > 0).length;
  console.log(`\nOpen Issues coverage: ${monthsWithIssues}/${historyData.monthly.length} months`);
}

main();
