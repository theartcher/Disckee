// /add never saves anything itself: it opens Sveltia's new-album form with
// the fields filled in, and the signed-in owner taps Save (docs/PLAN.md section 5).

export type Status = 'collection' | 'wishlist';

export interface Draft {
  title?: string;
  artist?: string;
  status: Status;
  musicbrainz?: string;
  barcode?: string;
  year?: number;
  genres?: string[];
  label?: string;
  /** A Cover Art Archive URL; the deploy downloads it into the repo. */
  cover?: string;
  coverCredit?: 'own-photo' | 'cover-art-archive';
}

/** Sveltia's new-entry form, prefilled through URL parameters (top-level fields only). */
export function newAlbumUrl(baseUrl: string, draft: Draft) {
  const params = new URLSearchParams();
  if (draft.title) params.set('title', draft.title);
  if (draft.artist) params.set('artist', draft.artist);
  params.set('status', draft.status);
  if (draft.musicbrainz) params.set('musicbrainzId', draft.musicbrainz);
  if (draft.barcode) params.set('barcode', draft.barcode);
  if (draft.year) params.set('year', String(draft.year));
  // Sveltia splits list values on commas.
  if (draft.genres?.length) params.set('genres', draft.genres.map((genre) => genre.replaceAll(',', ' ')).join(','));
  if (draft.label) params.set('label', draft.label);
  if (draft.cover) params.set('cover', draft.cover);
  if (draft.coverCredit) params.set('coverCredit', draft.coverCredit);
  // Sveltia expects %20 rather than + for spaces.
  return `${baseUrl}/admin/#/collections/albums/new?${params.toString().replaceAll('+', '%20')}`;
}

export const editAlbumUrl = (baseUrl: string, slug: string) => `${baseUrl}/admin/#/collections/albums/entries/${slug}`;

/** An album already on the site, from /albums.json, or one this device just handed off. */
export interface Known {
  slug?: string;
  status: Status;
  title?: string;
  artist?: string;
  ids: { musicbrainz?: string; barcode?: string };
}

let published: Promise<Known[]> | undefined;

/** The albums in the last build. Empty if it can't be loaded, so adding still works. */
export function publishedAlbums(baseUrl: string) {
  published ??= fetch(`${baseUrl}/albums.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Known[]>) : []))
    .catch(() => []);
  return published;
}

// Hand-offs are remembered for an hour, long enough for the save to be
// published and the site rebuilt, so a second scan in the meantime still warns.
const recentKey = 'disckee:recent-handoffs';
const recentFor = 60 * 60 * 1000;

interface Recent extends Known {
  at: number;
}

export function recentHandoffs(): Known[] {
  try {
    const stored = JSON.parse(localStorage.getItem(recentKey) ?? '[]') as Recent[];
    return stored.filter((item) => Date.now() - item.at < recentFor);
  } catch {
    return [];
  }
}

export function rememberHandoff(draft: Draft) {
  try {
    const item: Recent = { status: draft.status, title: draft.title, artist: draft.artist, ids: { musicbrainz: draft.musicbrainz, barcode: draft.barcode }, at: Date.now() };
    localStorage.setItem(recentKey, JSON.stringify([...recentHandoffs(), item]));
  } catch {}
}

const sameBarcode = (a?: string, b?: string) => !!a && !!b && a.replace(/^0+/, '') === b.replace(/^0+/, '');

/**
 * Artist or title reduced to what stays the same across pressings: no case,
 * accents, punctuation or bracketed extras like "(Remastered)" or "[Deluxe]".
 */
export function sameAlbumKey(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const sameAlbum = (album: Known, artist?: string, title?: string) =>
  !!album.artist &&
  !!album.title &&
  !!artist &&
  !!title &&
  sameAlbumKey(album.artist) === sameAlbumKey(artist) &&
  sameAlbumKey(album.title) === sameAlbumKey(title);

export interface Duplicate {
  album: Known;
  /** False when only artist and title match: another pressing of the same album. */
  samePressing: boolean;
}

/**
 * A known album this CD duplicates: first the same pressing (release id or
 * barcode), then the same artist and title in any pressing, collection first.
 */
export function findDuplicate(
  known: Known[],
  ids: { musicbrainz?: string; barcode?: string },
  name: { artist?: string; title?: string } = {},
): Duplicate | undefined {
  const pressing =
    known.find((album) => ids.musicbrainz && album.ids.musicbrainz === ids.musicbrainz) ??
    known.find((album) => sameBarcode(album.ids.barcode, ids.barcode));
  if (pressing) return { album: pressing, samePressing: true };
  const matches = known.filter((album) => sameAlbum(album, name.artist, name.title));
  const album = matches.find((match) => match.status === 'collection') ?? matches[0];
  return album && { album, samePressing: false };
}
