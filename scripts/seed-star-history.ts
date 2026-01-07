/**
 * Seed historical star data from star-history.com CSV export
 *
 * Run with: npx tsx scripts/seed-star-history.ts <path-to-csv>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface GitHubDataPoint {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
}

interface GitHubDailyLog {
  entries: GitHubDataPoint[];
}

const DATA_DIR = join(process.cwd(), 'public', 'data');
const RAW_LOG_PATH = join(DATA_DIR, 'github-raw-log.json');

function parseDate(dateStr: string): string {
  // Parse the verbose date format from star-history
  // e.g., "Mon Jun 24 2019 10:14:38 GMT+0200 (Central European Summer Time)"
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function parseCSV(csvContent: string): GitHubDataPoint[] {
  const lines = csvContent.trim().split('\n');
  const entries: GitHubDataPoint[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // CSV format: Repository,Date,Stars
    // Need to handle the complex date format with commas
    const match = line.match(/^([^,]+),(.+),(\d+)$/);
    if (!match) continue;

    const [, repo, dateStr, starsStr] = match;

    // Skip n8n/n8n (old repo name with 0 stars)
    if (repo === 'n8n/n8n') continue;

    const stars = parseInt(starsStr, 10);
    if (stars === 0) continue; // Skip zero entries

    const date = parseDate(dateStr);

    entries.push({
      date,
      stars,
      forks: 0,      // Historical data not available
      watchers: 0,   // Historical data not available
      openIssues: 0, // Historical data not available
    });
  }

  return entries;
}

function loadRawLog(): GitHubDailyLog {
  if (!existsSync(RAW_LOG_PATH)) {
    return { entries: [] };
  }
  const content = readFileSync(RAW_LOG_PATH, 'utf-8');
  return JSON.parse(content);
}

function saveRawLog(log: GitHubDailyLog): void {
  writeFileSync(RAW_LOG_PATH, JSON.stringify(log, null, 2));
}

function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/seed-star-history.ts <path-to-csv>');
    process.exit(1);
  }

  console.log('Seeding star history from CSV...\n');

  // Read CSV
  const csvContent = readFileSync(csvPath, 'utf-8');
  const starHistory = parseCSV(csvContent);
  console.log(`Parsed ${starHistory.length} historical data points from CSV`);

  // Load existing log
  const rawLog = loadRawLog();
  console.log(`Existing log has ${rawLog.entries.length} entries`);

  // Create a map of existing entries by date
  const existingByDate = new Map<string, GitHubDataPoint>();
  for (const entry of rawLog.entries) {
    existingByDate.set(entry.date, entry);
  }

  // Merge: historical data takes precedence for stars, keep other metrics from existing
  let added = 0;
  let updated = 0;

  for (const histEntry of starHistory) {
    const existing = existingByDate.get(histEntry.date);

    if (existing) {
      // Update stars if historical data has more (more accurate)
      if (histEntry.stars > 0) {
        existing.stars = histEntry.stars;
        updated++;
      }
    } else {
      // Add new historical entry
      existingByDate.set(histEntry.date, histEntry);
      added++;
    }
  }

  // Convert map back to sorted array
  rawLog.entries = Array.from(existingByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Save updated log
  saveRawLog(rawLog);

  console.log(`\nResult:`);
  console.log(`  Added: ${added} new entries`);
  console.log(`  Updated: ${updated} existing entries`);
  console.log(`  Total: ${rawLog.entries.length} entries`);

  console.log('\nNow run "npm run update-history" to regenerate aggregated history.');
}

main();
