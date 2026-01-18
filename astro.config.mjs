import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [tailwind(), sitemap()],
  output: 'static',
  site: 'https://n8n-pulse.gui.do',
  prefetch: {
    // Use 'hover' strategy: prefetch starts on hover, before click
    // Pages load instantly when clicked (small bandwidth cost for static site)
    defaultStrategy: 'hover',
    prefetchAll: true,
  },
});
