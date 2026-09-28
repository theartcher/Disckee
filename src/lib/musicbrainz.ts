// Browser-side MusicBrainz lookups for /add (docs/PLAN.md section 5).
// MusicBrainz and Cover Art Archive both send `Access-Control-Allow-Origin: *`,
// so the page calls them directly: no key, no server of ours.

import { isCdFormat, releaseInclude, type Release } from './release';

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

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`MusicBrainz answered ${status}`);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const wait = lastRequest + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(`${api}${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new HttpError(response.status);
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
    `/release/?query=${encodeURIComponent(query)}&limit=100&fmt=json`,
    signal,
  );
  // CDs only: the same barcode is often shared by the digital and vinyl releases.
  return releases.filter((release) => release.media?.some((medium) => isCdFormat(medium.format))).map(toCandidate);
}

/**
 * Releases with this barcode. A UPC printed as 12 digits is often read as a
 * 13-digit EAN with a leading 0 (and the other way round), so both are tried.
 */
export function searchBarcode(barcode: string, signal?: AbortSignal) {
  const variants = new Set([barcode, barcode.replace(/^0/, ''), barcode.length === 12 ? `0${barcode}` : barcode]);
  return search([...variants].map((code) => `barcode:${code}`).join(' OR '), signal);
}

/** Lowercase words with Lucene's special characters removed. */
const words = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Allows one typo in words long enough for that not to match everything. */
const fuzzy = (word: string) => (word.length > 3 ? `${word}~1` : word);

/**
 * Fallback when a barcode isn't known: search by artist and title.
 *
 * First every word has to match in its own field ("homework" in the title,
 * "daft" and "punk" in the artist), in any order. If that finds no CD, it
 * tries again forgiving one typo per word and not caring which box a word
 * was typed in, so "Homewrk" or everything typed in one box still works.
 */
export async function searchText(artist: string, title: string, signal?: AbortSignal) {
  const titleWords = words(title);
  const artistWords = words(artist);
  const all = [...titleWords, ...artistWords];
  if (!all.length) return [];

  const exact = [
    titleWords.length && `release:(${titleWords.join(' AND ')})`,
    artistWords.length && `artist:(${artistWords.join(' AND ')})`,
  ].filter(Boolean);
  const found = await search(exact.join(' AND '), signal);
  if (found.length) return found;

  return search(all.map((word) => `(release:${fuzzy(word)} OR artist:${fuzzy(word)})`).join(' AND '), signal);
}

/** The release id in a pasted MusicBrainz release link (or a bare id). Not a release group's. */
export function releaseIdFrom(text: string) {
  if (/release-group/i.test(text)) return undefined;
  return text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0].toLowerCase();
}

/**
 * One release by id, for when it's on MusicBrainz but the searches miss it.
 * Any format: whoever pasted the link picked it on purpose. Empty if there's no such release.
 */
export async function findRelease(id: string, signal?: AbortSignal) {
  try {
    return [toCandidate(await get<SearchRelease>(`/release/${id}?inc=artist-credits+labels+media&fmt=json`, signal))];
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return [];
    throw error;
  }
}

/** Everything about one release that /add prefills: year, genres, label, tracklist, cover. */
export const lookUpRelease = (id: string, signal?: AbortSignal) =>
  get<Release>(`/release/${id}?inc=${releaseInclude}&fmt=json`, signal);

export const coverThumbnail = (id: string) => `https://coverartarchive.org/release/${id}/front-250`;

export const releaseUrl = (id: string) => `https://musicbrainz.org/release/${id}`;
