import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { albumSchema } from './lib/album-schema';

const albums = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/albums' }),
  schema: ({ image }) => albumSchema(image),
});

export const collections = { albums };
