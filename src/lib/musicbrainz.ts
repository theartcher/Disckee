// Browser-side MusicBrainz lookups for /add (docs/PLAN.md section 5).
// MusicBrainz and Cover Art Archive both send `Access-Control-Allow-Origin: *`,
// so the page calls them directly: no key, no server of ours.

const api = 'https://musicbrainz.org/ws/2';

/** What the picker needs to tell pressings apart and hand off to Sveltia. */
export interface Candidate {
  id: string;
  title: string;
  artist: string;
  date?: string;
  country?: string;
  label?: string;
  catalogNumber?: string;
  format?: string;
  tracks?: number;
  barcode?: string;
  disambiguation?: string;
}

interface SearchRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  barcode?: string | null;
  disambiguation?: string;
  'artist-credit'?: { name: string; joinphrase?: string }[];
  'label-info'?: { 'catalog-number'?: string | null; label?: { name: string } | null }[];
  media?: { format?: string | null; 'track-count'?: number }[];
}

// MusicBrainz asks every client for at most one request per second.
let lastRequest = 0;

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const wait = lastRequest + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(`${api}${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`MusicBrainz answered ${response.status}`);
  return (await response.json()) as T;
}

const artistCredit = (credits: SearchRelease['artist-credit']) =>
  (credits ?? []).map((credit) => credit.name + (credit.joinphrase ?? '')).join('');

function toCandidate(release: SearchRelease): Candidate {
  const labelInfo = release['label-info']?.find((info) => info.label?.name);
  const media = release.media ?? [];
  const formats = [...new Set(media.map((medium) => medium.format).filter(Boolean))];
  return {
    id: release.id,
    title: release.title,
    artist: artistCredit(release['artist-credit']),
    date: release.date || undefined,
    country: release.country || undefined,
    label: labelInfo?.label?.name,
    catalogNumber: labelInfo?.['catalog-number'] || undefined,
    format: formats.length ? `${media.length > 1 ? `${media.length}× ` : ''}${formats.join(' + ')}` : undefined,
    tracks: media.reduce((sum, medium) => sum + (medium['track-count'] ?? 0), 0) || undefined,
    barcode: release.barcode || undefined,
    disambiguation: release.disambiguation || undefined,
  };
}

async function search(query: string, signal?: AbortSignal) {
  const { releases } = await get<{ releases: SearchRelease[] }>(
    `/release/?query=${encodeURIComponent(query)}&limit=25&fmt=json`,
    signal,
  );
  return releases.map(toCandidate);
}

/**
 * Releases with this barcode. A UPC printed as 12 digits is often read as a
 * 13-digit EAN with a leading 0 (and the other way round), so both are tried.
 */
export function searchBarcode(barcode: string, signal?: AbortSignal) {
  const variants = new Set([barcode, barcode.replace(/^0/, ''), barcode.length === 12 ? `0${barcode}` : barcode]);
  return search([...variants].map((code) => `barcode:${code}`).join(' OR '), signal);
}

const quote = (text: string) => `"${text.replaceAll(/["\\]/g, ' ').trim()}"`;

/** Fallback when a barcode isn't known: search by artist and title. */
export function searchText(artist: string, title: string, signal?: AbortSignal) {
  const parts = [title && `release:${quote(title)}`, artist && `artist:${quote(artist)}`].filter(Boolean);
  return search(parts.join(' AND '), signal);
}

export const coverThumbnail = (id: string) => `https://coverartarchive.org/release/${id}/front-250`;

export const releaseUrl = (id: string) => `https://musicbrainz.org/release/${id}`;
