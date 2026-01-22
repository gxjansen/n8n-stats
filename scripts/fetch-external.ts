/**
 * Fetch external data sources (n8n Arena)
 * Run daily via GitHub Actions
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'public', 'data', 'external');

// Usernames to exclude (n8n team accounts and company/organization accounts)
const EXCLUDED_USERNAMES = [
  'n8n-team',           // Official n8n team account
  'oneclick-ai',        // Oneclick AI Squad (company)
  'oneclick-it',        // OneClick IT Consultancy P Limited (company)
  'weblineindia',       // WeblineIndia (company)
];

// Name overrides for cases where n8n Arena has incorrect data
// Maps username to correct display name
const NAME_OVERRIDES: Record<string, string> = {
  'harshil1712': 'Harshil Agrawal',  // n8n Arena incorrectly shows "ghagrawal17"
};

// n8n Arena data URLs
const N8N_ARENA_CREATORS_URL = 'https://raw.githubusercontent.com/teds-tech-talks/n8n-community-leaderboard/main/stats_aggregate_creators.json';
const N8N_ARENA_WORKFLOWS_URL = 'https://raw.githubusercontent.com/teds-tech-talks/n8n-community-leaderboard/main/stats_aggregate_workflows.json';

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

// n8n Arena workflow data interfaces
interface N8nArenaWorkflow {
  template_url: string;
  template_id: number;
  template_name: string;
  unique_visitors: number;
  unique_inserters: number;
  unique_weekly_visitors: number;
  unique_weekly_inserters: number;
  unique_monthly_visitors: number;
  unique_monthly_inserters: number;
  wf_detais: {
    id: number;
    name: string;
    createdAt: string;
    workflowInfo?: {
      nodeCount: number;
      nodeTypes: Record<string, { count: number }>;
    };
  };
  user: {
    name: string;
    username: string;
    verified: boolean;
  };
}

interface WeightedNodeScore {
  type: string;
  weightedScore: number;      // Sum of (node_count * template_inserters)
  templateCount: number;      // Number of templates using this node
  totalNodeUsages: number;    // Total times node appears across all templates
  avgInsertersPerTemplate: number;
}

interface WeightedNodesData {
  lastUpdated: string;
  totalWorkflows: number;
  totalInserters: number;
  nodes: WeightedNodeScore[];
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
    .filter(c => c.user_username && !EXCLUDED_USERNAMES.includes(c.user_username))
    .map(c => ({
      username: c.user_username,
      name: NAME_OVERRIDES[c.user_username] || c.user?.name || c.user_username,
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

async function fetchN8nArenaWorkflows(): Promise<N8nArenaWorkflow[]> {
  console.log('Fetching n8n Arena workflows data...');

  const response = await fetch(N8N_ARENA_WORKFLOWS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch n8n Arena workflows: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Fetched ${data.length} workflows from n8n Arena`);

  return data;
}

function calculateWeightedNodeScores(workflows: N8nArenaWorkflow[]): WeightedNodesData {
  // Map to accumulate scores per node type
  const nodeScores = new Map<string, {
    weightedScore: number;
    templateCount: number;
    totalNodeUsages: number;
    insertersSum: number;
  }>();

  let totalInserters = 0;
  let workflowsWithNodes = 0;

  for (const workflow of workflows) {
    const inserters = workflow.unique_inserters || 0;
    totalInserters += inserters;

    const nodeTypes = workflow.wf_detais?.workflowInfo?.nodeTypes;
    if (!nodeTypes) continue;

    workflowsWithNodes++;

    for (const [nodeType, nodeInfo] of Object.entries(nodeTypes)) {
      const nodeCount = nodeInfo.count || 1;

      const existing = nodeScores.get(nodeType) || {
        weightedScore: 0,
        templateCount: 0,
        totalNodeUsages: 0,
        insertersSum: 0,
      };

      existing.weightedScore += nodeCount * inserters;
      existing.templateCount += 1;
      existing.totalNodeUsages += nodeCount;
      existing.insertersSum += inserters;

      nodeScores.set(nodeType, existing);
    }
  }

  // Convert to array and calculate averages
  const nodes: WeightedNodeScore[] = Array.from(nodeScores.entries())
    .map(([type, data]) => ({
      type,
      weightedScore: data.weightedScore,
      templateCount: data.templateCount,
      totalNodeUsages: data.totalNodeUsages,
      avgInsertersPerTemplate: data.templateCount > 0
        ? Math.round(data.insertersSum / data.templateCount)
        : 0,
    }))
    .sort((a, b) => b.weightedScore - a.weightedScore);

  return {
    lastUpdated: new Date().toISOString(),
    totalWorkflows: workflowsWithNodes,
    totalInserters,
    nodes,
  };
}

async function main() {
  // Ensure directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  try {
    // === CREATORS DATA ===
    const rawCreators = await fetchN8nArenaCreators();
    const creators = processCreators(rawCreators);

    // Save processed creators data
    const creatorsPath = join(DATA_DIR, 'n8narena-creators.json');
    writeFileSync(creatorsPath, JSON.stringify(creators, null, 2));
    console.log(`Saved ${creators.length} creators to ${creatorsPath}`);

    // === WORKFLOWS DATA (for weighted node scores) ===
    const workflows = await fetchN8nArenaWorkflows();
    const weightedNodes = calculateWeightedNodeScores(workflows);

    // Save weighted node scores (compact, no raw workflow data)
    const weightedNodesPath = join(DATA_DIR, 'n8narena-weighted-nodes.json');
    writeFileSync(weightedNodesPath, JSON.stringify(weightedNodes, null, 2));
    console.log(`Saved ${weightedNodes.nodes.length} weighted node scores to ${weightedNodesPath}`);

    // === METADATA ===
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

    const metaPath = join(DATA_DIR, 'n8narena.meta.json');
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    console.log(`Saved metadata to ${metaPath}`);

    // === STATS ===
    const totalViews = creators.reduce((sum, c) => sum + c.totalViews, 0);
    const totalInserters = creators.reduce((sum, c) => sum + c.totalInserters, 0);
    const verifiedCount = creators.filter(c => c.verified).length;

    console.log('\n--- Creators Stats ---');
    console.log(`Total creators: ${creators.length}`);
    console.log(`Verified creators: ${verifiedCount}`);
    console.log(`Total views: ${totalViews.toLocaleString()}`);
    console.log(`Total inserters: ${totalInserters.toLocaleString()}`);
    console.log(`Top 5 by inserters:`);
    creators.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (@${c.username}) - ${c.totalInserters.toLocaleString()} inserters`);
    });

    console.log('\n--- Weighted Nodes Stats ---');
    console.log(`Workflows analyzed: ${weightedNodes.totalWorkflows.toLocaleString()}`);
    console.log(`Total inserters: ${weightedNodes.totalInserters.toLocaleString()}`);
    console.log(`Unique nodes: ${weightedNodes.nodes.length}`);
    console.log(`Top 10 by weighted score:`);
    weightedNodes.nodes.slice(0, 10).forEach((n, i) => {
      const shortName = n.type.split('.').pop() || n.type;
      console.log(`  ${i + 1}. ${shortName} - ${n.weightedScore.toLocaleString()} weighted (${n.templateCount} templates)`);
    });

  } catch (error) {
    console.error('Error fetching external data:', error);
    process.exit(1);
  }
}

main();
