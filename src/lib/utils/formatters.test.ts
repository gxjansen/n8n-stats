import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatWithCommas,
  formatRelativeTime,
  formatDate,
  formatChange,
  truncate,
  addUtmCodes,
  addN8nTracking,
  getNodeSlug,
  getNodePageUrl,
  getNodeIntegrationUrl,
  n8nUrls,
} from './formatters';

describe('formatNumber', () => {
  it('formats numbers under 1000 with commas', () => {
    expect(formatNumber(123)).toBe('123');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(12345)).toBe('12.3K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
    expect(formatNumber(12345678)).toBe('12.3M');
  });
});

describe('formatWithCommas', () => {
  it('formats numbers with locale-specific separators', () => {
    // Note: toLocaleString output varies by environment
    expect(formatWithCommas(1000)).toMatch(/1.?000/);
    expect(formatWithCommas(1000000)).toMatch(/1.?000.?000/);
  });
});

describe('formatRelativeTime', () => {
  it('returns "today" for same day', () => {
    const today = new Date().toISOString();
    expect(formatRelativeTime(today)).toBe('today');
  });

  it('returns "yesterday" for one day ago', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(yesterday)).toBe('yesterday');
  });

  it('returns days ago for less than a week', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns weeks ago for less than a month', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
  });

  it('returns months ago for less than a year', () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeMonthsAgo)).toBe('3 months ago');
  });

  it('returns years ago for more than a year', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoYearsAgo)).toBe('2 years ago');
  });
});

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatDate('2024-06-15T12:00:00Z')).toBe('2024-06-15');
    expect(formatDate('2024-01-01T00:00:00Z')).toBe('2024-01-01');
  });
});

describe('formatChange', () => {
  it('formats positive changes with + prefix', () => {
    expect(formatChange(1.5)).toBe('+1.5%');
    expect(formatChange(0)).toBe('+0.0%');
    expect(formatChange(100)).toBe('+100.0%');
  });

  it('formats negative changes with - prefix', () => {
    expect(formatChange(-1.5)).toBe('-1.5%');
    expect(formatChange(-50)).toBe('-50.0%');
  });
});

describe('truncate', () => {
  it('returns original text if shorter than max length', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates with ellipsis if longer than max length', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
    expect(truncate('this is a long text', 10)).toBe('this is...');
  });
});

describe('getNodeSlug', () => {
  it('converts display name to lowercase slug', () => {
    expect(getNodeSlug('HTTP Request')).toBe('http-request');
    expect(getNodeSlug('Google Sheets')).toBe('google-sheets');
  });

  it('removes parentheses', () => {
    expect(getNodeSlug('Edit Fields (Set)')).toBe('edit-fields-set');
    expect(getNodeSlug('Code (JavaScript)')).toBe('code-javascript');
  });

  it('handles special characters', () => {
    expect(getNodeSlug('AI Agent')).toBe('ai-agent');
    expect(getNodeSlug('n8n Workflow')).toBe('n8n-workflow');
  });
});

describe('getNodePageUrl', () => {
  it('generates internal node page URL', () => {
    expect(getNodePageUrl('HTTP Request')).toBe('/nodes/http-request');
    expect(getNodePageUrl('Edit Fields (Set)')).toBe('/nodes/edit-fields-set');
  });
});

describe('getNodeIntegrationUrl', () => {
  it('generates n8n.io integration URL with tracking', () => {
    const url = getNodeIntegrationUrl('HTTP Request');
    expect(url).toContain('https://n8n.io/integrations/http-request/');
    expect(url).toContain('utm_source=');
    expect(url).toContain('utm_campaign=integrations');
  });
});

describe('addUtmCodes', () => {
  it('adds UTM parameters to URL without query string', () => {
    const result = addUtmCodes('https://example.com', 'test-campaign');
    expect(result).toContain('utm_source=n8n-stats-by-guido-jansen');
    expect(result).toContain('utm_medium=website');
    expect(result).toContain('utm_campaign=test-campaign');
    expect(result).toContain('?');
  });

  it('adds UTM parameters to URL with existing query string', () => {
    const result = addUtmCodes('https://example.com?foo=bar', 'test-campaign');
    expect(result).toContain('&utm_source=');
    expect(result).not.toContain('?utm_source=');
  });
});

describe('addN8nTracking', () => {
  it('adds UTM and partner tracking to n8n.io URLs', () => {
    const result = addN8nTracking('https://n8n.io/workflows', 'templates');
    expect(result).toContain('utm_source=');
    expect(result).toContain('ps_partner_key=');
    expect(result).toContain('ps_xid=');
  });
});

describe('n8nUrls', () => {
  it('generates workflow URL with tracking', () => {
    const url = n8nUrls.workflow(123);
    expect(url).toContain('https://n8n.io/workflows/123');
    expect(url).toContain('utm_campaign=templates');
  });

  it('generates creator URL with tracking', () => {
    const url = n8nUrls.creator('testuser');
    expect(url).toContain('https://n8n.io/creators/testuser');
    expect(url).toContain('utm_campaign=creators');
  });

  it('generates community URL with UTM only (no partner tracking)', () => {
    const url = n8nUrls.community();
    expect(url).toContain('https://community.n8n.io');
    expect(url).toContain('utm_source=');
    expect(url).not.toContain('ps_partner_key=');
  });
});
