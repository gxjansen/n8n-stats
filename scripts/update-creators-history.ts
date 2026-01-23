/**
 * Update creators history from external n8n Arena data
 *
 * This script transforms the enriched n8n Arena data
 * (n8narena-creators.json) into the history format
 * (creators.json) that the creators page reads.
 *
 * Run with: npx tsx scripts/update-creators-history.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Types
interface Creator {
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
  _source: string;
}

interface CreatorsHistory {
  lastUpdated: string;
  totalCreators: number;
  verifiedCreators: number;
  totalViews: number;
  totalInserters: number;
  creators: Creator[];
}

// Paths
const DATA_DIR = join(process.cwd(), 'public', 'data');
const EXTERNAL_FILE = join(DATA_DIR, 'external', 'n8narena-creators.json');
const HISTORY_FILE = join(DATA_DIR, 'history', 'creators.json');

function main() {
  console.log('Updating creators history...\n');

  // Check if external file exists
  if (!existsSync(EXTERNAL_FILE)) {
    console.error(`External file not found: ${EXTERNAL_FILE}`);
    console.error('Run "npm run fetch-external" first to fetch n8n Arena data.');
    process.exit(1);
  }

  // Read external data (already sorted by inserters from fetch-external)
  const creators: Creator[] = JSON.parse(readFileSync(EXTERNAL_FILE, 'utf-8'));

  console.log(`Read ${creators.length} creators from external data`);

  // Take top 100 for the history file
  const topCreators = creators.slice(0, 100);

  // Calculate aggregate stats
  const totalViews = creators.reduce((sum, c) => sum + c.totalViews, 0);
  const totalInserters = creators.reduce((sum, c) => sum + c.totalInserters, 0);
  const verifiedCreators = creators.filter(c => c.verified).length;

  // Build history object (matches existing format)
  const history: CreatorsHistory = {
    lastUpdated: new Date().toISOString(),
    totalCreators: creators.length,
    verifiedCreators,
    totalViews,
    totalInserters,
    creators: topCreators,
  };

  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log(`Saved ${topCreators.length} creators to history file`);

  // Log stats
  console.log(`\nAggregate stats:`);
  console.log(`  Total creators: ${creators.length}`);
  console.log(`  Verified: ${verifiedCreators}`);
  console.log(`  Total views: ${totalViews.toLocaleString()}`);
  console.log(`  Total inserters: ${totalInserters.toLocaleString()}`);

  // Log top 5 for verification
  console.log('\nTop 5 by inserters:');
  topCreators.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} - ${c.templateCount} templates, ${c.totalInserters.toLocaleString()} inserters`);
  });

  console.log('\nDone!');
}

main();
