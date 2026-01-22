/**
 * Backfill creator history from n8n Arena git history
 * Fetches weekly snapshots from their GitHub repository
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HISTORY_PATH = join(process.cwd(), 'public', 'data', 'history', 'creators-stats.json');

// Usernames to exclude (n8n team accounts and company/organization accounts)
const EXCLUDED_USERNAMES = [
  'n8n-team',           // Official n8n team account
  'oneclick-ai',        // Oneclick AI Squad (company)
  'oneclick-it',        // OneClick IT Consultancy P Limited (company)
  'weblineindia',       // WeblineIndia (company)
];

const REPO_OWNER = 'teds-tech-talks';
const REPO_NAME = 'n8n-community-leaderboard';
const FILE_PATH = 'stats_aggregate_creators.json';

interface CreatorStats {
  date: string;
  total: number;
  verified: number;
  totalViews: number;
  totalInserters: number;
  source: 'n8narena-git';
  commitSha: string;
}

interface CreatorsHistory {
  lastUpdated: string;
  dataSource: {
    name: string;
    repository: string;
    attribution: string;
  };
  daily: CreatorStats[];
  weekly: CreatorStats[];
}

async function getCommits(page: number = 1): Promise<any[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${FILE_PATH}&per_page=100&page=${page}`;

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

  return response.json();
}

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

function calculateStats(data: any[], date: string, sha: string): CreatorStats {
  const creators = data.filter((c: any) => c.user_username && !EXCLUDED_USERNAMES.includes(c.user_username));

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

function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function main() {
  console.log('Backfilling creator history from n8n Arena git history...\n');

  // Collect all commits
  const allCommits: any[] = [];
  let page = 1;

  while (true) {
    console.log(`Fetching commits page ${page}...`);
    const commits = await getCommits(page);
    if (commits.length === 0) break;
    allCommits.push(...commits);
    page++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`Found ${allCommits.length} total commits\n`);

  // Select weekly snapshots (one per week, preferring Sunday/Monday)
  const weeklyCommits = new Map<string, any>();

  for (const commit of allCommits) {
    const date = new Date(commit.commit.author.date);
    const weekKey = getWeekNumber(date);

    // Keep the first commit of each week (most recent for that week)
    if (!weeklyCommits.has(weekKey)) {
      weeklyCommits.set(weekKey, commit);
    }
  }

  console.log(`Selected ${weeklyCommits.size} weekly snapshots\n`);

  // Fetch data for each weekly commit
  const weeklyStats: CreatorStats[] = [];
  const sortedWeeks = Array.from(weeklyCommits.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [week, commit] of sortedWeeks) {
    const dateStr = commit.commit.author.date.split('T')[0];
    console.log(`Fetching ${week} (${dateStr})...`);

    try {
      const data = await getFileAtCommit(commit.sha);
      const stats = calculateStats(data, dateStr, commit.sha);
      weeklyStats.push(stats);
      console.log(`  -> ${stats.total} creators (${stats.verified} verified)`);
    } catch (error) {
      console.error(`  -> Error: ${error}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  // Also get most recent as daily entry
  const latestCommit = allCommits[0];
  const latestDate = latestCommit.commit.author.date.split('T')[0];
  console.log(`\nFetching latest (${latestDate})...`);

  const latestData = await getFileAtCommit(latestCommit.sha);
  const latestStats = calculateStats(latestData, latestDate, latestCommit.sha);

  // Build history object
  const history: CreatorsHistory = {
    lastUpdated: new Date().toISOString(),
    dataSource: {
      name: 'n8n Arena',
      repository: `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
      attribution: 'https://n8narena.com',
    },
    daily: [latestStats],
    weekly: weeklyStats,
  };

  // Save
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log(`\nSaved ${weeklyStats.length} weekly entries to ${HISTORY_PATH}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Earliest: ${weeklyStats[0]?.date} - ${weeklyStats[0]?.total} creators`);
  console.log(`Latest: ${weeklyStats[weeklyStats.length - 1]?.date} - ${weeklyStats[weeklyStats.length - 1]?.total} creators`);

  const growth = weeklyStats.length >= 2
    ? weeklyStats[weeklyStats.length - 1].total - weeklyStats[0].total
    : 0;
  console.log(`Growth: +${growth} creators over ${weeklyStats.length} weeks`);
}

main().catch(console.error);
