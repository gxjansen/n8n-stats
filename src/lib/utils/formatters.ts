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
 * Generate n8n integrations page URL from node display name
 * e.g., "HTTP Request" -> "https://n8n.io/integrations/http-request/"
 */
export function getNodeIntegrationUrl(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, '');      // Trim leading/trailing dashes
  return `https://n8n.io/integrations/${slug}/`;
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
