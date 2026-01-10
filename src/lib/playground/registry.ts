/**
 * Data Source Registry for Playground
 *
 * Defines all available data sources with metadata for the playground.
 * Phase 1: Time-series sources only
 * Phase 2: Will add categorical sources
 */

export interface MetricDefinition {
  id: string;
  label: string;
  color: string;
  /** Path to value in data object, e.g., 'stars' or 'timeline.monthly' */
  path: string;
  /** For nested arrays, the key containing the value */
  valueKey?: string;
  /** For nested arrays, the key containing the date */
  dateKey?: string;
}

export interface DataSource {
  id: string;
  label: string;
  shortLabel: string;
  file: string;
  type: 'timeseries' | 'categorical';
  /** Granularity options available */
  granularities: ('daily' | 'weekly' | 'monthly')[];
  /** Default granularity */
  defaultGranularity: 'daily' | 'weekly' | 'monthly';
  metrics: MetricDefinition[];
  /** Approximate date range for UI hints */
  historyStart: string;
}

// Color palette for metrics (distinct, accessible)
const COLORS = {
  // GitHub
  stars: '#f0c14b',      // Gold
  forks: '#6e7681',      // Gray
  watchers: '#58a6ff',   // Blue
  issues: '#f85149',     // Red

  // Community
  users: '#22c55e',      // Green
  topics: '#a855f7',     // Purple
  posts: '#3b82f6',      // Blue
  likes: '#ec4899',      // Pink

  // Templates
  templatesTotal: '#ff6b9d',    // Pink
  templatesNew: '#4bc0c0',      // Teal

  // Creators
  creatorsTotal: '#f97316',     // Orange
  creatorsVerified: '#14b8a6',  // Teal
  creatorViews: '#8b5cf6',      // Violet
  creatorInserters: '#06b6d4',  // Cyan

  // Discord
  discordMembers: '#5865f2',    // Discord blue
  discordOnline: '#57f287',     // Discord green
};

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'github',
    label: 'GitHub',
    shortLabel: 'GH',
    file: '/data/github-history.json',
    type: 'timeseries',
    granularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'monthly',
    historyStart: '2019-06',
    metrics: [
      { id: 'github-stars', label: 'GitHub Stars', color: COLORS.stars, path: 'stars' },
      { id: 'github-forks', label: 'GitHub Forks', color: COLORS.forks, path: 'forks' },
      { id: 'github-watchers', label: 'GitHub Watchers', color: COLORS.watchers, path: 'watchers' },
      { id: 'github-issues', label: 'Open Issues', color: COLORS.issues, path: 'openIssues' },
    ],
  },
  {
    id: 'community',
    label: 'Community Forum',
    shortLabel: 'Forum',
    file: '/data/community-history.json',
    type: 'timeseries',
    granularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'monthly',
    historyStart: '2019-11',
    metrics: [
      { id: 'forum-users', label: 'Forum Members', color: COLORS.users, path: 'users' },
      { id: 'forum-topics', label: 'Forum Topics', color: COLORS.topics, path: 'topics' },
      { id: 'forum-posts', label: 'Forum Posts', color: COLORS.posts, path: 'posts' },
      { id: 'forum-likes', label: 'Forum Likes', color: COLORS.likes, path: 'likes' },
    ],
  },
  {
    id: 'templates',
    label: 'Templates',
    shortLabel: 'Tpl',
    file: '/data/all-templates-data.json',
    type: 'timeseries',
    granularities: ['monthly'],
    defaultGranularity: 'monthly',
    historyStart: '2019-08',
    metrics: [
      {
        id: 'templates-total',
        label: 'Total Templates',
        color: COLORS.templatesTotal,
        path: 'timeline.monthly',
        valueKey: 'cumulative',
        dateKey: 'month',
      },
      {
        id: 'templates-new',
        label: 'New Templates/Month',
        color: COLORS.templatesNew,
        path: 'timeline.monthly',
        valueKey: 'count',
        dateKey: 'month',
      },
    ],
  },
  {
    id: 'creators',
    label: 'Creators',
    shortLabel: 'Creators',
    file: '/data/history/creators-stats.json',
    type: 'timeseries',
    granularities: ['weekly'],
    defaultGranularity: 'weekly',
    historyStart: '2024-11',
    metrics: [
      { id: 'creators-total', label: 'Total Creators', color: COLORS.creatorsTotal, path: 'total' },
      { id: 'creators-verified', label: 'Verified Creators', color: COLORS.creatorsVerified, path: 'verified' },
      { id: 'creators-views', label: 'Total Views', color: COLORS.creatorViews, path: 'totalViews' },
      { id: 'creators-inserters', label: 'Total Inserters', color: COLORS.creatorInserters, path: 'totalInserters' },
    ],
  },
  {
    id: 'discord',
    label: 'Discord',
    shortLabel: 'Discord',
    file: '/data/history/discord.json',
    type: 'timeseries',
    granularities: ['daily', 'weekly', 'monthly'],
    defaultGranularity: 'daily',
    historyStart: '2026-01',
    metrics: [
      { id: 'discord-members', label: 'Discord Members', color: COLORS.discordMembers, path: 'members' },
      { id: 'discord-online', label: 'Discord Online', color: COLORS.discordOnline, path: 'online' },
    ],
  },
];

/**
 * Get all available metrics as a flat list for the selector
 */
export function getAllMetrics(): Array<MetricDefinition & { sourceId: string; sourceLabel: string }> {
  return DATA_SOURCES.flatMap(source =>
    source.metrics.map(metric => ({
      ...metric,
      sourceId: source.id,
      sourceLabel: source.label,
    }))
  );
}

/**
 * Get a metric by its ID
 */
export function getMetricById(metricId: string): (MetricDefinition & { source: DataSource }) | undefined {
  for (const source of DATA_SOURCES) {
    const metric = source.metrics.find(m => m.id === metricId);
    if (metric) {
      return { ...metric, source };
    }
  }
  return undefined;
}

/**
 * Get source by ID
 */
export function getSourceById(sourceId: string): DataSource | undefined {
  return DATA_SOURCES.find(s => s.id === sourceId);
}
