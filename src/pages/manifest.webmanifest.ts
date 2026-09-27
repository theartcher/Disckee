import type { APIRoute } from 'astro';
import { baseUrl } from '../lib/albums';
import { manifest } from '../lib/manifest';

export const GET: APIRoute = () => manifest({ id: `${baseUrl}/`, name: 'Disckee', shortName: 'Disckee', startUrl: `${baseUrl}/` });
