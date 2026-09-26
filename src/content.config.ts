import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Single source of truth for an album. The Sveltia CMS config (phase 2)
// mirrors these fields; see docs/PLAN.md section 3.
const people = ['arthur', 'marlou'] as const;

const albums = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/albums' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      artist: z.string().min(1),
      year: z.number().int().min(1900).max(2100).optional(),
      genres: z.array(z.string().toLowerCase()).default([]),
      label: z.string().optional(),
      tracklist: z
        .array(
          z.object({
            // A string so multi-disc positions like "1-3" work.
            position: z.string(),
            title: z.string(),
            duration: z.string().optional(),
          }),
        )
        .default([]),
      // Optional: the enrichment Action fills it in after a save from /add.
      cover: image().optional(),
      coverCredit: z.enum(['cover-art-archive', 'own-photo', 'other']).optional(),
      status: z.enum(['collection', 'wishlist']),
      owner: z.enum([...people, 'shared']).default('shared'),
      addedBy: z.enum(people).optional(),
      addedAt: z.coerce.date(),
      acquiredAt: z.coerce.date().optional(),
      note: z.string().max(280).optional(),
      favorite: z.boolean().default(false),
      ids: z
        .object({
          musicbrainz: z.uuid().optional(),
          barcode: z.string().regex(/^\d{8,14}$/).optional(),
        })
        .default({}),
    }),
});

export const collections = { albums };
