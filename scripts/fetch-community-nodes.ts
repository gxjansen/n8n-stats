/**
 * Fetch Community Nodes Script
 *
 * Fetches all n8n community node packages from npm registry.
 * Uses keyword search for "n8n-community-node-package" to find packages.
 *
 * Data flow:
 * 1. Search npm for packages with n8n-community-node-package keyword
 * 2. Batch fetch download counts (128 packages per request)
 * 3. Store in public/data/community-nodes.json
 *
 * Run weekly: npx tsx scripts/fetch-community-nodes.ts
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const NPM_SEARCH_API = 'https://registry.npmjs.org/-/v1/search';
const NPM_DOWNLOADS_API = 'https://api.npmjs.org/downloads/point';
const SEARCH_KEYWORD = 'n8n-community-node-package';
const PAGE_SIZE = 250; // Max allowed by npm
const DOWNLOAD_BATCH_SIZE = 50; // Smaller batches to avoid rate limits
const REQUEST_DELAY = 500; // ms between requests (increased for rate limiting)
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // ms to wait before retry after rate limit

const DATA_DIR = join(process.cwd(), 'public', 'data');
const OUTPUT_PATH = join(DATA_DIR, 'community-nodes.json');

// Category inference keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', 'llm', 'openai', 'gpt', 'anthropic', 'langchain', 'machine-learning', 'ml', 'chatgpt', 'ollama', 'embedding', 'vector'],
  'Database': ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'supabase', 'firebase', 'dynamodb', 'fauna', 'prisma'],
  'Communication': ['email', 'slack', 'telegram', 'whatsapp', 'sms', 'twilio', 'discord', 'teams', 'chat', 'messaging', 'notification'],
  'Cloud': ['aws', 'azure', 'gcp', 's3', 'lambda', 'cloudflare', 'digitalocean', 'vercel', 'netlify', 'heroku'],
  'DevTools': ['github', 'gitlab', 'bitbucket', 'docker', 'kubernetes', 'jenkins', 'ci', 'cd', 'git', 'jira', 'sentry'],
  'CRM': ['crm', 'hubspot', 'salesforce', 'pipedrive', 'zoho', 'freshdesk', 'zendesk', 'customer'],
  'E-Commerce': ['shopify', 'woocommerce', 'stripe', 'paypal', 'payment', 'ecommerce', 'store', 'order', 'magento'],
  'Social Media': ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'social', 'meta', 'bluesky'],
  'Productivity': ['notion', 'airtable', 'trello', 'asana', 'clickup', 'monday', 'todoist', 'calendar', 'sheets'],
  'Automation': ['webhook', 'http', 'api', 'automation', 'workflow', 'integration', 'trigger', 'schedule'],
  'Files': ['file', 'pdf', 'excel', 'csv', 'document', 'storage', 'drive', 'dropbox', 'box', 'onedrive'],
  'Finance': ['finance', 'accounting', 'invoice', 'quickbooks', 'xero', 'bank', 'crypto', 'bitcoin', 'ethereum'],
  'Marketing': ['mailchimp', 'sendgrid', 'marketing', 'campaign', 'newsletter', 'analytics', 'seo', 'ads'],
  'IoT': ['iot', 'mqtt', 'home-assistant', 'smart-home', 'sensor', 'device', 'raspberry', 'arduino'],
  'Security': ['auth', 'oauth', 'security', 'password', 'encryption', 'vault', 'keycloak', 'ldap'],
};

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  author: string;
  downloadsWeekly: number;
  downloadsMonthly: number;
  score: number;
  lastUpdated: string;
  repository?: string;
  category: string;
  keywords: string[];
}

interface CommunityNodesData {
  lastUpdated: string;
  fetchDuration: number;
  totalPackages: number;
  totalDownloadsWeekly: number;
  totalDownloadsMonthly: number;
  byCategory: Record<string, number>;
  packages: NpmPackage[];
}

interface NpmSearchResult {
  package: {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    date: string;
    links?: {
      repository?: string;
      npm?: string;
      homepage?: string;
    };
    publisher?: {
      username: string;
      email?: string;
    };
    maintainers?: Array<{ username: string }>;
  };
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}

interface NpmSearchResponse {
  objects: NpmSearchResult[];
  total: number;
}

interface DownloadsResponse {
  [packageName: string]: {
    downloads: number;
    start: string;
    end: string;
    package: string;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function inferCategory(name: string, description: string, keywords: string[]): string {
  const text = `${name} ${description} ${keywords.join(' ')}`.toLowerCase();

  for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Other';
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'n8n-stats' },
    });

    if (response.ok) {
      return response;
    }

    if (response.status === 429 && attempt < retries) {
      console.log(`\n  Rate limited, waiting ${RETRY_DELAY / 1000}s before retry ${attempt + 1}/${retries}...`);
      await sleep(RETRY_DELAY);
      continue;
    }

    throw new Error(`npm API error: ${response.status}`);
  }

  throw new Error('Max retries exceeded');
}

async function searchPackages(): Promise<NpmSearchResult[]> {
  const allPackages: NpmSearchResult[] = [];
  let from = 0;
  let total = 0;

  console.log('Searching npm for community node packages...\n');

  do {
    const url = `${NPM_SEARCH_API}?text=keywords:${SEARCH_KEYWORD}&size=${PAGE_SIZE}&from=${from}`;

    try {
      const response = await fetchWithRetry(url);
      const data: NpmSearchResponse = await response.json();

      if (from === 0) {
        total = data.total;
        console.log(`Found ${total.toLocaleString()} community node packages`);
      }

      allPackages.push(...data.objects);
      from += PAGE_SIZE;

      process.stdout.write(`\rFetched ${allPackages.length}/${total} packages`);

      if (data.objects.length < PAGE_SIZE) {
        break; // Last page
      }

      await sleep(REQUEST_DELAY);
    } catch (error) {
      console.error(`\nError fetching page at offset ${from}:`, error);
      break;
    }
  } while (from < total);

  console.log('\n');

  // Deduplicate packages by name (keep first occurrence with highest score)
  const seen = new Set<string>();
  const deduplicated = allPackages.filter(pkg => {
    if (seen.has(pkg.package.name)) {
      return false;
    }
    seen.add(pkg.package.name);
    return true;
  });

  if (deduplicated.length < allPackages.length) {
    console.log(`Deduplicated: ${allPackages.length} -> ${deduplicated.length} packages\n`);
  }

  return deduplicated;
}

async function fetchDownloadsIndividual(packageNames: string[], period: 'last-week' | 'last-month'): Promise<Map<string, number>> {
  const downloads = new Map<string, number>();

  // Fetch downloads individually for each package
  for (let i = 0; i < packageNames.length; i++) {
    const name = packageNames[i];
    const url = `${NPM_DOWNLOADS_API}/${period}/${encodeURIComponent(name)}`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'n8n-stats' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.downloads === 'number') {
          downloads.set(name, data.downloads);
        }
      }
    } catch {
      // Ignore individual package failures
    }

    if ((i + 1) % 50 === 0 || i === packageNames.length - 1) {
      process.stdout.write(`\rFetching ${period} downloads: ${i + 1}/${packageNames.length}`);
    }

    // Short delay between requests
    await sleep(100);
  }

  console.log('');
  return downloads;
}

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('n8n Community Nodes Fetch');
  console.log('='.repeat(60));
  console.log();

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Search for all packages
  const searchResults = await searchPackages();

  if (searchResults.length === 0) {
    console.log('No packages found');
    process.exit(1);
  }

  // Sort by npm score to prioritize important packages
  searchResults.sort((a, b) => b.score.final - a.score.final);

  // Get package names for download stats (top 500 by score to save time)
  const TOP_PACKAGES_FOR_DOWNLOADS = 500;
  const topPackageNames = searchResults.slice(0, TOP_PACKAGES_FOR_DOWNLOADS).map(r => r.package.name);

  // Fetch download counts for top packages only
  console.log(`Fetching download statistics for top ${TOP_PACKAGES_FOR_DOWNLOADS} packages by score...`);
  const weeklyDownloads = await fetchDownloadsIndividual(topPackageNames, 'last-week');
  const monthlyDownloads = await fetchDownloadsIndividual(topPackageNames, 'last-month');

  // Build package data
  const packages: NpmPackage[] = searchResults.map(result => {
    const pkg = result.package;
    const name = pkg.name;
    const description = pkg.description || '';
    const keywords = pkg.keywords || [];

    return {
      name,
      description: description.slice(0, 500), // Limit description length
      version: pkg.version,
      author: pkg.publisher?.username || pkg.maintainers?.[0]?.username || 'unknown',
      downloadsWeekly: weeklyDownloads.get(name) || 0,
      downloadsMonthly: monthlyDownloads.get(name) || 0,
      score: Math.round(result.score.final * 100) / 100,
      lastUpdated: pkg.date.split('T')[0],
      repository: pkg.links?.repository,
      category: inferCategory(name, description, keywords),
      keywords: keywords.slice(0, 10), // Limit keywords
    };
  });

  // Sort by weekly downloads descending
  packages.sort((a, b) => b.downloadsWeekly - a.downloadsWeekly);

  // Calculate category totals
  const byCategory: Record<string, number> = {};
  for (const pkg of packages) {
    byCategory[pkg.category] = (byCategory[pkg.category] || 0) + 1;
  }

  // Calculate totals
  const totalDownloadsWeekly = packages.reduce((sum, p) => sum + p.downloadsWeekly, 0);
  const totalDownloadsMonthly = packages.reduce((sum, p) => sum + p.downloadsMonthly, 0);

  const fetchDuration = Math.round((Date.now() - startTime) / 1000);

  // Build output data
  const data: CommunityNodesData = {
    lastUpdated: new Date().toISOString(),
    fetchDuration,
    totalPackages: packages.length,
    totalDownloadsWeekly,
    totalDownloadsMonthly,
    byCategory,
    packages,
  };

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total packages: ${packages.length.toLocaleString()}`);
  console.log(`Weekly downloads: ${totalDownloadsWeekly.toLocaleString()}`);
  console.log(`Monthly downloads: ${totalDownloadsMonthly.toLocaleString()}`);
  console.log(`Fetch duration: ${fetchDuration} seconds`);

  console.log('\nBy category:');
  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    console.log(`  ${category}: ${count}`);
  }

  console.log('\nTop 10 packages by weekly downloads:');
  for (const pkg of packages.slice(0, 10)) {
    console.log(`  ${pkg.name}: ${pkg.downloadsWeekly.toLocaleString()} downloads/week`);
  }

  // Save to file
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\nSaved to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
