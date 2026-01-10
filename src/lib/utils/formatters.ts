/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format a number with commas
 */
export function formatWithCommas(num: number): string {
  return num.toLocaleString();
}

/**
 * Format a date as relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }

  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toISOString().split('T')[0];
}

/**
 * Format percentage change with + or - prefix
 */
export function formatChange(change: number): string {
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(1)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * UTM parameters for n8n.io links
 */
const UTM_PARAMS = {
  source: 'n8n-stats-by-guido-jansen',
  medium: 'website',
};

/**
 * Partner/affiliate tracking parameters for n8n.io
 */
const PARTNER_PARAMS = 'ps_partner_key=YzE1OGQyZDU0MDc4&ps_xid=LP1r2oH0YFiZf0&gsxid=LP1r2oH0YFiZf0&gspk=YzE1OGQyZDU0MDc4';

/**
 * Add UTM tracking codes to a URL (for community.n8n.io - no partner tracking)
 */
export function addUtmCodes(url: string, campaign: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}utm_source=${UTM_PARAMS.source}&utm_medium=${UTM_PARAMS.medium}&utm_campaign=${campaign}`;
}

/**
 * Add UTM + partner tracking codes to n8n.io URLs
 */
export function addN8nTracking(url: string, campaign: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}utm_source=${UTM_PARAMS.source}&utm_medium=${UTM_PARAMS.medium}&utm_campaign=${campaign}&${PARTNER_PARAMS}`;
}

/**
 * n8n.io URL builders with UTM + partner tracking
 */
export const n8nUrls = {
  integration: (slug: string) => addN8nTracking(`https://n8n.io/integrations/${slug}/`, 'integrations'),
  workflow: (id: number | string) => addN8nTracking(`https://n8n.io/workflows/${id}`, 'templates'),
  creator: (username: string) => addN8nTracking(`https://n8n.io/creators/${username}`, 'creators'),
  creators: () => addN8nTracking('https://n8n.io/creators', 'creators'),
  workflows: () => addN8nTracking('https://n8n.io/workflows', 'templates'),
  workflowsCategory: (category: string) => addN8nTracking(`https://n8n.io/workflows/?category=${encodeURIComponent(category)}`, 'templates'),
  integrations: () => addN8nTracking('https://n8n.io/integrations', 'integrations'),
  home: () => addN8nTracking('https://n8n.io', 'home'),
  // Community uses UTM only (different domain, partner tracking likely n8n.io only)
  community: () => addUtmCodes('https://community.n8n.io', 'community'),
  communityCategory: (slug: string, id: number) => addUtmCodes(`https://community.n8n.io/c/${slug}/${id}`, 'community'),
};

/**
 * Generate n8n integrations page URL from node display name
 * e.g., "HTTP Request" -> "https://n8n.io/integrations/http-request/?utm_source=..."
 */
export function getNodeIntegrationUrl(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, '');      // Trim leading/trailing dashes
  return n8nUrls.integration(slug);
}

/**
 * Generate internal node page slug from display name
 * e.g., "HTTP Request" -> "http-request"
 * e.g., "Edit Fields (Set)" -> "edit-fields-set"
 */
export function getNodeSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[()]/g, '')          // Remove parentheses
    .replace(/[^a-z0-9]+/g, '-')   // Replace non-alphanumeric with dashes
    .replace(/^-|-$/g, '');        // Trim leading/trailing dashes
}

/**
 * Generate internal node page URL from display name
 */
export function getNodePageUrl(displayName: string): string {
  return `/nodes/${getNodeSlug(displayName)}`;
}
