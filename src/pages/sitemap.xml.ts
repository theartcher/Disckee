import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// The public pages, for search engines. Owners' tools are left out (they're noindex too).
export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const albums = await getCollection('albums');
  const paths = ['', 'collection/', 'wishlist/', 'stats/', ...albums.map((album) => `albums/${album.id}/`)];
  const urls = paths.map((path) => `  <url><loc>${new URL(`${base}/${path}`, site).href}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
