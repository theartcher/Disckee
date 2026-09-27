import { getCollection, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';

export type Album = CollectionEntry<'albums'>;
export type Section = 'collection' | 'wishlist';

const names = { arthur: 'Arthur', marlou: 'Marlou', shared: 'Arthur & Marlou' } as const;

export const personName = (key: keyof typeof names) => names[key];

export const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Albums with the given status, newest first. */
export async function albumsByStatus(status: Section) {
  const albums = await getCollection('albums', ({ data }) => data.status === status);
  return albums.toSorted((a, b) => b.data.addedAt.valueOf() - a.data.addedAt.valueOf());
}

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Plain, serialisable props for the React components. */
export interface CoverImage {
  src: string;
  srcSet: string;
}

export interface AlbumCard {
  id: string;
  href: string;
  title: string;
  artist: string;
  year?: number;
  cover?: CoverImage;
}

async function coverImage(album: Album, widths: number[]): Promise<CoverImage | undefined> {
  const { cover } = album.data;
  if (!cover) return undefined;
  // A cover prefilled by /add is a Cover Art Archive URL until the deploy's
  // enrichment step downloads it (pull request builds skip that step).
  // Shown as-is rather than resized, so the build never depends on fetching it.
  if (typeof cover === 'string') return { src: cover, srcSet: '' };
  const image = await getImage({ src: cover, widths, format: 'webp' });
  return { src: image.src, srcSet: image.srcSet.attribute };
}

export async function toCard(album: Album): Promise<AlbumCard> {
  return {
    id: album.id,
    href: `${baseUrl}/albums/${album.id}/`,
    title: album.data.title,
    artist: album.data.artist,
    year: album.data.year,
    cover: await coverImage(album, [240, 360, 480]),
  };
}

export interface AlbumDetail extends AlbumCard {
  status: Section;
  label?: string;
  genres: string[];
  owner: string;
  addedBy?: string;
  addedAt: string;
  acquiredAt?: string;
  note?: string;
  musicbrainzUrl?: string;
  discs: { disc: string; tracks: { position: string; title: string; duration?: string }[] }[];
}

export async function toDetail(album: Album): Promise<AlbumDetail> {
  const d = album.data;
  return {
    ...(await toCard(album)),
    cover: await coverImage(album, [360, 500]),
    status: d.status,
    label: d.label,
    genres: d.genres,
    owner: personName(d.owner),
    addedBy: d.addedBy && personName(d.addedBy),
    addedAt: formatDate(d.addedAt),
    acquiredAt: d.acquiredAt && formatDate(d.acquiredAt),
    note: d.note,
    musicbrainzUrl: d.musicbrainzId && `https://musicbrainz.org/release/${d.musicbrainzId}`,
    discs: groupByDisc(d.tracklist),
  };
}

/** Groups a tracklist per disc when positions look like "1-3" or "2.5". */
export function groupByDisc(tracks: Album['data']['tracklist']) {
  const discs = new Map<string, typeof tracks>();
  for (const track of tracks) {
    const match = track.position.match(/^(\d+)[-.](\d+)$/);
    const disc = match ? match[1] : '1';
    const list = discs.get(disc) ?? [];
    list.push({ ...track, position: match ? match[2] : track.position });
    discs.set(disc, list);
  }
  return [...discs.entries()].map(([disc, discTracks]) => ({ disc, tracks: discTracks }));
}
