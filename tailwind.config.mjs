/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // n8n brand colors
        'n8n-primary': '#ff6d5a',
        'n8n-dark': '#1a1a2e',
        'n8n-darker': '#0f0f1a',
        'n8n-card': 'rgba(255, 255, 255, 0.05)',
        'n8n-border': 'rgba(255, 255, 255, 0.1)',
        // Accessible text colors (WCAG AA compliant on n8n-darker background)
        // These override problematic gray shades for accessibility
        gray: {
          // Keep existing grays but override 400/500 for better contrast
          400: '#9ca3af', // Default gray-400 (6.5:1 on #0f0f1a) - keep as-is
          500: '#9ca3af', // Upgraded from #6b7280 (3.9:1) to match gray-400 (6.5:1)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
