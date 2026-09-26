import { getCollection, type CollectionEntry } from 'astro:content';

export type Album = CollectionEntry<'albums'>;

const names = { arthur: 'Arthur', marlou: 'Marlou', shared: 'Arthur & Marlou' } as const;

export const personName = (key: keyof typeof names) => names[key];

/** Albums with the given status, newest first. */
export async function albumsByStatus(status: Album['data']['status']) {
  const albums = await getCollection('albums', ({ data }) => data.status === status);
  return albums.sort((a, b) => b.data.addedAt.valueOf() - a.data.addedAt.valueOf());
}

export const albumUrl = (album: Album) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/albums/${album.id}/`;

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

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
  return [...discs.entries()].map(([disc, tracks]) => ({ disc, tracks }));
}
