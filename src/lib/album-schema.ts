import { z } from 'astro/zod';

// Single source of truth for an album (docs/PLAN.md section 3). The Sveltia
// CMS fields in src/lib/cms.ts mirror it, and the build fails if they drift.
export const people = ['arthur', 'marlou'] as const;

/**
 * GitHub accounts of the people above, lowercase. The enrichment Action
 * (scripts/enrich.ts) sets `addedBy` from the account that saved an album.
 */
export const githubLogins: Record<string, (typeof people)[number]> = {
  theartcher: 'arthur',
};

/**
 * The album schema. `image` is Astro's image() helper in the content config;
 * the CMS drift check passes a plain string schema instead.
 */
export const albumSchema = <Image extends z.ZodType>(image: () => Image) =>
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
  });
