// @ts-check
import { defineConfig } from 'astro/config';

// Served from https://theartcher.github.io/Disckee (see docs/PLAN.md section 4).
export default defineConfig({
  site: 'https://theartcher.github.io',
  base: '/Disckee',
  trailingSlash: 'ignore',
});
