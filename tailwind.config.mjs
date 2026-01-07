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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
