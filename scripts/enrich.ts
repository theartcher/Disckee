// Fills in what /add leaves out (docs/PLAN.md section 5, "Enrichment"): for
// every album with a MusicBrainz release id, the tracklist, label, genres and
// original year from MusicBrainz, and the front cover from Cover Art Archive.
// Also sets `addedBy` from the GitHub account that saved the album.
//
// Only empty fields are filled, so anything edited in /admin is kept, and
// albums that are already complete are skipped. Run by the build job in
// .github/workflows/deploy.yml; `node scripts/enrich.ts` runs it locally.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { githubLogins } from '../src/lib/album-schema.ts';

const albumsDir = 'src/content/albums';
const coversDir = 'src/assets/covers';
const userAgent = 'Disckee/1.0 ( https://github.com/theartcher/Disckee )';

interface Track {
  number: string;
  title: string;
  length?: number | null;
}

interface Release {
  date?: string;
  'label-info'?: { label?: { name: string } | null }[];
  genres?: { name: string; count: number }[];
  'release-group'?: { 'first-release-date'?: string; genres?: { name: string; count: number }[] };
  media?: { position: number; tracks?: Track[] }[];
}

// MusicBrainz allows one request per second.
let lastRequest = 0;
async function musicbrainz<T>(path: string): Promise<T> {
  const wait = lastRequest + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(`https://musicbrainz.org/ws/2${path}`, {
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`MusicBrainz answered ${response.status} for ${path}`);
  return (await response.json()) as T;
}

const duration = (ms?: number | null) => {
  if (!ms) return undefined;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const year = (date?: string) => {
  const match = date?.match(/^(\d{4})/);
  return match ? Number(match[1]) : undefined;
};

function tracklist(release: Release) {
  const media = release.media ?? [];
  return media.flatMap((medium) =>
    (medium.tracks ?? []).map((track) => ({
      // "1-3" for disc 1, track 3, as the album page and the CMS expect.
      position: media.length > 1 ? `${medium.position}-${track.number}` : track.number,
      title: track.title,
      ...(duration(track.length) && { duration: duration(track.length) }),
    })),
  );
}

function genres(release: Release) {
  const tags = release.genres?.length ? release.genres : (release['release-group']?.genres ?? []);
  return tags
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((tag) => tag.name.toLowerCase());
}

/** The 500px front cover, saved next to the others. Undefined when Cover Art Archive has none. */
async function downloadCover(mbid: string, slug: string) {
  const response = await fetch(`https://coverartarchive.org/release/${mbid}/front-500`, {
    headers: { 'User-Agent': userAgent },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Cover Art Archive answered ${response.status}`);
  const extension = response.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
  await writeFile(`${coversDir}/${slug}.${extension}`, new Uint8Array(await response.arrayBuffer()));
  return `../../assets/covers/${slug}.${extension}`;
}

/** The GitHub account whose commit created this file, mapped to arthur/marlou. */
async function addedBy(file: string) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return undefined;
  const response = await fetch(`https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(file)}&per_page=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const commits = (await response.json()) as { author?: { login: string } | null }[];
  const login = commits.at(-1)?.author?.login?.toLowerCase();
  if (login && !githubLogins[login]) console.warn(`  ${login} isn't in githubLogins (src/lib/album-schema.ts)`);
  return login ? githubLogins[login] : undefined;
}

const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const isEmpty = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);

async function enrich(name: string) {
  const file = `${albumsDir}/${name}`;
  const slug = name.replace(/\.md$/, '');
  const text = await readFile(file, 'utf8');
  const match = text.match(frontmatter);
  if (!match) return false;
  const doc = parseDocument(match[1]);
  const data = doc.toJS() as Record<string, unknown> & { ids?: { musicbrainz?: string } };
  const mbid = data.ids?.musicbrainz;
  const filled: string[] = [];
  const fill = (key: string, value: unknown) => {
    if (isEmpty(data[key]) && !isEmpty(value)) {
      doc.set(key, value);
      filled.push(key);
    }
  };

  if (mbid && isEmpty(data.tracklist)) {
    const release = await musicbrainz<Release>(`/release/${mbid}?inc=recordings+labels+genres+release-groups&fmt=json`);
    fill('tracklist', tracklist(release));
    fill('label', release['label-info']?.find((info) => info.label?.name)?.label?.name);
    fill('genres', genres(release));
    fill('year', year(release['release-group']?.['first-release-date']) ?? year(release.date));
  }
  if (mbid && isEmpty(data.cover)) {
    const cover = await downloadCover(mbid, slug);
    fill('cover', cover);
    if (cover) doc.set('coverCredit', 'cover-art-archive');
  }
  if (isEmpty(data.addedBy)) fill('addedBy', await addedBy(file));

  if (!filled.length) return false;
  await writeFile(file, `---\n${doc.toString({ lineWidth: 0 })}---\n${match[2]}`);
  console.log(`${slug}: filled in ${filled.join(', ')}`);
  return true;
}

let changed = 0;
let failed = 0;
for (const name of (await readdir(albumsDir)).filter((n) => n.endsWith('.md')).toSorted()) {
  try {
    if (await enrich(name)) changed++;
  } catch (error) {
    // One album failing (MusicBrainz down, a typo in an id) never blocks the deploy.
    failed++;
    console.warn(`::warning file=${albumsDir}/${name}::Couldn't fill in details: ${(error as Error).message}`);
  }
}
console.log(`Enriched ${changed} album(s)${failed ? `, ${failed} failed` : ''}.`);
