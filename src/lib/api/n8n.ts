import type { Template, TemplatesResponse, NodeUsage } from '../types';

const API_BASE = 'https://api.n8n.io/api';

export interface FilterCount {
  value: string;
  count: number;
}

export interface ApiFilter {
  field_name: string;
  counts: FilterCount[];
}

export interface TemplateStats {
  totalWorkflows: number;
  categories: FilterCount[];
  topNodes: FilterCount[];
}

export type SortOption = 'trendingScore:desc' | 'createdAt:desc' | 'totalViews:desc';
export type Category = 'AI' | 'Sales' | 'IT Ops' | 'Marketing' | 'Document Ops' | 'Other' | 'Support';

export interface FetchTemplatesOptions {
  sort?: SortOption;
  category?: Category;
  rows?: number;
  page?: number;
  search?: string;
}

/**
 * Fetch templates from n8n API
 */
export async function fetchTemplates(options: FetchTemplatesOptions = {}): Promise<TemplatesResponse> {
  const {
    sort = 'trendingScore:desc',
    category,
    rows = 20,
    page = 1,
    search,
  } = options;

  const params = new URLSearchParams({
    sort,
    rows: String(rows),
    page: String(page),
  });

  if (category) {
    params.set('category', category);
  }

  if (search) {
    params.set('search', search);
  }

  const response = await fetch(`${API_BASE}/templates/search?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all templates (paginated)
 * Use with caution - may hit rate limits
 */
export async function fetchAllTemplates(maxPages = 10): Promise<Template[]> {
  const allTemplates: Template[] = [];
  const pageSize = 100;

  for (let page = 1; page <= maxPages; page++) {
    const response = await fetchTemplates({ rows: pageSize, page });
    allTemplates.push(...response.workflows);

    // If we got fewer than requested, we've reached the end
    if (response.workflows.length < pageSize) {
      break;
    }

    // Rate limiting - wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return allTemplates;
}

/**
 * Aggregate node usage from templates
 */
export function aggregateNodeUsage(templates: Template[]): NodeUsage[] {
  const nodeMap = new Map<string, NodeUsage>();

  for (const template of templates) {
    for (const node of template.nodes) {
      const existing = nodeMap.get(node.name);

      if (existing) {
        existing.count++;
      } else {
        nodeMap.set(node.name, {
          name: node.name,
          displayName: node.displayName,
          count: 1,
          category: node.codex?.categories?.[0],
          icon: node.icon,
        });
      }
    }
  }

  // Sort by usage count descending
  return Array.from(nodeMap.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * Get templates by category breakdown
 */
export function getTemplatesByCategory(templates: Template[]): Record<string, number> {
  const categories: Record<string, number> = {};

  for (const template of templates) {
    // Extract category from nodes or use default
    const mainCategory = template.nodes[0]?.codex?.categories?.[0] || 'Other';
    categories[mainCategory] = (categories[mainCategory] || 0) + 1;
  }

  return categories;
}

/**
 * Get top template creators
 */
export function getTopCreators(templates: Template[]): Array<{
  username: string;
  name: string;
  verified: boolean;
  templateCount: number;
  totalViews: number;
}> {
  const creatorMap = new Map<string, {
    username: string;
    name: string;
    verified: boolean;
    templateCount: number;
    totalViews: number;
  }>();

  for (const template of templates) {
    const { username, name, verified } = template.user;
    const existing = creatorMap.get(username);

    if (existing) {
      existing.templateCount++;
      existing.totalViews += template.totalViews;
    } else {
      creatorMap.set(username, {
        username,
        name,
        verified,
        templateCount: 1,
        totalViews: template.totalViews,
      });
    }
  }

  return Array.from(creatorMap.values())
    .sort((a, b) => b.templateCount - a.templateCount);
}

/**
 * Fetch template statistics including category and node counts from API filters
 */
export async function fetchTemplateStats(): Promise<TemplateStats> {
  const response = await fetch(`${API_BASE}/templates/search?rows=1`, {
    headers: {
      'User-Agent': 'n8n-stats',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch template stats: ${response.status}`);
  }

  const data = await response.json();

  // Extract category counts from filters
  const categoryFilter = data.filters?.find((f: ApiFilter) => f.field_name === 'categories');
  const categories: FilterCount[] = categoryFilter?.counts || [];

  // Extract node counts from filters (apps field)
  const nodesFilter = data.filters?.find((f: ApiFilter) => f.field_name === 'apps');
  const topNodes: FilterCount[] = nodesFilter?.counts || [];

  return {
    totalWorkflows: data.totalWorkflows,
    categories,
    topNodes,
  };
}
