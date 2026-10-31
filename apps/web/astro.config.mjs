// @ts-check
import { defineConfig } from 'astro/config';

// Za GitHub Pages postavi SITE_URL=https://nrisek.github.io i BASE_PATH=/ok-strigova;
// za vlastitu domenu samo SITE_URL.
export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
});
