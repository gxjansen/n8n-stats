/**
 * Fetch daily snapshots from all primary APIs
 * Stores raw API responses in data/snapshots/YYYY-MM-DD.json
 * Run daily via GitHub Actions
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SNAPSHOTS_DIR = join(process.cwd(), 'public', 'data', 'snapshots');

// Usernames to exclude (n8n team accounts and company/organization accounts)
const EXCLUDED_USERNAMES = [
  'n8n-team',           // Official n8n team account
  'oneclick-ai',        // Oneclick AI Squad (company)
  'oneclick-it',        // OneClick IT Consultancy P Limited (company)
  'weblineindia',       // WeblineIndia (company)
];

// API endpoints
const APIS = {
  github: 'https://api.github.com/repos/n8n-io/n8n',
  discourse: 'https://community.n8n.io/about.json',
  npm: 'https://api.npmjs.org/downloads/point/last-month/n8n',
  templates: 'https://api.n8n.io/api/templates/search?rows=1', // Just for total count
  creators: 'https://raw.githubusercontent.com/teds-tech-talks/n8n-community-leaderboard/main/stats_aggregate_creators.json',
};

interface GitHubSnapshot {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  subscribers: number;
}

interface DiscourseSnapshot {
  users: number;
  topics: number;
  posts: number;
  likes: number;
  activeUsers7d: number;
  activeUsers30d: number;
}

interface NpmSnapshot {
  downloads: number;
  period: string;
}

interface TemplatesSnapshot {
  total: number;
  categories: Record<string, number>;
  topNodes: Array<{ name: string; count: number }>;
}

interface CreatorsSnapshot {
  total: number;
  verified: number;
  totalViews: number;
  totalInserters: number;
}

interface DailySnapshot {
  date: string;
  fetchedAt: string;
  github: GitHubSnapshot;
  discourse: DiscourseSnapshot;
  npm: NpmSnapshot;
  templates: TemplatesSnapshot;
  creators: CreatorsSnapshot;
  _meta: {
    sources: string[];
    errors: string[];
  };
}

async function fetchGitHub(): Promise<GitHubSnapshot> {
  console.log('Fetching GitHub stats...');

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'n8n-stats',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(APIS.github, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    watchers: data.watchers_count,
    openIssues: data.open_issues_count,
    subscribers: data.subscribers_count,
  };
}

async function fetchDiscourse(): Promise<DiscourseSnapshot> {
  console.log('Fetching Discourse stats...');

  const response = await fetch(APIS.discourse, {
    headers: { 'User-Agent': 'n8n-stats' },
  });

  if (!response.ok) {
    throw new Error(`Discourse API error: ${response.status}`);
  }

  const data = await response.json();
  const stats = data.about?.stats || {};

  return {
    users: stats.users_count || 0,
    topics: stats.topics_count || 0,
    posts: stats.posts_count || 0,
    likes: stats.likes_count || 0,
    activeUsers7d: stats.active_users_7_days || 0,
    activeUsers30d: stats.active_users_30_days || 0,
  };
}

async function fetchNpm(): Promise<NpmSnapshot> {
  console.log('Fetching npm stats...');

  const response = await fetch(APIS.npm, {
    headers: { 'User-Agent': 'n8n-stats' },
  });

  if (!response.ok) {
    throw new Error(`npm API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    downloads: data.downloads || 0,
    period: `${data.start} - ${data.end}`,
  };
}

async function fetchTemplates(): Promise<TemplatesSnapshot> {
  console.log('Fetching template stats...');

  const response = await fetch(APIS.templates, {
    headers: { 'User-Agent': 'n8n-stats' },
  });

  if (!response.ok) {
    throw new Error(`n8n Templates API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract categories from filters
  const categoryFilter = data.filters?.find((f: any) => f.field_name === 'categories');
  const categories: Record<string, number> = {};
  for (const c of categoryFilter?.counts || []) {
    categories[c.value] = c.count;
  }

  // Extract top nodes from filters
  const nodesFilter = data.filters?.find((f: any) => f.field_name === 'apps');
  const topNodes = (nodesFilter?.counts || [])
    .slice(0, 10)
    .map((n: any) => ({ name: n.value, count: n.count }));

  return {
    total: data.totalWorkflows || 0,
    categories,
    topNodes,
  };
}

async function fetchCreators(): Promise<CreatorsSnapshot> {
  console.log('Fetching creators stats (n8n Arena)...');

  const response = await fetch(APIS.creators, {
    headers: { 'User-Agent': 'n8n-pulse' },
  });

  if (!response.ok) {
    throw new Error(`n8n Arena API error: ${response.status}`);
  }

  const data = await response.json();

  // Filter out excluded accounts (n8n team and companies)
  const creators = data.filter((c: any) => c.user_username && !EXCLUDED_USERNAMES.includes(c.user_username));

  const total = creators.length;
  const verified = creators.filter((c: any) => c.user?.verified).length;
  const totalViews = creators.reduce((sum: number, c: any) => sum + (c.sum_unique_visitors || 0), 0);
  const totalInserters = creators.reduce((sum: number, c: any) => sum + (c.sum_unique_inserters || 0), 0);

  return {
    total,
    verified,
    totalViews,
    totalInserters,
  };
}

async function main() {
  const today = new Date().toISOString().split('T')[0];

  // Ensure directory exists
  if (!existsSync(SNAPSHOTS_DIR)) {
    mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  const snapshot: DailySnapshot = {
    date: today,
    fetchedAt: new Date().toISOString(),
    github: { stars: 0, forks: 0, watchers: 0, openIssues: 0, subscribers: 0 },
    discourse: { users: 0, topics: 0, posts: 0, likes: 0, activeUsers7d: 0, activeUsers30d: 0 },
    npm: { downloads: 0, period: '' },
    templates: { total: 0, categories: {}, topNodes: [] },
    creators: { total: 0, verified: 0, totalViews: 0, totalInserters: 0 },
    _meta: {
      sources: [],
      errors: [],
    },
  };

  // Fetch each source, continue on error
  try {
    snapshot.github = await fetchGitHub();
    snapshot._meta.sources.push('github');
    console.log(`  GitHub: ${snapshot.github.stars.toLocaleString()} stars`);
  } catch (error) {
    console.error('  GitHub error:', error);
    snapshot._meta.errors.push(`github: ${error}`);
  }

  try {
    snapshot.discourse = await fetchDiscourse();
    snapshot._meta.sources.push('discourse');
    console.log(`  Discourse: ${snapshot.discourse.users.toLocaleString()} users`);
  } catch (error) {
    console.error('  Discourse error:', error);
    snapshot._meta.errors.push(`discourse: ${error}`);
  }

  try {
    snapshot.npm = await fetchNpm();
    snapshot._meta.sources.push('npm');
    console.log(`  npm: ${snapshot.npm.downloads.toLocaleString()} downloads`);
  } catch (error) {
    console.error('  npm error:', error);
    snapshot._meta.errors.push(`npm: ${error}`);
  }

  try {
    snapshot.templates = await fetchTemplates();
    snapshot._meta.sources.push('templates');
    console.log(`  Templates: ${snapshot.templates.total.toLocaleString()} total`);
  } catch (error) {
    console.error('  Templates error:', error);
    snapshot._meta.errors.push(`templates: ${error}`);
  }

  try {
    snapshot.creators = await fetchCreators();
    snapshot._meta.sources.push('creators');
    console.log(`  Creators: ${snapshot.creators.total.toLocaleString()} total (${snapshot.creators.verified} verified)`);
  } catch (error) {
    console.error('  Creators error:', error);
    snapshot._meta.errors.push(`creators: ${error}`);
  }

  // Save snapshot
  const snapshotPath = join(SNAPSHOTS_DIR, `${today}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSaved snapshot to ${snapshotPath}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Date: ${today}`);
  console.log(`Sources fetched: ${snapshot._meta.sources.join(', ')}`);
  if (snapshot._meta.errors.length > 0) {
    console.log(`Errors: ${snapshot._meta.errors.length}`);
  }
}

main().catch(console.error);
