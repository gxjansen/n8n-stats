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
      'User-Agent': 'n8n-pulse',
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

/**
 * Comprehensive template analytics data
 */
export interface TemplateAnalytics {
  totalWorkflows: number;
  categories: FilterCount[];
  topNodes: FilterCount[];

  // Views distribution
  viewsDistribution: {
    viral: number;      // >100K views
    popular: number;    // 10K-100K views
    growing: number;    // 1K-10K views
    new: number;        // <1K views
  };

  // Template complexity - individual node counts
  complexityDistribution: {
    simple: number;     // 1-3 nodes (for backwards compat)
    medium: number;     // 4-7 nodes
    complex: number;    // 8+ nodes
  };

  // Detailed node count breakdown (1, 2, 3, ... 10+)
  nodeCountBreakdown: Array<{
    nodes: string;  // "1", "2", ... "10+"
    count: number;
  }>;

  // Creator stats
  topCreators: Array<{
    username: string;
    name: string;
    verified: boolean;
    avatar: string | null;
    templateCount: number;      // Count in trending sample
    totalTemplates: number;     // Total templates on n8n.io
    totalViews: number;
  }>;
  verifiedPercentage: number;

  // Node categories (from codex)
  nodeCategories: FilterCount[];

  // Creation timeline (monthly)
  creationTimeline: Array<{
    month: string;
    count: number;
  }>;

  // AI category breakdown (not AI vs non-AI because templates can have multiple categories)
  aiStats: {
    aiCategoryCount: number;  // Sum of all AI category counts
    totalCategoryCount: number;  // Sum of all category counts
    aiPercentage: number;  // Percentage of category assignments that are AI-related
    aiCategories: FilterCount[];  // Individual AI category breakdowns
  };
}

/**
 * Fetch comprehensive template analytics
 */
