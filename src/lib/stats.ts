import type { Album } from './albums';

export interface Count {
  label: string;
  count: number;
}

export interface Stats {
  cds: number;
  artists: number;
  tracks: number;
  /** Total playing time in seconds, for the CDs that have track lengths. */
  seconds: number;
  wishlist: number;
  owners: { arthur: number; marlou: number; shared: number };
  addedBy: { arthur: number; marlou: number };
  topArtists: Count[];
  genres: Count[];
  decades: Count[];
  /** CDs added per month, from the first month to now, e.g. "2026-09". */
  months: Count[];
  oldest?: { title: string; artist: string; year: number; href: string };
  longest?: { title: string; artist: string; seconds: number; href: string };
}

const toSeconds = (duration?: string) =>
  (duration ?? '').split(':').reduce((total, part) => total * 60 + (Number(part) || 0), 0);

/** Counts values, ignoring case: "5 Seconds of Summer" and "5 Seconds Of Summer" are one artist. */
function tally(values: string[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values) {
    const entry = counts.get(value.toLowerCase()) ?? { label: value, count: 0 };
    entry.count++;
    counts.set(value.toLowerCase(), entry);
  }
  return [...counts.values()];
}

const playtime = (album: Album) => album.data.tracklist.reduce((total, track) => total + toSeconds(track.duration), 0);
const byCount = (a: Count, b: Count) => b.count - a.count || a.label.localeCompare(b.label);
const monthOf = (date: Date) => date.toISOString().slice(0, 7);

/** Everything on /stats, worked out at build time from the collection. */
export function collectionStats(collection: Album[], wishlist: Album[], baseUrl: string): Stats {
  const href = (album: Album) => `${baseUrl}/albums/${album.id}/`;

  // Every month from the first addition to now, so quiet months show as gaps.
  const added = collection.map((album) => monthOf(album.data.acquiredAt ?? album.data.addedAt));
  const perMonth = new Map(tally(added).map(({ label, count }) => [label, count]));
  const months: Count[] = [];
  if (added.length) {
    const first = added.toSorted()[0];
    const cursor = new Date(`${first}-01T00:00:00Z`);
    const last = monthOf(new Date());
    while (monthOf(cursor) <= last) {
      months.push({ label: monthOf(cursor), count: perMonth.get(monthOf(cursor)) ?? 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const withYear = collection.filter((album) => album.data.year);
  const oldest = withYear.toSorted((a, b) => a.data.year! - b.data.year!)[0];
  const longest = collection.toSorted((a, b) => playtime(b) - playtime(a))[0];

  return {
    cds: collection.length,
    artists: tally(collection.map((album) => album.data.artist)).filter(({ label }) => label !== 'Various Artists').length,
    tracks: collection.reduce((total, album) => total + album.data.tracklist.length, 0),
    seconds: collection.reduce((total, album) => total + playtime(album), 0),
    wishlist: wishlist.length,
    owners: {
      arthur: collection.filter((album) => album.data.owner === 'arthur').length,
      marlou: collection.filter((album) => album.data.owner === 'marlou').length,
      shared: collection.filter((album) => album.data.owner === 'shared').length,
    },
    addedBy: {
      arthur: collection.filter((album) => album.data.addedBy === 'arthur').length,
      marlou: collection.filter((album) => album.data.addedBy === 'marlou').length,
    },
    // Compilations say little about taste.
    topArtists: tally(collection.map((album) => album.data.artist))
      .filter(({ label }) => label !== 'Various Artists')
      .toSorted(byCount)
      .slice(0, 8),
    genres: tally(collection.flatMap((album) => album.data.genres)).toSorted(byCount).slice(0, 16),
    decades: tally(withYear.map((album) => `${Math.floor(album.data.year! / 10) * 10}s`)).toSorted((a, b) => a.label.localeCompare(b.label)),
    months,
    oldest: oldest && { title: oldest.data.title, artist: oldest.data.artist, year: oldest.data.year!, href: href(oldest) },
    longest: longest && playtime(longest) > 0 ? { title: longest.data.title, artist: longest.data.artist, seconds: playtime(longest), href: href(longest) } : undefined,
  };
}
