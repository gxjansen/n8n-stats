import type { ForumStats, ForumCategory } from '../types';

const FORUM_BASE = 'https://community.n8n.io';

/**
 * Fetch forum statistics from Discourse
 */
export async function fetchForumStats(): Promise<ForumStats> {
  const response = await fetch(`${FORUM_BASE}/about.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch forum stats: ${response.status}`);
  }

  const data = await response.json();
  const stats = data.about.stats;

  return {
    usersCount: stats.users_count,
    topicsCount: stats.topics_count,
    postsCount: stats.posts_count,
    likesCount: stats.likes_count,
    activeUsers7Days: stats.active_users_7_days,
    postsLast7Days: stats.posts_7_days,
  };
}

/**
 * Fetch forum categories from Discourse
 */
export async function fetchForumCategories(): Promise<ForumCategory[]> {
  const response = await fetch(`${FORUM_BASE}/categories.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch forum categories: ${response.status}`);
  }

  const data = await response.json();

  return data.category_list.categories.map((cat: Record<string, unknown>) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    topicCount: cat.topic_count,
    postCount: cat.post_count,
    description: cat.description_text,
  }));
}

/**
 * Fetch top contributors from Discourse
 */
export async function fetchTopContributors(period: 'all' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' = 'all') {
  const response = await fetch(`${FORUM_BASE}/directory_items.json?period=${period}&order=post_count`);

  if (!response.ok) {
    throw new Error(`Failed to fetch top contributors: ${response.status}`);
  }

  const data = await response.json();

  return data.directory_items.map((item: Record<string, unknown>) => ({
    username: (item.user as Record<string, unknown>)?.username,
    name: (item.user as Record<string, unknown>)?.name,
    postCount: item.post_count,
    topicsEntered: item.topics_entered,
    likesReceived: item.likes_received,
    likesGiven: item.likes_given,
  }));
}