export async function fetchTemplateAnalytics(): Promise<TemplateAnalytics> {
  // Fetch templates with full data (100 for trending sample)
  const response = await fetch(`${API_BASE}/templates/search?rows=100`, {
    headers: {
      'User-Agent': 'n8n-pulse',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch template analytics: ${response.status}`);
  }

  const data = await response.json();
  const workflows = data.workflows || [];

  // Extract filter counts
  const categoryFilter = data.filters?.find((f: ApiFilter) => f.field_name === 'categories');
  const categories: FilterCount[] = categoryFilter?.counts || [];

  const nodesFilter = data.filters?.find((f: ApiFilter) => f.field_name === 'apps');
  const topNodes: FilterCount[] = nodesFilter?.counts || [];

  // Calculate views distribution
  const viewsDistribution = {
    viral: 0,
    popular: 0,
    growing: 0,
    new: 0,
  };

  for (const w of workflows) {
    const views = w.totalViews || 0;
    if (views > 100000) viewsDistribution.viral++;
    else if (views > 10000) viewsDistribution.popular++;
    else if (views > 1000) viewsDistribution.growing++;
    else viewsDistribution.new++;
  }

  // Calculate complexity distribution
  const complexityDistribution = {
    simple: 0,
    medium: 0,
    complex: 0,
  };

  // Detailed node count breakdown (1-10+)
  const nodeCountMap = new Map<number, number>();
  for (let i = 1; i <= 10; i++) {
    nodeCountMap.set(i, 0);
  }
  nodeCountMap.set(11, 0); // 10+ bucket

  for (const w of workflows) {
    const nodeCount = w.nodes?.length || 0;
    if (nodeCount <= 3) complexityDistribution.simple++;
    else if (nodeCount <= 7) complexityDistribution.medium++;
    else complexityDistribution.complex++;

    // Add to detailed breakdown
    if (nodeCount >= 10) {
      nodeCountMap.set(11, (nodeCountMap.get(11) || 0) + 1);
    } else if (nodeCount >= 1) {
      nodeCountMap.set(nodeCount, (nodeCountMap.get(nodeCount) || 0) + 1);
    }
  }

  // Convert to array format
  const nodeCountBreakdown = Array.from(nodeCountMap.entries())
    .map(([nodes, count]) => ({
      nodes: nodes === 11 ? '10+' : String(nodes),
      count,
    }))
    .sort((a, b) => {
      const aNum = a.nodes === '10+' ? 11 : parseInt(a.nodes);
      const bNum = b.nodes === '10+' ? 11 : parseInt(b.nodes);
      return aNum - bNum;
    });

  // Calculate top creators
  const creatorMap = new Map<string, {
    username: string;
    name: string;
    verified: boolean;
    avatar: string | null;
    templateCount: number;
    totalViews: number;
  }>();

  let verifiedCount = 0;
  for (const w of workflows) {
    const user = w.user;
    if (!user) continue;

    if (user.verified) verifiedCount++;

    const existing = creatorMap.get(user.username);
    if (existing) {
      existing.templateCount++;
      existing.totalViews += w.totalViews || 0;
    } else {
      creatorMap.set(user.username, {
        username: user.username,
        name: user.name || user.username,
        verified: user.verified || false,
        avatar: user.avatar || null,
        templateCount: 1,
        totalViews: w.totalViews || 0,
      });
    }
  }

  // Get top 10 creators from trending sample
  const topCreatorsBase = Array.from(creatorMap.values())
    .sort((a, b) => b.templateCount - a.templateCount)
    .slice(0, 10);

  // Fetch total template counts for top creators from the creators API
  const topCreators = await Promise.all(
    topCreatorsBase.map(async (creator) => {
      try {
        const response = await fetch(`${API_BASE}/creators/${creator.username}`, {
          headers: { 'User-Agent': 'n8n-pulse' },
        });
        if (response.ok) {
          const creatorData = await response.json();
          return {
            ...creator,
            totalTemplates: creatorData.data?.workflowsCount || creator.templateCount,
            avatar: creatorData.data?.avatar || creator.avatar,
          };
        }
      } catch {
        // Ignore errors, use default values
      }
      return {
        ...creator,
        totalTemplates: creator.templateCount,
      };
    })
  );

  const verifiedPercentage = workflows.length > 0
    ? Math.round((verifiedCount / workflows.length) * 100)
    : 0;

  // Calculate node categories from codex
  const nodeCategoryMap = new Map<string, number>();
  for (const w of workflows) {
    for (const node of w.nodes || []) {
      const cats = node.codex?.data?.categories || [];
      for (const cat of cats) {
        nodeCategoryMap.set(cat, (nodeCategoryMap.get(cat) || 0) + 1);
      }
    }
  }

  const nodeCategories = Array.from(nodeCategoryMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  // Calculate creation timeline
  const monthMap = new Map<string, number>();
  for (const w of workflows) {
    if (w.createdAt) {
      const month = w.createdAt.slice(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }
  }

  const creationTimeline = Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate AI category stats
  // Note: Templates can have multiple categories, so we can't calculate exact AI vs non-AI
  // Instead we show the breakdown of AI-related categories
  const aiCategoryNames = ['AI', 'Multimodal AI', 'AI Summarization', 'AI Chatbot'];
  const aiCategoriesFiltered = categories
    .filter(c => aiCategoryNames.includes(c.value))
    .sort((a, b) => b.count - a.count);

  const aiCategoryCount = aiCategoriesFiltered.reduce((sum, c) => sum + c.count, 0);
  const totalCategoryCount = categories.reduce((sum, c) => sum + c.count, 0);

  const aiStats = {
    aiCategoryCount,
    totalCategoryCount,
    aiPercentage: totalCategoryCount > 0
      ? Math.round((aiCategoryCount / totalCategoryCount) * 100)
      : 0,
    aiCategories: aiCategoriesFiltered,
  };

  return {
    totalWorkflows: data.totalWorkflows,
    categories,
    topNodes,
    viewsDistribution,
    complexityDistribution,
    nodeCountBreakdown,
    topCreators,
    verifiedPercentage,
    nodeCategories,
    creationTimeline,
    aiStats,
  };
}
