/**
 * Fill Gaps in Creator Stats History
 * ===================================
 *
 * This script fills gaps in the creators-stats.json weekly history by fetching
 * missing data points from the n8n Arena git repository history.
 *
 * BACKGROUND
 * ----------
 * The creators-stats.json file is populated by backfill-creators-history.ts which
 * samples one commit per ISO week from the n8n Arena repository. Sometimes weeks
 * are missed due to:
 * - ISO week boundary edge cases
 * - Holiday periods when source data wasn't updated
 * - Sampling algorithm quirks
 *
 * This script allows manual gap-filling by specifying target dates.
 *
 * USAGE
 * -----
 * 1. First, identify gaps in the data:
 *
 *    node -e "
 *    const data = require('./public/data/history/creators-stats.json');
 *    for (let i = 1; i < data.weekly.length; i++) {
 *      const prev = new Date(data.weekly[i-1].date);
 *      const curr = new Date(data.weekly[i].date);
 *      const days = Math.round((curr - prev) / (1000*60*60*24));
 *      if (days > 10) console.log(\`Gap: \${data.weekly[i-1].date} -> \${data.weekly[i].date} (\${days} days)\`);
 *    }
 *    "
 *
 * 2. Edit MISSING_DATES array below with approximate dates to fill
 *    (the script will find the closest commit within +/- 5 days)
 *
 * 3. Run the script:
 *    npx tsx scripts/fill-creator-gaps.ts
 *
 * 4. Verify the gaps are filled by running step 1 again
 *
 * NOTES
 * -----
 * - The script handles both old format (user.username) and new format (user_username)
 * - If n8n Arena didn't update their data during a period (e.g., holidays),
 *   those gaps cannot be filled - they represent real missing source data
 * - Uses GITHUB_TOKEN env var if available for higher rate limits
 * - Rate limited to 500ms between requests to be respectful to GitHub API
 *
 * DATA SOURCE
 * -----------
 * Repository: https://github.com/teds-tech-talks/n8n-community-leaderboard
 * File: stats_aggregate_creators.json
 * Attribution: https://n8narena.com
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const HISTORY_PATH = join(process.cwd(), 'public', 'data', 'history', 'creators-stats.json');

// Usernames to exclude (n8n team accounts and company/organization accounts)
const EXCLUDED_USERNAMES = [
  'n8n-team',           // Official n8n team account
  'oneclick-ai',        // Oneclick AI Squad (company)
  'oneclick-it',        // OneClick IT Consultancy P Limited (company)
];

const REPO_OWNER = 'teds-tech-talks';
const REPO_NAME = 'n8n-community-leaderboard';
const FILE_PATH = 'stats_aggregate_creators.json';

// How many days before/after the target date to search for commits
const SEARCH_RANGE_DAYS = 5;

// Rate limiting between GitHub API requests (ms)
const RATE_LIMIT_MS = 500;

interface CreatorStats {
  date: string;
  total: number;
  verified: number;
  totalViews: number;
  totalInserters: number;
  source: 'n8narena-git';
  commitSha: string;
}

/**
 * EDIT THIS ARRAY with the approximate dates you want to fill.
 * The script will find the closest commit within +/- SEARCH_RANGE_DAYS.
 *
 * Format: 'YYYY-MM-DD'
 *
 * Example: If you have a gap from 2025-04-13 to 2025-05-04 (21 days),
 * add the intermediate weeks:
 *   '2025-04-20',
 *   '2025-04-27',
 */
const MISSING_DATES: string[] = [
  // Add dates here when gaps are found
  // '2025-04-20',
  // '2025-04-27',
];

/**
 * Search for commits in the n8n Arena repo around the target date
 */
