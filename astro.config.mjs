// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Served from https://theartcher.github.io/Disckee (see docs/PLAN.md section 4).
export default defineConfig({
  site: 'https://theartcher.github.io',
  base: '/Disckee',
  trailingSlash: 'ignore',
  integrations: [react()],
});
