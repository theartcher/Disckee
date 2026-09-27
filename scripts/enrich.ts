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
import {
  frontCover500,
  releaseGenres,
  releaseInclude,
  releaseLabel,
  releaseTracklist,
  releaseYear,
  type Release,
} from '../src/lib/release.ts';

const albumsDir = 'src/content/albums';
const coversDir = 'src/assets/covers';
const userAgent = 'Disckee/1.0 ( https://github.com/theartcher/Disckee )';

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

/**
 * Downloads a cover next to the others and returns its path for the album.
 * Undefined when there's no such cover. /add prefills `cover` with the Cover
 * Art Archive URL, which this turns into a local file.
 */
async function downloadCover(url: string, slug: string) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status} for the cover`);
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
  const data = doc.toJS() as Record<string, unknown> & { musicbrainzId?: string };
  const mbid = data.musicbrainzId;
  const filled: string[] = [];
  const fill = (key: string, value: unknown) => {
    if (isEmpty(data[key]) && !isEmpty(value)) {
      doc.set(key, value);
      filled.push(key);
    }
  };

  if (mbid && isEmpty(data.tracklist)) {
    const release = await musicbrainz<Release>(`/release/${mbid}?inc=${releaseInclude}&fmt=json`);
    fill('tracklist', releaseTracklist(release));
    fill('label', releaseLabel(release));
    fill('genres', releaseGenres(release));
    fill('year', releaseYear(release));
  }
  const remoteCover = typeof data.cover === 'string' && /^https?:\/\//.test(data.cover) ? data.cover : undefined;
  if (remoteCover || (mbid && isEmpty(data.cover))) {
    let cover: string | undefined;
    try {
      cover = await downloadCover(remoteCover ?? frontCover500(mbid!), slug);
    } catch (error) {
      if (!remoteCover) throw error;
      console.warn(`::warning file=${file}::${(error as Error).message}`);
    }
    // A cover URL that can't be downloaded is dropped, or the build would fail on it.
    if (remoteCover && !cover) {
      doc.delete('cover');
      filled.push('cover (removed: download failed)');
    }
    if (cover) {
      doc.set('cover', cover);
      if (isEmpty(data.coverCredit) || remoteCover) doc.set('coverCredit', 'cover-art-archive');
      filled.push('cover');
    }
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
