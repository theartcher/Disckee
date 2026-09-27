// Wishlist suggestions for the /suggestions page, worked out during the build:
// - more studio albums by artists already in the collection (MusicBrainz), and
// - similar artists, from what people listen to together (ListenBrainz), with
//   one of their albums to start with.
// Both are free, keyless, public-domain sources. Lookups are cached between
// runs (actions/cache in deploy.yml), so a deploy only asks for what's new.
//
// Never fails the build: without network the page just shows nothing.
// `node scripts/suggest.ts` runs it locally.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';

const albumsDir = 'src/content/albums';
const cacheFile = '.cache/suggestions.json';
const outFile = 'src/generated/suggestions.json';
const userAgent = 'Disckee/1.0 ( https://github.com/theartcher/Disckee )';
const week = 7 * 24 * 60 * 60 * 1000;

// MusicBrainz allows one request per second.
let lastRequest = 0;
async function getJson<T>(url: string): Promise<T> {
  if (url.startsWith('https://musicbrainz.org')) {
    const wait = lastRequest + 1100 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
  }
  let response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  // MusicBrainz answers 503 when it's busy or we're a bit fast: wait and try once more.
  if (response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  }
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return (await response.json()) as T;
}

interface ReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
}
interface Cache {
  /** Release id → its first credited artist. Never changes. */
  releaseArtist: Record<string, { id: string; name: string }>;
  /** Artist id → studio albums, refreshed weekly. */
  albums: Record<string, { at: number; groups: ReleaseGroup[] }>;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const yearOf = (date?: string) => (date?.match(/^\d{4}/) ? Number(date.slice(0, 4)) : undefined);

const toAlbum = (group: ReleaseGroup) => ({ id: group.id, title: group.title, year: yearOf(group['first-release-date']) });

// Various Artists: suggesting "more by them" makes no sense.
const variousArtists = '89ad4ac3-39f7-470e-963a-56509c546377';

async function main() {
  const cache: Cache = await readFile(cacheFile, 'utf8')
    .then((text) => JSON.parse(text) as Cache)
    .catch(() => ({ releaseArtist: {}, albums: {} }));

  // What we have or want, by title, and one release id per artist name to find the artist with.
  const known = new Set<string>();
  const releases: { mbid: string; artist: string }[] = [];
  for (const name of (await readdir(albumsDir)).filter((n) => n.endsWith('.md'))) {
    const match = (await readFile(`${albumsDir}/${name}`, 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    const data = parseDocument(match[1]).toJS() as { title: string; artist: string; musicbrainzId?: string };
    known.add(normalize(data.title));
    if (data.musicbrainzId) releases.push({ mbid: data.musicbrainzId, artist: data.artist });
  }

  // Our artists, with how many of their albums we have.
  const artists = new Map<string, { name: string; count: number }>();
  for (const release of releases) {
    let artist = cache.releaseArtist[release.mbid];
    if (!artist) {
      try {
        const data = await getJson<{ 'artist-credit'?: { artist: { id: string; name: string } }[] }>(
          `https://musicbrainz.org/ws/2/release/${release.mbid}?inc=artist-credits&fmt=json`,
        );
        const credit = data['artist-credit']?.[0]?.artist;
        if (!credit) continue;
        artist = cache.releaseArtist[release.mbid] = { id: credit.id, name: credit.name };
      } catch (error) {
        console.warn(`  ${release.artist}: ${(error as Error).message}`);
        continue;
      }
    }
    if (artist.id === variousArtists) continue;
    const entry = artists.get(artist.id) ?? { name: artist.name, count: 0 };
    entry.count++;
    artists.set(artist.id, entry);
  }
  console.log(`${artists.size} artists in the collection`);

  async function studioAlbums(artistId: string) {
    const cached = cache.albums[artistId];
    if (cached && Date.now() - cached.at < week) return cached.groups;
    const data = await getJson<{ 'release-groups': ReleaseGroup[] }>(
      `https://musicbrainz.org/ws/2/release-group?artist=${artistId}&type=album&limit=100&fmt=json`,
    );
    // Studio albums only: no live albums, compilations, soundtracks or remixes.
    const groups = data['release-groups']
      .filter((group) => group['primary-type'] === 'Album' && !group['secondary-types']?.length && group['first-release-date'])
      .map(({ id, title, 'first-release-date': date }) => ({ id, title, 'first-release-date': date }));
    cache.albums[artistId] = { at: Date.now(), groups };
    return groups;
  }

  // 1. More by artists we have, most-collected artists first.
  const more = [];
  for (const [id, artist] of [...artists].toSorted(([, a], [, b]) => b.count - a.count)) {
    try {
      const missing = (await studioAlbums(id)).filter((group) => !known.has(normalize(group.title)));
      if (missing.length) {
        more.push({
          artist: artist.name,
          artistId: id,
          albums: missing.toSorted((a, b) => (b['first-release-date'] ?? '').localeCompare(a['first-release-date'] ?? '')).slice(0, 4).map(toAlbum),
        });
      }
    } catch (error) {
      console.warn(`  ${artist.name}: ${(error as Error).message}`);
    }
  }

  // 2. Similar artists we don't have yet, scored across everyone we do have.
  const similar = new Map<string, { name: string; score: number; because: Set<string> }>();
  for (const [id, artist] of artists) {
    try {
      const results = await getJson<unknown>(
        `https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=${id}&algorithm=session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30`,
      );
      // The labs API has answered both a flat list and a list per input artist.
      const rows = (Array.isArray(results) ? results.flat(2) : []) as { artist_mbid?: string; name?: string; score?: number }[];
      for (const row of rows.slice(0, 10)) {
        if (!row.artist_mbid || !row.name || artists.has(row.artist_mbid)) continue;
        const entry = similar.get(row.artist_mbid) ?? { name: row.name, score: 0, because: new Set() };
        entry.score += (row.score ?? 1) * artist.count;
        entry.because.add(artist.name);
        similar.set(row.artist_mbid, entry);
      }
    } catch (error) {
      console.warn(`  similar to ${artist.name}: ${(error as Error).message}`);
    }
  }
  const alike = [];
  for (const [id, artist] of [...similar].toSorted(([, a], [, b]) => b.score - a.score).slice(0, 12)) {
    try {
      // Their latest studio album is a good place to start.
      const latest = (await studioAlbums(id)).toSorted((a, b) => (b['first-release-date'] ?? '').localeCompare(a['first-release-date'] ?? ''))[0];
      if (latest) alike.push({ artist: artist.name, artistId: id, because: [...artist.because].slice(0, 2), album: toAlbum(latest) });
    } catch (error) {
      console.warn(`  ${artist.name}: ${(error as Error).message}`);
    }
  }

  await mkdir('.cache', { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache));
  await mkdir('src/generated', { recursive: true });
  await writeFile(outFile, JSON.stringify({ more, similar: alike }, null, 2));
  for (const item of alike) console.log(`  ${item.artist}: ${item.album.title}, because of ${item.because.join(' and ')}`);
  console.log(`Suggested ${more.reduce((n, m) => n + m.albums.length, 0)} albums by artists we have and ${alike.length} similar artists.`);
}

try {
  await main();
} catch (error) {
  console.warn(`::warning::Couldn't work out wishlist suggestions: ${(error as Error).message}`);
}
