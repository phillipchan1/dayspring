// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkManifestTokens } from './src/lib/remark-manifest-tokens';

// First Light — Dayspring marketing site.
// Static-first, island-light. No UI framework; scoped CSS mirrors the prototype.
export default defineConfig({
  // Must agree with `site.url` in src/content/site.ts — canonical links, OG
  // tags and the sitemap are all built from an origin, and two different ones
  // means one of them is emitting dead URLs.
  site: 'https://www.usedayspring.app',
  output: 'static',
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  markdown: {
    // Resolves {{manifest.token}} spans in help prose; throws on an unknown one.
    remarkPlugins: [remarkManifestTokens],
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
