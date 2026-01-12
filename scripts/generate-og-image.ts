/**
 * Generate OG Image for Social Sharing
 *
 * Creates a simple SVG-based og-image that can be used directly
 * or converted to PNG for better compatibility.
 *
 * Usage: npx tsx scripts/generate-og-image.ts
 *
 * Note: For PNG output, you'll need to convert the SVG manually
 * using a tool like Inkscape, Figma, or an online converter.
 * Recommended size: 1200x630px
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const WIDTH = 1200;
const HEIGHT = 630;

// n8n Pulse brand colors
const COLORS = {
  background: '#0d1117',
  primary: '#ff6d5a',
  text: '#ffffff',
  textMuted: '#8b949e',
  border: '#30363d',
};

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#161b22"/>
    </linearGradient>

    <!-- Logo mask for node circle -->
    <mask id="node-mask">
      <circle cx="100" cy="315" r="40" fill="white"/>
      <circle cx="100" cy="315" r="20" fill="black"/>
    </mask>

    <!-- Glow effect -->
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg-gradient)"/>

  <!-- Subtle grid pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${COLORS.border}" stroke-width="0.5" opacity="0.3"/>
  </pattern>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>

  <!-- Logo: Node circle with hole -->
  <circle cx="100" cy="315" r="40" fill="${COLORS.primary}" mask="url(#node-mask)" filter="url(#glow)"/>

  <!-- Logo: Heartbeat pulse -->
  <polyline
    points="160,315 200,315 225,250 280,380 330,280 370,315 420,315"
    stroke="${COLORS.primary}"
    stroke-width="12"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    filter="url(#glow)"
  />

  <!-- Title -->
  <text x="480" y="290" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="700" fill="${COLORS.text}">
    n8n Pulse
  </text>

  <!-- Subtitle -->
  <text x="480" y="350" font-family="Inter, system-ui, sans-serif" font-size="28" fill="${COLORS.textMuted}">
    Community health dashboard
  </text>

  <!-- Tagline -->
  <text x="480" y="400" font-family="Inter, system-ui, sans-serif" font-size="22" fill="${COLORS.textMuted}">
    Templates • Nodes • Creators • Events • GitHub
  </text>

  <!-- Attribution -->
  <text x="${WIDTH - 60}" y="${HEIGHT - 40}" font-family="Inter, system-ui, sans-serif" font-size="20" fill="${COLORS.textMuted}" text-anchor="end">
    by gui.do
  </text>

  <!-- Decorative elements - floating stats -->
  <g transform="translate(850, 200)" opacity="0.15">
    <rect x="0" y="0" width="280" height="80" rx="8" fill="${COLORS.border}"/>
    <text x="20" y="35" font-family="system-ui, sans-serif" font-size="14" fill="${COLORS.textMuted}">GitHub Stars</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="24" font-weight="600" fill="${COLORS.text}">169K+</text>
  </g>

  <g transform="translate(850, 300)" opacity="0.15">
    <rect x="0" y="0" width="280" height="80" rx="8" fill="${COLORS.border}"/>
    <text x="20" y="35" font-family="system-ui, sans-serif" font-size="14" fill="${COLORS.textMuted}">Templates</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="24" font-weight="600" fill="${COLORS.text}">2,300+</text>
  </g>

  <g transform="translate(850, 400)" opacity="0.15">
    <rect x="0" y="0" width="280" height="80" rx="8" fill="${COLORS.border}"/>
    <text x="20" y="35" font-family="system-ui, sans-serif" font-size="14" fill="${COLORS.textMuted}">Community</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="24" font-weight="600" fill="${COLORS.text}">80K+ users</text>
  </g>
</svg>`;

// Write SVG
const svgPath = join(process.cwd(), 'public', 'og-image.svg');
writeFileSync(svgPath, svgContent);
console.log(`✓ Generated ${svgPath}`);

// Also write a simple HTML version for easy PNG export
const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>n8n Pulse OG Image</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
      font-family: 'Inter', system-ui, sans-serif;
      color: white;
      overflow: hidden;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

const htmlPath = join(process.cwd(), 'public', 'og-image.html');
writeFileSync(htmlPath, htmlContent);
console.log(`✓ Generated ${htmlPath}`);

console.log(`
To create PNG version:
1. Open ${htmlPath} in a browser
2. Use browser DevTools > Elements > Screenshot node (right-click on <body>)
3. Or use Puppeteer/Playwright to capture programmatically
4. Or convert ${svgPath} using Figma, Inkscape, or https://cloudconvert.com
`);
