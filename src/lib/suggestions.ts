import { readFile } from 'node:fs/promises';

// Written by scripts/suggest.ts during the build (docs/PLAN.md section 5).

export interface SuggestedAlbum {
  /** MusicBrainz release group id. */
  id: string;
  title: string;
  year?: number;
}

export interface Suggestions {
  more: { artist: string; artistId: string; albums: SuggestedAlbum[] }[];
  similar: { artist: string; artistId: string; because: string[]; album: SuggestedAlbum }[];
}

/** Empty when the build couldn't work them out (no network, or a local build that skipped it). */
export async function loadSuggestions(): Promise<Suggestions> {
  try {
    return JSON.parse(await readFile('src/generated/suggestions.json', 'utf8')) as Suggestions;
  } catch {
    return { more: [], similar: [] };
  }
}
