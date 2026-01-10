#!/usr/bin/env npx ts-node
/**
 * Comprehensive merge script for all historical GitHub data
 *
 * Merges:
 * 1. Wayback Machine watchers data
 * 2. BigQuery fork data (cumulative)
 * 3. BigQuery issues opened/closed data
 * 4. Calculates cumulative open issues
 *
 * Run: npx ts-node scripts/merge-all-historical.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WAYBACK_FILE = path.join(__dirname, '../public/data/seed/github-wayback.json');
const FORKS_CSV = path.join(__dirname, '../data/ForkEvent.csv');
const ISSUES_CSV = path.join(__dirname, '../data/bquxjob_49f3cf2a_19ba8a31443.csv');
const HISTORY_FILE = path.join(__dirname, '../public/data/github-history.json');

// Known calibration values from GitHub API (2026-01)
const CALIBRATION_MONTH = '2026-01';
const ISSUES_CALIBRATION_VALUE = 1224;
const FORKS_CALIBRATION_VALUE = 53369; // BigQuery cumulative is 41860, so offset is 11509

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

interface WaybackEntry {
  date: string;
  watchers: number | null;
}

function getMonthFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function main() {
  console.log('=== Comprehensive Historical Data Merge ===\n');

  // Load history file
  const historyData: GithubHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  console.log(`Loaded history with ${historyData.monthly.length} monthly entries\n`);

  // ============================================
  // 1. MERGE WAYBACK WATCHERS
  // ============================================
  console.log('--- Step 1: Wayback Watchers ---');
  const waybackData = JSON.parse(fs.readFileSync(WAYBACK_FILE, 'utf-8'));
  const waybackByMonth = new Map<string, number>();

  for (const entry of waybackData.data) {
    const month = getMonthFromDate(entry.date);
    if (entry.watchers !== null && !waybackByMonth.has(month)) {
      waybackByMonth.set(month, entry.watchers);
    }
  }
  console.log(`  Found ${waybackByMonth.size} months with watchers data`);

  let watchersAdded = 0;
  for (const entry of historyData.monthly) {
    const watchers = waybackByMonth.get(entry.date);
    if (watchers !== undefined && entry.watchers === 0) {
      entry.watchers = watchers;
      watchersAdded++;
    }
  }
  console.log(`  Added watchers to ${watchersAdded} months\n`);

  // ============================================
  // 2. MERGE BIGQUERY FORKS (CUMULATIVE WITH CALIBRATION)
  // ============================================
  console.log('--- Step 2: BigQuery Forks ---');
  const forksContent = fs.readFileSync(FORKS_CSV, 'utf-8');
  const forksLines = forksContent.trim().split('\n').slice(1);

  const monthlyForkCounts = new Map<string, number>();
  for (const line of forksLines) {
    const [month, countStr] = line.split(',');
    monthlyForkCounts.set(month, parseInt(countStr, 10));
  }
  console.log(`  Found ${monthlyForkCounts.size} months of fork event data`);

  // Calculate cumulative forks
  const cumulativeForks = new Map<string, number>();
  let cumForks = 0;

  // Sort months and calculate cumulative
  const sortedMonths = Array.from(monthlyForkCounts.keys()).sort();
  for (const month of sortedMonths) {
    cumForks += monthlyForkCounts.get(month)!;
    cumulativeForks.set(month, cumForks);
  }

  // Interpolate 2025-11 if missing (gap between 2025-10 and 2025-12)
  if (!cumulativeForks.has('2025-11') && cumulativeForks.has('2025-10') && cumulativeForks.has('2025-12')) {
    const oct = cumulativeForks.get('2025-10')!;
    const dec = cumulativeForks.get('2025-12')!;
    const nov = Math.round((oct + dec) / 2);
    cumulativeForks.set('2025-11', nov);
    console.log(`  Interpolated 2025-11 forks: ${nov}`);
  }

  // Calculate calibration offset (BigQuery undercounts forks)
  const bigqueryCalibrationForks = cumulativeForks.get(CALIBRATION_MONTH);
  let forksCalibrationOffset = 0;
  if (bigqueryCalibrationForks !== undefined) {
    forksCalibrationOffset = FORKS_CALIBRATION_VALUE - bigqueryCalibrationForks;
    console.log(`  BigQuery cumulative at ${CALIBRATION_MONTH}: ${bigqueryCalibrationForks}`);
    console.log(`  Known API value: ${FORKS_CALIBRATION_VALUE}`);
    console.log(`  Calibration offset: ${forksCalibrationOffset}`);
  }

  let forksAdded = 0;
  for (const entry of historyData.monthly) {
    const rawForks = cumulativeForks.get(entry.date);
    if (rawForks !== undefined) {
      const calibratedForks = rawForks + forksCalibrationOffset;
      // Update if missing OR if this is historical data that needs calibration
      // (source is ossinsight, not github-api)
      if (entry.forks === 0 || (entry.source === 'ossinsight' && entry.forks !== calibratedForks)) {
        entry.forks = calibratedForks;
        forksAdded++;
      }
    }
  }
  console.log(`  Updated forks for ${forksAdded} months\n`);

  // ============================================
  // 3. MERGE BIGQUERY ISSUES OPENED/CLOSED
  // ============================================
  console.log('--- Step 3: BigQuery Issues Opened/Closed ---');
  const issuesContent = fs.readFileSync(ISSUES_CSV, 'utf-8');
  const issuesLines = issuesContent.trim().split('\n').slice(1);

  const issuesByMonth = new Map<string, { opened: number; closed: number }>();
  for (const line of issuesLines) {
    const [month, openedStr, closedStr] = line.split(',');
    issuesByMonth.set(month, {
      opened: parseInt(openedStr, 10),
      closed: parseInt(closedStr, 10)
    });
  }
  console.log(`  Found ${issuesByMonth.size} months of issue data`);

  let issuesFieldsAdded = 0;
  for (const entry of historyData.monthly) {
    const issues = issuesByMonth.get(entry.date);
    if (issues) {
      entry.issuesOpened = issues.opened;
      entry.issuesClosed = issues.closed;
      issuesFieldsAdded++;
    }
  }
  console.log(`  Added opened/closed to ${issuesFieldsAdded} months\n`);

  // ============================================
  // 4. CALCULATE CUMULATIVE OPEN ISSUES
  // ============================================
  console.log('--- Step 4: Cumulative Open Issues ---');

  // Calculate running total from BigQuery data
  const sortedIssueMonths = Array.from(issuesByMonth.keys()).sort();
  const cumulativeOpen = new Map<string, number>();
  let runningOpen = 0;

  for (const month of sortedIssueMonths) {
    const data = issuesByMonth.get(month)!;
    runningOpen += data.opened - data.closed;
    cumulativeOpen.set(month, runningOpen);
  }

  // Calculate calibration offset using known value
  const bigqueryValue = cumulativeOpen.get(CALIBRATION_MONTH);
  let issuesCalibrationOffset = 0;
  if (bigqueryValue !== undefined) {
    issuesCalibrationOffset = ISSUES_CALIBRATION_VALUE - bigqueryValue;
    console.log(`  BigQuery cumulative at ${CALIBRATION_MONTH}: ${bigqueryValue}`);
    console.log(`  Known API value: ${ISSUES_CALIBRATION_VALUE}`);
    console.log(`  Calibration offset: ${issuesCalibrationOffset}`);
  }

  let openIssuesAdded = 0;
  for (const entry of historyData.monthly) {
    const cumOpen = cumulativeOpen.get(entry.date);
    if (cumOpen !== undefined && entry.openIssues === 0) {
      entry.openIssues = cumOpen + issuesCalibrationOffset;
      openIssuesAdded++;
    }
  }
  console.log(`  Added open issues to ${openIssuesAdded} months\n`);

  // ============================================
  // 5. UPDATE SOURCE DETAILS
  // ============================================
  console.log('--- Step 5: Updating Source Details ---');
  let sourcesUpdated = 0;
  for (const entry of historyData.monthly) {
    // If we added any backfilled data, update source detail
    if (entry.source === 'ossinsight' && (
      waybackByMonth.has(entry.date) ||
      cumulativeForks.has(entry.date) ||
      issuesByMonth.has(entry.date)
    )) {
      const sources = ['ossinsight'];
      if (waybackByMonth.has(entry.date)) sources.push('wayback');
      if (cumulativeForks.has(entry.date) || issuesByMonth.has(entry.date)) sources.push('bigquery');
      entry.sourceDetail = sources.join('+');
      sourcesUpdated++;
    }
  }
  console.log(`  Updated ${sourcesUpdated} source details\n`);

  // ============================================
  // 6. SAVE
  // ============================================
  historyData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));

  // Final summary
  console.log('=== MERGE COMPLETE ===\n');
  console.log('Data coverage (monthly):');
  const total = historyData.monthly.length;
  const withStars = historyData.monthly.filter(m => m.stars > 0).length;
  const withForks = historyData.monthly.filter(m => m.forks > 0).length;
  const withWatchers = historyData.monthly.filter(m => m.watchers > 0).length;
  const withOpenIssues = historyData.monthly.filter(m => m.openIssues > 0).length;
  const withOpened = historyData.monthly.filter(m => m.issuesOpened !== undefined).length;

  console.log(`  Stars:        ${withStars}/${total} (${(withStars/total*100).toFixed(0)}%)`);
  console.log(`  Forks:        ${withForks}/${total} (${(withForks/total*100).toFixed(0)}%)`);
  console.log(`  Watchers:     ${withWatchers}/${total} (${(withWatchers/total*100).toFixed(0)}%)`);
  console.log(`  Open Issues:  ${withOpenIssues}/${total} (${(withOpenIssues/total*100).toFixed(0)}%)`);
  console.log(`  Opened/Closed: ${withOpened}/${total} (${(withOpened/total*100).toFixed(0)}%)`);
  console.log(`\nSaved to: ${HISTORY_FILE}`);
}

main();
