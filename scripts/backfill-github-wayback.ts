#!/usr/bin/env npx ts-node
/**
 * Backfill GitHub metrics from Wayback Machine archives
 *
 * This script fetches historical snapshots of the n8n-io/n8n GitHub page
 * and extracts stars, forks, watchers, and issues counts where available.
 *
 * Run: npx ts-node scripts/backfill-github-wayback.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_URL = 'github.com/n8n-io/n8n';
const OUTPUT_FILE = path.join(__dirname, '../public/data/seed/github-wayback.json');

interface WaybackSnapshot {
  timestamp: string;
  url: string;
}

interface GitHubStats {
  date: string;
  timestamp: string;
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  openIssues: number | null;
  source: 'wayback';
}

// Rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'n8n-stats-backfill/1.0 (https://github.com/gxjansen/n8n-stats)'
        }
      });
      if (response.ok) {
        return await response.text();
      }
      if (response.status === 429) {
        console.log(`  Rate limited, waiting 30s...`);
        await sleep(30000);
        continue;
      }
      console.log(`  HTTP ${response.status} for ${url}`);
    } catch (error) {
      console.log(`  Fetch error (attempt ${i + 1}): ${error}`);
    }
    await sleep(2000);
  }
  return null;
}

async function getSnapshots(): Promise<WaybackSnapshot[]> {
  console.log('Fetching snapshot list from Wayback Machine CDX API...');

  // Get monthly snapshots (collapse by YYYYMM)
  const cdxUrl = `http://web.archive.org/cdx/search/cdx?url=${REPO_URL}&output=json&filter=statuscode:200&collapse=timestamp:6`;

  const response = await fetchWithRetry(cdxUrl);
  if (!response) {
    throw new Error('Failed to fetch snapshot list');
  }

  const data = JSON.parse(response);
  // First row is headers: ["urlkey","timestamp","original","mimetype","statuscode","digest","length"]
  const snapshots: WaybackSnapshot[] = data.slice(1).map((row: string[]) => ({
    timestamp: row[1],
    url: `https://web.archive.org/web/${row[1]}/${row[2]}`
  }));

  console.log(`Found ${snapshots.length} monthly snapshots`);
  return snapshots;
}

function parseNumber(str: string): number | null {
  if (!str) return null;
  // Handle formats like "17,027" or "17k" or "1.6k"
  const cleaned = str.replace(/,/g, '').toLowerCase();
  if (cleaned.endsWith('k')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000);
  }
  if (cleaned.endsWith('m')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000000);
  }
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function extractStats(html: string, timestamp: string): GitHubStats {
  const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;

  const stats: GitHubStats = {
    date,
    timestamp,
    stars: null,
    forks: null,
    watchers: null,
    openIssues: null,
    source: 'wayback'
  };

  // Extract from aria-labels (most reliable)
  // Pattern: aria-label="17027 users starred this repository"
  const starsMatch = html.match(/aria-label="([0-9,]+)\s*users?\s*starred/i);
  if (starsMatch) {
    stats.stars = parseNumber(starsMatch[1]);
  }

  // Pattern: aria-label="1555 users forked this repository"
  const forksMatch = html.match(/aria-label="([0-9,]+)\s*users?\s*forked/i);
  if (forksMatch) {
    stats.forks = parseNumber(forksMatch[1]);
  }

  // Try alternative patterns for stars/forks if not found
  if (!stats.stars) {
    // Look for social-count near stargazers link
    const starsAlt = html.match(/stargazers[^>]*>[\s\S]*?<[^>]*class="[^"]*social-count[^"]*"[^>]*>([0-9,.k]+)</i);
    if (starsAlt) {
      stats.stars = parseNumber(starsAlt[1]);
    }
  }

  if (!stats.forks) {
    // Look for social-count near fork link
    const forksAlt = html.match(/network\/members[^>]*>[\s\S]*?<[^>]*class="[^"]*social-count[^"]*"[^>]*>([0-9,.k]+)</i);
    if (forksAlt) {
      stats.forks = parseNumber(forksAlt[1]);
    }
  }

  // Try to extract watchers (less reliable, format varies)
  const watchersMatch = html.match(/aria-label="([0-9,]+)\s*users?\s*(watching|are watching)/i);
  if (watchersMatch) {
    stats.watchers = parseNumber(watchersMatch[1]);
  }

  // Try to extract open issues from Issues tab counter
  // Pattern: <span class="Counter">68</span> near issues tab
  const issuesTabMatch = html.match(/issues-tab[^>]*>[\s\S]*?Counter[^>]*>([0-9,]+)</i);
  if (issuesTabMatch) {
    stats.openIssues = parseNumber(issuesTabMatch[1]);
  }

  return stats;
}

async function scrapeSnapshot(snapshot: WaybackSnapshot): Promise<GitHubStats | null> {
  const html = await fetchWithRetry(snapshot.url);
  if (!html) {
    return null;
  }

  return extractStats(html, snapshot.timestamp);
}

async function main() {
  console.log('GitHub Wayback Machine Backfill Script');
  console.log('=====================================\n');

  // Get list of snapshots
  const snapshots = await getSnapshots();

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Load existing data if any (for resuming)
  let existingData: GitHubStats[] = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    existingData = existing.data || [];
    console.log(`Found ${existingData.length} existing entries, will skip those timestamps`);
  }
  const existingTimestamps = new Set(existingData.map(d => d.timestamp));

  const results: GitHubStats[] = [...existingData];
  let processed = 0;
  let skipped = 0;

  for (const snapshot of snapshots) {
    if (existingTimestamps.has(snapshot.timestamp)) {
      skipped++;
      continue;
    }

    processed++;
    const dateStr = `${snapshot.timestamp.slice(0, 4)}-${snapshot.timestamp.slice(4, 6)}-${snapshot.timestamp.slice(6, 8)}`;
    console.log(`[${processed}/${snapshots.length - skipped}] Scraping ${dateStr}...`);

    const stats = await scrapeSnapshot(snapshot);
    if (stats) {
      results.push(stats);
      console.log(`  Stars: ${stats.stars ?? 'N/A'}, Forks: ${stats.forks ?? 'N/A'}, Watchers: ${stats.watchers ?? 'N/A'}, Issues: ${stats.openIssues ?? 'N/A'}`);

      // Save progress after each successful scrape
      const output = {
        lastUpdated: new Date().toISOString(),
        description: 'Historical GitHub metrics scraped from Wayback Machine',
        repo: 'n8n-io/n8n',
        data: results.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      };
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    } else {
      console.log(`  Failed to scrape`);
    }

    // Be nice to Wayback Machine - wait between requests
    await sleep(1500);
  }

  console.log(`\nDone! Scraped ${processed} snapshots, skipped ${skipped} existing.`);
  console.log(`Results saved to: ${OUTPUT_FILE}`);

  // Summary
  const withStars = results.filter(r => r.stars !== null).length;
  const withForks = results.filter(r => r.forks !== null).length;
  const withWatchers = results.filter(r => r.watchers !== null).length;
  const withIssues = results.filter(r => r.openIssues !== null).length;

  console.log(`\nData coverage:`);
  console.log(`  Stars: ${withStars}/${results.length} snapshots`);
  console.log(`  Forks: ${withForks}/${results.length} snapshots`);
  console.log(`  Watchers: ${withWatchers}/${results.length} snapshots`);
  console.log(`  Issues: ${withIssues}/${results.length} snapshots`);
}

main().catch(console.error);
