/**
 * Fetch external data sources (n8n Arena)
 * Run daily via GitHub Actions
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'public', 'data', 'external');

// n8n Arena data URLs
const N8N_ARENA_CREATORS_URL = 'https://raw.githubusercontent.com/teds-tech-talks/n8n-community-leaderboard/main/stats_aggregate_creators.json';

interface N8nArenaCreator {
  user_username: string;
  sum_unique_visitors: number;
  sum_unique_inserters: number;
  sum_unique_monthly_visitors: number;
  sum_unique_monthly_inserters: number;
  sum_unique_weekly_visitors: number;
  sum_unique_weekly_inserters: number;
  unique_count_template_url: number;
  min_earliest_wf: string;
  min_template_id: number;
  user: {
    name: string;
    username: string;
    bio: string;
    verified: boolean;
    links: string[];
    avatar: string;
  };
}

interface ProcessedCreator {
  username: string;
  name: string;
  bio: string;
  verified: boolean;
  avatar: string;
  links: string[];
  templateCount: number;
  totalViews: number;
  totalInserters: number;
  monthlyViews: number;
  monthlyInserters: number;
  weeklyViews: number;
  weeklyInserters: number;
  earliestWorkflow: string;
  _source: 'n8narena';
}

interface ExternalDataMeta {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  attribution: {
    name: string;
    url: string;
    repository: string;
  };
  recordCount: number;
}

async function fetchN8nArenaCreators(): Promise<N8nArenaCreator[]> {
  console.log('Fetching n8n Arena creators data...');

  const response = await fetch(N8N_ARENA_CREATORS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch n8n Arena data: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Fetched ${data.length} creators from n8n Arena`);

  return data;
}

function processCreators(rawCreators: N8nArenaCreator[]): ProcessedCreator[] {
  return rawCreators
    .filter(c => c.user_username && c.user_username !== 'n8n-team') // Exclude n8n team
    .map(c => ({
      username: c.user_username,
      name: c.user?.name || c.user_username,
      bio: c.user?.bio || '',
      verified: c.user?.verified || false,
      avatar: c.user?.avatar || '',
      links: c.user?.links || [],
      templateCount: c.unique_count_template_url || 0,
      totalViews: c.sum_unique_visitors || 0,
      totalInserters: c.sum_unique_inserters || 0,
      monthlyViews: c.sum_unique_monthly_visitors || 0,
      monthlyInserters: c.sum_unique_monthly_inserters || 0,
      weeklyViews: c.sum_unique_weekly_visitors || 0,
      weeklyInserters: c.sum_unique_weekly_inserters || 0,
      earliestWorkflow: c.min_earliest_wf || '',
      _source: 'n8narena' as const,
    }))
    .sort((a, b) => b.totalInserters - a.totalInserters); // Sort by inserters
}

async function main() {
  // Ensure directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    // Fetch raw data
    const rawCreators = await fetchN8nArenaCreators();

    // Process into our format
    const creators = processCreators(rawCreators);

    // Create metadata
    const meta: ExternalDataMeta = {
      fetchedAt: new Date().toISOString(),
      source: 'n8n Arena',
      sourceUrl: N8N_ARENA_CREATORS_URL,
      attribution: {
        name: 'n8n Arena',
        url: 'https://n8narena.com',
        repository: 'https://github.com/teds-tech-talks/n8n-community-leaderboard',
      },
      recordCount: creators.length,
    };

    // Save processed data
    const creatorsPath = join(DATA_DIR, 'n8narena-creators.json');
    writeFileSync(creatorsPath, JSON.stringify(creators, null, 2));
    console.log(`Saved ${creators.length} creators to ${creatorsPath}`);

    // Save metadata
    const metaPath = join(DATA_DIR, 'n8narena.meta.json');
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log(`Saved metadata to ${metaPath}`);

    // Log some stats
    const totalViews = creators.reduce((sum, c) => sum + c.totalViews, 0);
    const totalInserters = creators.reduce((sum, c) => sum + c.totalInserters, 0);
    const verifiedCount = creators.filter(c => c.verified).length;

    console.log('\n--- Stats ---');
    console.log(`Total creators: ${creators.length}`);
    console.log(`Verified creators: ${verifiedCount}`);
    console.log(`Total views: ${totalViews.toLocaleString()}`);
    console.log(`Total inserters: ${totalInserters.toLocaleString()}`);
    console.log(`Top 5 by inserters:`);
    creators.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (@${c.username}) - ${c.totalInserters.toLocaleString()} inserters`);
    });

  } catch (error) {
    console.error('Error fetching external data:', error);
    process.exit(1);
  }
}

main();
