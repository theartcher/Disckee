import { baseUrl } from './albums';

const icons = [
  { src: `${baseUrl}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: `${baseUrl}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
  // The disc sits inside the safe zone, so the same icon works when a phone crops it to a circle.
  { src: `${baseUrl}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

/**
 * A web app manifest, so the site opens full-screen from the home screen.
 * No service worker: nothing is cached for offline use.
 */
export function manifest(app: { id: string; name: string; shortName: string; startUrl: string }) {
  const body = {
    id: app.id,
    name: app.name,
    short_name: app.shortName,
    start_url: app.startUrl,
    scope: `${baseUrl}/`,
    display: 'standalone',
    background_color: '#f5f5f5',
    theme_color: '#ffffff',
    icons,
    shortcuts: [
      { name: 'Add a CD', short_name: 'Add', url: `${baseUrl}/add/`, icons: [icons[0]] },
      { name: 'Wishlist', url: `${baseUrl}/wishlist/`, icons: [icons[0]] },
    ],
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
}
