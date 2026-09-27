import type { APIRoute } from 'astro';
import { baseUrl } from '../lib/albums';
import { manifest } from '../lib/manifest';

// /add as its own home-screen app, so it opens straight on the scanner.
export const GET: APIRoute = () => manifest({ id: `${baseUrl}/add/`, name: 'Disckee: add a CD', shortName: 'Add CD', startUrl: `${baseUrl}/add/` });
