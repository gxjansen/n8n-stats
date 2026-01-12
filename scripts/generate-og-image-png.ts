/**
 * Generate OG Image PNG using Playwright
 *
 * Converts the og-image.html to og-image.png for social sharing.
 *
 * Usage: npx tsx scripts/generate-og-image-png.ts
 * Requires: Playwright installed (npm install @playwright/test)
 */

import { chromium } from '@playwright/test';
import { join } from 'path';
import { existsSync } from 'fs';

const WIDTH = 1200;
const HEIGHT = 630;

async function generatePng() {
  const htmlPath = join(process.cwd(), 'public', 'og-image.html');
  const pngPath = join(process.cwd(), 'public', 'og-image.png');

  if (!existsSync(htmlPath)) {
    console.error('❌ og-image.html not found. Run generate-og-image.ts first.');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to exact OG image dimensions
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });

  // Load the HTML file
  await page.goto(`file://${htmlPath}`);

  // Wait for fonts to load
  await page.waitForTimeout(500);

  // Take screenshot
  await page.screenshot({
    path: pngPath,
    type: 'png',
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  await browser.close();

  console.log(`✓ Generated ${pngPath}`);
  console.log(`  Size: ${WIDTH}x${HEIGHT}px`);
}

generatePng().catch((error) => {
  console.error('Error generating PNG:', error);
  process.exit(1);
});
