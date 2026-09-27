import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Used by /add to spot duplicates (docs/PLAN.md section 3).
export const GET: APIRoute = async () => {
  const albums = await getCollection('albums');
  const body = albums
    .map(({ id, data }) => ({ slug: id, status: data.status, ids: { musicbrainz: data.musicbrainzId, barcode: data.barcode } }))
    .toSorted((a, b) => a.slug.localeCompare(b.slug));
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
};