async function getCommitsForDate(targetDate: string): Promise<any> {
  const before = new Date(targetDate);
  before.setDate(before.getDate() + SEARCH_RANGE_DAYS);
  const after = new Date(targetDate);
  after.setDate(after.getDate() - SEARCH_RANGE_DAYS);

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${FILE_PATH}&per_page=30&until=${before.toISOString()}&since=${after.toISOString()}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'n8n-pulse',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const commits = await response.json();

  if (commits.length === 0) return null;

  // Find commit closest to target date
  const target = new Date(targetDate).getTime();
  let closest = commits[0];
  let closestDiff = Math.abs(new Date(commits[0].commit.author.date).getTime() - target);

  for (const commit of commits) {
    const commitDate = new Date(commit.commit.author.date).getTime();
    const diff = Math.abs(commitDate - target);
    if (diff < closestDiff) {
      closest = commit;
      closestDiff = diff;
    }
  }

  return closest;
}

/**
 * Fetch the raw creator stats file at a specific commit
 */
async function getFileAtCommit(sha: string): Promise<any[]> {
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${sha}/${FILE_PATH}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'n8n-pulse' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file at ${sha}: ${response.status}`);
  }

  return response.json();
}

/**
 * Calculate aggregate stats from raw creator data
 * Handles both old format (user.username) and new format (user_username)
 */
function calculateStats(data: any[], date: string, sha: string): CreatorStats {
  const getUsername = (c: any) => c.user_username || c.user?.username;
  const creators = data.filter((c: any) => {
    const username = getUsername(c);
    return username && !EXCLUDED_USERNAMES.includes(username);
  });

  return {
    date,
    total: creators.length,
    verified: creators.filter((c: any) => c.user?.verified).length,
    totalViews: creators.reduce((sum: number, c: any) => sum + (c.sum_unique_visitors || 0), 0),
    totalInserters: creators.reduce((sum: number, c: any) => sum + (c.sum_unique_inserters || 0), 0),
    source: 'n8narena-git',
    commitSha: sha.substring(0, 7),
  };
}

async function main() {
  if (MISSING_DATES.length === 0) {
    console.log('No dates specified in MISSING_DATES array.');
    console.log('Edit this script and add dates to fill, then run again.');
    console.log('\nTo find gaps, run:');
    console.log('  node -e "const d=require(\'./public/data/history/creators-stats.json\');for(let i=1;i<d.weekly.length;i++){const p=new Date(d.weekly[i-1].date),c=new Date(d.weekly[i].date),days=Math.round((c-p)/(1000*60*60*24));if(days>10)console.log(d.weekly[i-1].date+\' -> \'+d.weekly[i].date+\' (\'+days+\' days)\')}"');
    return;
  }

  console.log('Filling gaps in creator history...\n');
  console.log(`Searching for ${MISSING_DATES.length} dates with +/- ${SEARCH_RANGE_DAYS} day range\n`);

  // Load existing data
  const history = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
  const existingDates = new Set(history.weekly.map((w: any) => w.date));

  const newEntries: CreatorStats[] = [];

  for (const targetDate of MISSING_DATES) {
    console.log(`Looking for commit around ${targetDate}...`);

    const commit = await getCommitsForDate(targetDate);
    if (!commit) {
      console.log(`  -> No commit found (source may not have data for this period)`);
      continue;
    }

    const commitDate = commit.commit.author.date.split('T')[0];

    // Check if we already have this date
    if (existingDates.has(commitDate)) {
      console.log(`  -> Already have ${commitDate}`);
      continue;
    }

    console.log(`  -> Found commit ${commit.sha.substring(0, 7)} from ${commitDate}`);

    // Fetch and calculate stats
    const data = await getFileAtCommit(commit.sha);
    const stats = calculateStats(data, commitDate, commit.sha);
    newEntries.push(stats);
    existingDates.add(commitDate);

    console.log(`  -> ${stats.total} creators, ${stats.totalViews.toLocaleString()} views, ${stats.totalInserters.toLocaleString()} insertions`);

    // Rate limiting
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  if (newEntries.length === 0) {
    console.log('\nNo new entries to add.');
    return;
  }

  // Merge and sort chronologically
  history.weekly = [...history.weekly, ...newEntries].sort(
    (a: CreatorStats, b: CreatorStats) => a.date.localeCompare(b.date)
  );
  history.lastUpdated = new Date().toISOString();

  // Save
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log(`\nAdded ${newEntries.length} entries. Total: ${history.weekly.length} weeks.`);
}

main().catch(console.error);
