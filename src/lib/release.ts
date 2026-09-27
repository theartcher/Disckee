// Turns a MusicBrainz release into album fields. Shared by /add (in the
// browser) and scripts/enrich.ts (in the deploy), so both fill in the same
// values. No imports, so Node can run it as-is.

/** The release lookup both use: /ws/2/release/<id>?inc=recordings+labels+genres+release-groups */
export const releaseInclude = 'recordings+labels+genres+release-groups';

interface Genre {
  name: string;
  count: number;
}

export interface Release {
  date?: string;
  'label-info'?: { label?: { name: string } | null }[];
  genres?: Genre[];
  'release-group'?: { 'first-release-date'?: string; genres?: Genre[] };
  media?: { position: number; tracks?: { number: string; title: string; length?: number | null }[] }[];
  'cover-art-archive'?: { front?: boolean };
}

export interface Track {
  position: string;
  title: string;
  duration?: string;
}

const duration = (ms?: number | null) => {
  if (!ms) return undefined;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const yearOf = (date?: string) => {
  const match = date?.match(/^(\d{4})/);
  return match ? Number(match[1]) : undefined;
};

/** The original release year (of the first release in the group), else this pressing's. */
export const releaseYear = (release: Release) => yearOf(release['release-group']?.['first-release-date']) ?? yearOf(release.date);

export const releaseLabel = (release: Release) => release['label-info']?.find((info) => info.label?.name)?.label?.name;

/** Up to four genres, most voted first, from the release or else its release group. */
export function releaseGenres(release: Release) {
  const tags = release.genres?.length ? release.genres : (release['release-group']?.genres ?? []);
  return tags
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((tag) => tag.name.toLowerCase());
}

export function releaseTracklist(release: Release): Track[] {
  const media = release.media ?? [];
  return media.flatMap((medium) =>
    (medium.tracks ?? []).map((track) => {
      const length = duration(track.length);
      return {
        // "1-3" for disc 1, track 3, as the album page and the CMS expect.
        position: media.length > 1 ? `${medium.position}-${track.number}` : track.number,
        title: track.title,
        ...(length && { duration: length }),
      };
    }),
  );
}

/** Cover Art Archive's 500px front cover, the size the site stores. */
export const frontCover500 = (id: string) => `https://coverartarchive.org/release/${id}/front-500`;

/** Physical CD formats: "CD", "Enhanced CD", "HDCD", "SHM-CD", "Hybrid SACD", "CD-R"… */
export const isCdFormat = (format?: string | null) => !!format && /CD/.test(format);
