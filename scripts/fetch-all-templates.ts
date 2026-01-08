/**
 * Fetch All Templates Script
 *
 * This script fetches ALL templates from the n8n API and generates:
 * 1. Template complexity distribution (nodes per template)
 * 2. Creation timeline (templates created per month)
 * 3. Node usage statistics (which nodes are used across all templates)
 * 4. Creator statistics
 *
 * Run weekly (not on every build) due to the large number of API calls.
 * Run with: npx tsx scripts/fetch-all-templates.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Types
interface TemplateNode {
  name: string;
  displayName: string;
  icon?: string;
  codex?: {
    data?: {
      categories?: string[];
    };
  };
}

interface Template {
  id: number;
  name: string;
  createdAt: string;
  totalViews: number;
  nodes: TemplateNode[];
  user: {
    username: string;
    name: string;
    verified: boolean;
  };
}

interface ComplexityDistribution {
  nodeCount: number;
  label: string;
  count: number;
}

interface MonthlyCreation {
  month: string;
  count: number;
  cumulative: number;
}

interface NodeUsage {
  name: string;
  displayName: string;
  count: number;
  percentage: number;
  categories: string[];
}

interface CreatorStats {
  username: string;
  name: string;
  verified: boolean;
  templateCount: number;
  totalViews: number;
}

interface AllTemplatesData {
  lastUpdated: string;
  fetchDuration: number;
  totalTemplates: number;

  // Complexity distribution
  complexity: {
    distribution: ComplexityDistribution[];
    average: number;
    median: number;
    max: number;
  };

  // Creation timeline
  timeline: {
    monthly: MonthlyCreation[];
    firstTemplate: string;
    latestTemplate: string;
  };

  // Node usage
  nodes: {
    total: number;
    unique: number;
    top100: NodeUsage[];
  };

  // Creator stats
  creators: {
    total: number;
    verified: number;
    top50: CreatorStats[];
  };
}

// Config
const API_BASE = 'https://api.n8n.io/api';
const PAGE_SIZE = 100;
const RATE_LIMIT_DELAY = 500; // ms between requests
const DATA_DIR = join(process.cwd(), 'public', 'data');
const OUTPUT_PATH = join(DATA_DIR, 'all-templates-data.json');

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(page: number): Promise<{ workflows: Template[]; totalWorkflows: number }> {
  const url = `${API_BASE}/templates/search?rows=${PAGE_SIZE}&page=${page}&sort=createdAt:asc`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'n8n-stats' },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function fetchAllTemplates(): Promise<Template[]> {
  const allTemplates: Template[] = [];
  let page = 1;
  let totalWorkflows = 0;

  console.log('Fetching all templates from n8n API...\n');

  // First request to get total count
  const firstResponse = await fetchPage(1);
  totalWorkflows = firstResponse.totalWorkflows;
  allTemplates.push(...firstResponse.workflows);

  const totalPages = Math.ceil(totalWorkflows / PAGE_SIZE);
  console.log(`Total templates: ${totalWorkflows.toLocaleString()}`);
  console.log(`Pages to fetch: ${totalPages}\n`);

  // Fetch remaining pages
  for (page = 2; page <= totalPages; page++) {
    await sleep(RATE_LIMIT_DELAY);

    const response = await fetchPage(page);
    allTemplates.push(...response.workflows);

    // Progress indicator
    const progress = Math.round((page / totalPages) * 100);
    process.stdout.write(`\rFetching: ${page}/${totalPages} pages (${progress}%) - ${allTemplates.length.toLocaleString()} templates`);
  }

  console.log('\n');
  return allTemplates;
}

function calculateComplexity(templates: Template[]): AllTemplatesData['complexity'] {
  const nodeCounts = templates.map(t => t.nodes?.length || 0);

  // Count distribution
  const countMap = new Map<number, number>();
  for (const count of nodeCounts) {
    const bucket = count >= 15 ? 15 : count; // 15+ bucket
    countMap.set(bucket, (countMap.get(bucket) || 0) + 1);
  }

  // Create distribution array
  const distribution: ComplexityDistribution[] = [];
  for (let i = 1; i <= 15; i++) {
    distribution.push({
      nodeCount: i,
      label: i === 15 ? '15+' : String(i),
      count: countMap.get(i) || 0,
    });
  }

  // Calculate stats
  const sorted = [...nodeCounts].sort((a, b) => a - b);
  const sum = nodeCounts.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / nodeCounts.length) * 10) / 10;
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];

  return { distribution, average, median, max };
}

function calculateTimeline(templates: Template[]): AllTemplatesData['timeline'] {
  // Group by month
  const monthMap = new Map<string, number>();

  for (const template of templates) {
    if (template.createdAt) {
      const month = template.createdAt.slice(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }
  }

  // Convert to sorted array with cumulative count
  const months = Array.from(monthMap.keys()).sort();
  let cumulative = 0;
  const monthly: MonthlyCreation[] = months.map(month => {
    const count = monthMap.get(month) || 0;
    cumulative += count;
    return { month, count, cumulative };
  });

  return {
    monthly,
    firstTemplate: months[0] || '',
    latestTemplate: months[months.length - 1] || '',
  };
}

function calculateNodeUsage(templates: Template[]): AllTemplatesData['nodes'] {
  const nodeMap = new Map<string, {
    displayName: string;
    count: number;
    categories: Set<string>;
  }>();

  for (const template of templates) {
    for (const node of template.nodes || []) {
      const existing = nodeMap.get(node.name);
      const categories = node.codex?.data?.categories || [];

      if (existing) {
        existing.count++;
        categories.forEach(c => existing.categories.add(c));
      } else {
        nodeMap.set(node.name, {
          displayName: node.displayName || node.name,
          count: 1,
          categories: new Set(categories),
        });
      }
    }
  }

  // Convert to array and sort by count
  const allNodes = Array.from(nodeMap.entries())
    .map(([name, data]) => ({
      name,
      displayName: data.displayName,
      count: data.count,
      percentage: Math.round((data.count / templates.length) * 1000) / 10,
      categories: Array.from(data.categories),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: allNodes.reduce((sum, n) => sum + n.count, 0),
    unique: allNodes.length,
    top100: allNodes.slice(0, 100),
  };
}

function calculateCreatorStats(templates: Template[]): AllTemplatesData['creators'] {
  const creatorMap = new Map<string, CreatorStats>();

  for (const template of templates) {
    const user = template.user;
    if (!user) continue;

    const existing = creatorMap.get(user.username);
    if (existing) {
      existing.templateCount++;
      existing.totalViews += template.totalViews || 0;
    } else {
      creatorMap.set(user.username, {
        username: user.username,
        name: user.name || user.username,
        verified: user.verified || false,
        templateCount: 1,
        totalViews: template.totalViews || 0,
      });
    }
  }

  const allCreators = Array.from(creatorMap.values())
    .sort((a, b) => b.templateCount - a.templateCount);

  const verifiedCount = allCreators.filter(c => c.verified).length;

  return {
    total: allCreators.length,
    verified: verifiedCount,
    top50: allCreators.slice(0, 50),
  };
}

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('n8n Templates Full Data Fetch');
  console.log('='.repeat(60));
  console.log();

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch all templates
  const templates = await fetchAllTemplates();

  console.log('Processing data...\n');

  // Calculate all statistics
  const complexity = calculateComplexity(templates);
  console.log(`Complexity: avg ${complexity.average} nodes, median ${complexity.median}, max ${complexity.max}`);

  const timeline = calculateTimeline(templates);
  console.log(`Timeline: ${timeline.monthly.length} months from ${timeline.firstTemplate} to ${timeline.latestTemplate}`);

  const nodes = calculateNodeUsage(templates);
  console.log(`Nodes: ${nodes.unique.toLocaleString()} unique nodes, ${nodes.total.toLocaleString()} total usages`);

  const creators = calculateCreatorStats(templates);
  console.log(`Creators: ${creators.total.toLocaleString()} total, ${creators.verified} verified`);

  const fetchDuration = Math.round((Date.now() - startTime) / 1000);

  // Build output data
  const data: AllTemplatesData = {
    lastUpdated: new Date().toISOString(),
    fetchDuration,
    totalTemplates: templates.length,
    complexity,
    timeline,
    nodes,
    creators,
  };

  // Save to file
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\nSaved to ${OUTPUT_PATH}`);
  console.log(`Completed in ${fetchDuration} seconds`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
