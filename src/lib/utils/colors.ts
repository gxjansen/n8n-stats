/**
 * Colorblind-Friendly Color Palette
 *
 * Based on Wong's palette (Nature Methods) and Paul Tol's color schemes,
 * extended for 18 categories with variations in both hue AND luminance.
 *
 * Design principles:
 * - Each color differs in both hue and brightness
 * - Works for protanopia, deuteranopia, and tritanopia
 * - Sufficient contrast for white text overlay
 * - Distinguishable even in grayscale
 *
 * Reference: https://www.nature.com/articles/nmeth.1618
 */

// Node category colors - colorblind-friendly palette
export const NODE_CATEGORY_COLORS: Record<string, string> = {
  // Primary workflow elements - high visibility, distinct hues
  'Triggers': '#009E73',           // Bluish green (Wong) - entry points
  'Flow Control': '#E69F00',       // Orange (Wong) - logic/branching
  'Data Transform': '#F0E442',     // Yellow (Wong) - data manipulation

  // External connections - blues
  'HTTP & APIs': '#0072B2',        // Blue (Wong) - external calls
  'Communication': '#56B4E9',      // Sky blue (Wong) - messaging

  // AI category - distinct purple
  'AI': '#AA3377',                 // Purple (Tol) - AI/ML

  // Vendor-specific
  'Google': '#4285F4',             // Google brand blue

  // Data & storage - neutral tones
  'Database & Storage': '#666666', // Dark gray - storage

  // File operations - warm brown (very distinct from purple!)
  'Files': '#CC6600',              // Burnt orange/brown

  // Business categories - pinks and magentas
  'CRM & Sales': '#CC79A7',        // Reddish purple (Wong) - sales
  'E-Commerce': '#D55E00',         // Vermillion (Wong) - commerce

  // Productivity tools - indigo (distinct from sky blue)
  'Productivity': '#332288',       // Dark blue/indigo (Tol)

  // Social & community
  'Social Media': '#44AA99',       // Teal (Tol)

  // Development & tech
  'Developer Tools': '#117733',    // Forest green (Tol)

  // Content management
  'CMS': '#882255',                // Wine/maroon (Tol)

  // Marketing - distinct red-orange
  'Marketing': '#CC3311',          // Red-orange (Tol)

  // Utility/misc - grays
  'Utility': '#888888',            // Medium gray
  'Other': '#AAAAAA',              // Light gray
};

// Template category colors (for CategoryTreemapChart)
export const TEMPLATE_CATEGORY_COLORS: Record<string, string> = {
  'AI': '#AA3377',                 // Purple (Tol)
  'Multimodal AI': '#882255',      // Wine (Tol)
  'AI Summarization': '#CC79A7',   // Reddish purple (Wong)
  'AI Chatbot': '#661155',         // Dark purple
  'Marketing': '#CC3311',          // Red-orange (Tol)
  'Sales': '#0072B2',              // Blue (Wong)
  'IT Ops': '#44AA99',             // Teal (Tol)
  'Content Creation': '#E69F00',   // Orange (Wong)
  'Document Ops': '#D55E00',       // Vermillion (Wong)
  'Support': '#009E73',            // Bluish green (Wong)
  'Other': '#888888',              // Medium gray
};

// Community/forum category colors
export const COMMUNITY_CATEGORY_COLORS: Record<string, string> = {
  'Questions': '#0072B2',          // Blue (Wong)
  'Feature Requests': '#AA3377',   // Purple (Tol)
  'Show n Tell': '#D55E00',        // Vermillion (Wong)
  'Bug Reports': '#CC3311',        // Red-orange (Tol)
  'Tutorials': '#44AA99',          // Teal (Tol)
  'Announcements': '#E69F00',      // Orange (Wong)
  'Jobs': '#CC6600',               // Burnt orange
  'Resources': '#009E73',          // Bluish green (Wong)
  'General': '#888888',            // Medium gray
};

// Fallback colors when category is unknown - uses full colorblind-safe spectrum
export const FALLBACK_COLORS = [
  '#0072B2',  // Blue
  '#D55E00',  // Vermillion
  '#009E73',  // Bluish green
  '#E69F00',  // Orange
  '#AA3377',  // Purple
  '#56B4E9',  // Sky blue
  '#CC79A7',  // Reddish purple
  '#F0E442',  // Yellow
  '#44AA99',  // Teal
  '#882255',  // Wine
  '#117733',  // Forest green
  '#332288',  // Indigo
  '#CC3311',  // Red-orange
  '#CC6600',  // Burnt orange
  '#888888',  // Gray
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
