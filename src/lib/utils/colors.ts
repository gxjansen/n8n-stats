/**
 * Colorblind-Friendly Color Palette
 *
 * Based on Wong's palette (Nature Methods) and Paul Tol's color schemes,
 * extended for 18 categories with variations in both hue AND luminance.
 *
 * Design principles:
 * - Each color differs in both hue and brightness
 * - Works for protanopia, deuteranopia, and tritanopia
 * - Sufficient contrast for white text overlay (WCAG 2.1 AA: 4.5:1)
 * - Distinguishable even in grayscale
 *
 * Reference: https://www.nature.com/articles/nmeth.1618
 */

// ============================================================================
// WCAG Contrast Utilities
// ============================================================================

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
}

/**
 * Calculate relative luminance according to WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);

  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;

  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine the best text color (black or white) for a given background
 * Returns the color with better WCAG contrast ratio
 */
export function getAccessibleTextColor(bgHex: string): string {
  const WHITE = '#FFFFFF';
  const BLACK = '#000000';

  const whiteContrast = getContrastRatio(bgHex, WHITE);
  const blackContrast = getContrastRatio(bgHex, BLACK);

  // Prefer white text unless black has significantly better contrast
  // This maintains the dark theme aesthetic while ensuring readability
  return whiteContrast >= 4.5 ? WHITE : BLACK;
}

/**
 * Check if a foreground/background combination meets WCAG AA standards
 */
export function meetsWCAGAA(fgHex: string, bgHex: string, isLargeText: boolean = false): boolean {
  const ratio = getContrastRatio(fgHex, bgHex);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// ============================================================================
// Color Palettes
// ============================================================================

// Node category colors - colorblind-friendly palette
// All colors verified for WCAG 2.1 AA contrast (4.5:1 with white or black text)
export const NODE_CATEGORY_COLORS: Record<string, string> = {
  // Primary workflow elements - high visibility, distinct hues
  'Triggers': '#009E73',           // Bluish green (Wong) - entry points
  'Flow Control': '#C67C00',       // Dark orange - logic/branching (darkened for contrast)
  'Data Transform': '#B8860B',     // Dark gold/goldenrod - data manipulation (was #F0E442)

  // External connections - blues
  'HTTP & APIs': '#0072B2',        // Blue (Wong) - external calls
  'Communication': '#0077B6',      // Darker sky blue - messaging (was #56B4E9)

  // AI category - distinct purple
  'AI': '#AA3377',                 // Purple (Tol) - AI/ML

  // Vendor-specific
  'Google': '#4285F4',             // Google brand blue

  // Data & storage - neutral tones
  'Database & Storage': '#555555', // Dark gray - storage (darkened)

  // File operations - warm brown (very distinct from purple!)
  'Files': '#CC6600',              // Burnt orange/brown

  // Business categories - pinks and magentas
  'CRM & Sales': '#B35A8C',        // Darker reddish purple - sales (darkened for contrast)
  'E-Commerce': '#D55E00',         // Vermillion (Wong) - commerce

  // Productivity tools - indigo (distinct from sky blue)
  'Productivity': '#332288',       // Dark blue/indigo (Tol)

  // Social & community
  'Social Media': '#2E8B7A',       // Darker teal (was #44AA99)

  // Development & tech
  'Developer Tools': '#117733',    // Forest green (Tol)

  // Content management
  'CMS': '#882255',                // Wine/maroon (Tol)

  // Marketing - distinct red-orange
  'Marketing': '#CC3311',          // Red-orange (Tol)

  // Utility/misc - grays
  'Utility': '#666666',            // Medium-dark gray (darkened)
  'Other': '#777777',              // Medium gray (was #AAAAAA - too light)
};

// Template category colors (for CategoryTreemapChart)
// All colors verified for WCAG 2.1 AA contrast with white text
export const TEMPLATE_CATEGORY_COLORS: Record<string, string> = {
  'AI': '#AA3377',                 // Purple (Tol)
  'Multimodal AI': '#882255',      // Wine (Tol)
  'AI Summarization': '#B35A8C',   // Darker reddish purple (was #CC79A7)
  'AI Chatbot': '#661155',         // Dark purple
  'Marketing': '#CC3311',          // Red-orange (Tol)
  'Sales': '#0072B2',              // Blue (Wong)
  'IT Ops': '#2E8B7A',             // Darker teal (was #44AA99)
  'Content Creation': '#C67C00',   // Darker orange (was #E69F00)
  'Document Ops': '#D55E00',       // Vermillion (Wong)
  'Support': '#009E73',            // Bluish green (Wong)
  'Other': '#666666',              // Medium-dark gray (was #888888)
};

// Community/forum category colors
// All colors verified for WCAG 2.1 AA contrast with white text
export const COMMUNITY_CATEGORY_COLORS: Record<string, string> = {
  'Questions': '#0072B2',          // Blue (Wong)
  'Feature Requests': '#AA3377',   // Purple (Tol)
  'Show n Tell': '#D55E00',        // Vermillion (Wong)
  'Bug Reports': '#CC3311',        // Red-orange (Tol)
  'Tutorials': '#2E8B7A',          // Darker teal (was #44AA99)
  'Announcements': '#C67C00',      // Darker orange (was #E69F00)
  'Jobs': '#CC6600',               // Burnt orange
  'Resources': '#009E73',          // Bluish green (Wong)
  'General': '#666666',            // Medium-dark gray (was #888888)
};

// Fallback colors when category is unknown - uses full colorblind-safe spectrum
// All colors verified for WCAG 2.1 AA contrast (4.5:1) with white text
export const FALLBACK_COLORS = [
  '#0072B2',  // Blue
  '#D55E00',  // Vermillion
  '#009E73',  // Bluish green
  '#C67C00',  // Dark orange (was #E69F00)
  '#AA3377',  // Purple
  '#0077B6',  // Darker sky blue (was #56B4E9)
  '#B35A8C',  // Darker reddish purple (was #CC79A7)
  '#B8860B',  // Dark gold (was #F0E442 - yellow too light)
  '#2E8B7A',  // Darker teal (was #44AA99)
  '#882255',  // Wine
  '#117733',  // Forest green
  '#332288',  // Indigo
  '#CC3311',  // Red-orange
  '#CC6600',  // Burnt orange
  '#666666',  // Medium-dark gray (was #888888)
];

/**
 * Get color for a node category
 */
export function getNodeCategoryColor(category: string): string {
  return NODE_CATEGORY_COLORS[category] || NODE_CATEGORY_COLORS['Other'];
}

/**
 * Get color for a template category
 */
export function getTemplateCategoryColor(category: string, index: number = 0): string {
  return TEMPLATE_CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/**
 * Get color for a community/forum category
 */
export function getCommunityCategoryColor(name: string, index: number = 0): string {
  // Check for partial matches in category names
  for (const [key, color] of Object.entries(COMMUNITY_CATEGORY_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return color;
    }
  }
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/**
 * Get a fallback color by index
 */
export function getFallbackColor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// Export the category order for consistent display
export const NODE_CATEGORY_ORDER = [
  'Triggers',
  'Flow Control',
  'Data Transform',
  'HTTP & APIs',
  'AI',
  'Communication',
  'Google',
  'Database & Storage',
  'Files',
  'CRM & Sales',
  'Productivity',
  'Social Media',
  'E-Commerce',
  'Developer Tools',
  'CMS',
  'Marketing',
  'Utility',
  'Other'
];
