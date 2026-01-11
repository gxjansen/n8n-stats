import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - All Pages Load', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/n8n/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('github page loads', async ({ page }) => {
    await page.goto('/github');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('community page loads', async ({ page }) => {
    await page.goto('/community');
    await expect(page.locator('body')).toBeVisible();
  });

  test('templates page loads', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.locator('body')).toBeVisible();
  });

  test('nodes page loads', async ({ page }) => {
    await page.goto('/nodes');
    await expect(page.locator('body')).toBeVisible();
  });

  test('creators page loads', async ({ page }) => {
    await page.goto('/creators');
    await expect(page.locator('body')).toBeVisible();
  });

  test('events page loads', async ({ page }) => {
    await page.goto('/events');
    await expect(page.locator('body')).toBeVisible();
  });

  test('playground page loads', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Homepage Content', () => {
  test('displays stat cards', async ({ page }) => {
    await page.goto('/');
    // Should have multiple stat cards
    const cards = page.locator('.card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
  });

  test('displays navigation', async ({ page }) => {
    await page.goto('/');
    // Check for nav links in the header navigation
    await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Community', exact: true })).toBeVisible();
  });
});

test.describe('Charts Render', () => {
  test('github page has charts', async ({ page }) => {
    await page.goto('/github');
    // Charts use canvas elements
    await page.waitForSelector('canvas', { timeout: 10000 });
    const canvases = page.locator('canvas');
    await expect(canvases.first()).toBeVisible();
  });

  test('community page has charts', async ({ page }) => {
    await page.goto('/community');
    await page.waitForSelector('canvas', { timeout: 10000 });
    const canvases = page.locator('canvas');
    await expect(canvases.first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('can navigate from homepage to github', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /github/i }).first().click();
    await expect(page).toHaveURL(/\/github/);
  });

  test('can navigate from homepage to community', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /community/i }).first().click();
    await expect(page).toHaveURL(/\/community/);
  });

  test('can navigate from homepage to nodes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /nodes/i }).first().click();
    await expect(page).toHaveURL(/\/nodes/);
  });
});

test.describe('Data Display', () => {
  test('github page shows star count', async ({ page }) => {
    await page.goto('/github');
    // Look for large numbers (star count)
    const content = await page.textContent('body');
    // Star count should be visible as a formatted number (e.g., "166K" or "166,000")
    expect(content).toMatch(/\d+[KM]|\d{1,3}(,\d{3})+/);
  });

  test('nodes page shows node list', async ({ page }) => {
    await page.goto('/nodes');
    // Should show some common node names
    const content = await page.textContent('body');
    expect(content).toMatch(/HTTP|Webhook|Code|AI/i);
  });
});

test.describe('External Links', () => {
  test('external links have tracking parameters', async ({ page }) => {
    await page.goto('/');
    // Find links to n8n.io
    const n8nLinks = page.locator('a[href*="n8n.io"]');
    const count = await n8nLinks.count();

    if (count > 0) {
      const href = await n8nLinks.first().getAttribute('href');
      expect(href).toContain('utm_source');
    }
  });

  test('external links open in new tab', async ({ page }) => {
    await page.goto('/');
    // External links should have target="_blank"
    const externalLinks = page.locator('a[href^="http"]:not([href*="localhost"])');
    const count = await externalLinks.count();

    if (count > 0) {
      const target = await externalLinks.first().getAttribute('target');
      expect(target).toBe('_blank');
    }
  });
});
