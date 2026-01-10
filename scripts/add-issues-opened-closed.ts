#!/usr/bin/env npx ts-node
/**
 * Add issuesOpened and issuesClosed fields to github-history.json
 *
 * Run: npx ts-node scripts/add-issues-opened-closed.ts
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
  issuesOpened?: number;
  issuesClosed?: number;
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
  console.log('Adding issuesOpened and issuesClosed to GitHub history...\n');

  // Read CSV
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.trim().split('\n').slice(1); // Skip header

  // Parse CSV into map
  const issueData = new Map<string, { opened: number; closed: number }>();

  for (const line of lines) {
    const [month, openedStr, closedStr] = line.split(',');
    issueData.set(month, {
      opened: parseInt(openedStr, 10),
      closed: parseInt(closedStr, 10)
    });
  }

  console.log(`Loaded ${issueData.size} months of issue data from BigQuery`);

  // Load history
  const historyData: GithubHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));

  let updated = 0;

  // Add to monthly data
  for (const entry of historyData.monthly) {
    const data = issueData.get(entry.date);
    if (data) {
      entry.issuesOpened = data.opened;
      entry.issuesClosed = data.closed;
      updated++;
    } else {
      // Set to 0 for months without data (very early months)
      entry.issuesOpened = 0;
      entry.issuesClosed = 0;
    }
  }

  // Update timestamp
  historyData.lastUpdated = new Date().toISOString();

  // Save
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));

  console.log(`\nUpdated ${updated} months with issuesOpened/issuesClosed`);
  console.log(`Saved to: ${HISTORY_FILE}`);
}

main();
