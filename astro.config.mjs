import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { publicLofts } from './src/lib/data.ts';
import { noindexPaths } from './src/lib/pages.ts';

// Страницы с noindex (непроверенные карточки, списки без проверенных лофтов) в sitemap не попадают.
const hidden = noindexPaths(publicLofts());

export default defineConfig({
  site: 'https://loftmap.ru',
  trailingSlash: 'always',
  integrations: [
    preact(),
    sitemap({ filter: (page) => !page.includes('/edit/') && !page.includes('/data/') && !/\/dlya\/[^/]+\/$/.test(page) && !page.endsWith('/404/') && !hidden.has(new URL(page).pathname) }),
  ],
  vite: { plugins: [tailwindcss()] },
});
