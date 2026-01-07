// n8n Templates API types
export interface TemplateNode {
  id: number;
  icon: string;
  name: string;
  displayName: string;
  typeVersion: number;
  group: string[];
  defaults: {
    name: string;
    color?: string;
  };
  iconData?: {
    type: string;
    fileBuffer?: string;
  };
  codex?: {
    categories?: string[];
    subcategories?: Record<string, string[]>;
    alias?: string[];
  };
}

export interface TemplateCreator {
  id: number;
  name: string;
  username: string;
  bio?: string;
  verified: boolean;
  links?: string[];
  avatar?: string;
}

export interface Template {
  id: number;
  name: string;
  description?: string;
  totalViews: number;
  createdAt: string;
  user: TemplateCreator;
  nodes: TemplateNode[];
  purchaseUrl?: string | null;
}

export interface TemplatesResponse {
  totalWorkflows: number;
  workflows: Template[];
}

// Node usage aggregation
export interface NodeUsage {
  name: string;
  displayName: string;
  count: number;
  category?: string;
  icon?: string;
}

// Forum/Discourse types
export interface ForumStats {
  usersCount: number;
  topicsCount: number;
  postsCount: number;
  likesCount: number;
  activeUsers7Days: number;
  postsLast7Days: number;
}

export interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  topicCount: number;
  postCount: number;
  description?: string;
}

// GitHub types
export interface GitHubStats {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  subscribers: number;
}

export interface GitHubRelease {
  tagName: string;
  name: string;
  publishedAt: string;
  body?: string;
}

// Daily snapshot for historical tracking
export interface DailySnapshot {
  date: string;
  githubStars: number;
  githubForks: number;
  npmDownloadsMonthly: number;
  forumUsers: number;
  forumTopics: number;
  forumPosts: number;
  templateCount: number;
}

// GitHub history data point
export interface GitHubDataPoint {
  date: string;  // ISO date string
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
}

// Aggregated history with multiple granularities
export interface GitHubHistory {
  lastUpdated: string;
  daily: GitHubDataPoint[];    // Last 90 days
  weekly: GitHubDataPoint[];   // Last 2 years
  monthly: GitHubDataPoint[];  // All time
}

// Raw daily log (internal, for building aggregates)
export interface GitHubDailyLog {
  entries: GitHubDataPoint[];
}

// Dashboard summary
export interface DashboardStats {
  templates: {
    total: number;
    lastUpdated: string;
  };
  github: GitHubStats;
  forum: ForumStats;
  npm: {
    downloadsMonthly: number;
  };
}
