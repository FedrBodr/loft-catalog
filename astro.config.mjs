import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://loftmap.ru',
  trailingSlash: 'always',
  integrations: [
    preact(),
    sitemap({ filter: (page) => !page.includes('/edit/') && !page.includes('/data/') }),
  ],
  vite: { plugins: [tailwindcss()] },
});
