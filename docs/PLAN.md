# Disckee: project plan

A free, public website where Arthur and his partner catalog their shared CD
collection and wishlist. Friends and family can browse and quietly claim
wishlist items as gifts. Adding a CD takes a few taps on a phone: scan the
barcode, pick the right release, save.

This is the refined version of the original plan. Section 9 lists what changed
and why; section 10 lists the decisions still open (with the default we build
on until someone says otherwise).

---

## 1. Hard constraints

- **Zero cost.** Free tiers only (GitHub, Cloudflare Workers/D1/Turnstile,
  MusicBrainz, Discogs).
- **Public to read, two people to edit.** Write access is enforced by GitHub
  itself: only repo collaborators can commit.
- **Non-technical editing.** No pull requests and no hand-edited files for
  day-to-day use. Everything goes through `/add` (new CDs) and `/admin`
  (edits).
- **Official APIs only, never scraping.** API tokens live only in the Worker.
- **Mobile-first web** (not a native app). Adding and browsing happen mostly
  on phones.

## 2. Architecture

```
            phone / browser
   ┌──────────────┼─────────────────────────────┐
   │              │                             │
 public site    /add (scanner)             /admin (Sveltia CMS)
 (static)       - scan barcode             - edit, "got it", notes, delete
   │            - pick release                  │
   │            - commit via GitHub API ◄──── same GitHub login
   │              │                             │
   ▼              ▼                             ▼
┌──────────────────────────────────┐   ┌───────────────────┐
│ Cloudflare Worker "disckee"      │   │ sveltia-cms-auth  │
│  • serves the built Astro site   │   │ (separate Worker, │
│  • /api/lookup/*  (MusicBrainz,  │   │  unmodified)      │
│     Cover Art Archive, Discogs)  │   │  GitHub OAuth     │
│  • /api/claims/*  (D1)           │   └───────────────────┘
│  • cron: purge expired claims    │
└──────────────────────────────────┘
                 ▲
     push to main │ Workers Builds rebuilds (~1 min)
                 │
          GitHub repo (content = Markdown + covers)
```

- **One app Worker with static assets** instead of Pages + a separate Worker.
  Site, API and cron live on one origin, so no CORS, one deploy, one
  `wrangler.jsonc`. Cloudflare now steers new projects to Workers static
  assets rather than Pages.
- **sveltia-cms-auth stays a separate, unmodified Worker.** It's a
  maintained drop-in; forking it into our Worker buys nothing and makes
  upgrades harder. It's free.
- **Claims live in D1, not KV.** "One active claim per item" needs an atomic
  check; KV is eventually consistent and would let two people claim the same
  CD. D1 gives us a `UNIQUE` constraint.

## 3. Content model

One Markdown file per album: `src/content/albums/<slug>.md`. Slug is
`<artist>-<title>` in kebab case, with `-2`, `-3` on collision.

Covers live in `src/assets/covers/<slug>.jpg` (not `public/`), so Astro's
`<Image>` generates responsive sizes and WebP at build time. Stored at 500px,
the size Cover Art Archive serves.

| Field | Type | Notes |
|---|---|---|
| `title` | string, required | |
| `artist` | string, required | Display string ("Simon & Garfunkel") |
| `year` | number | Original release year where known |
| `genres` | string[] | Free tags, lowercased |
| `label` | string | |
| `tracklist` | `{ position, title, duration? }[]` | Optional. `position` is a string so "1-3" works for multi-disc |
| `cover` | image | Path under `src/assets/covers/` |
| `coverCredit` | enum | `cover-art-archive` \| `own-photo` \| `other` |
| `status` | enum | `collection` \| `wishlist` |
| `owner` | enum | `arthur` \| `<partner>` \| `shared` (default `shared`) |
| `addedBy` | string | GitHub login, set automatically by `/add` |
| `addedAt` | date | Set automatically |
| `acquiredAt` | date, optional | Set when a wishlist item becomes collection ("got it") |
| `note` | string, optional | Short personal text, max ~280 chars |
| `favorite` | boolean | Optional, drives a "favourites" shelf later |
| `ids` | `{ musicbrainz?, discogs?, barcode? }` | Traceability + duplicate detection |

Schema is defined once with Zod in `src/content.config.ts`, and the Sveltia
config mirrors it. A CI check fails the build if they drift.

The build also emits two small JSON files the rest of the system reads:

- `/albums.json`: slug, ids and status for every album (used by `/add` for
  duplicate detection).
- `/wishlist.json`: slugs currently on the wishlist (used by the Worker to
  validate and clean up claims).

## 4. Public site

- **Home**: "Recently added" strip, then the collection as a cover-art grid
  (the CD rack). Search, and filters for artist, genre, owner and decade.
  Filters and search run client-side over a prebuilt index; no server.
- **Album page**: big cover, tracklist, metadata, note, who added it and when,
  and source links ("View on MusicBrainz / Discogs") with the attribution the
  terms require.
- **Wishlist**: same grid. Claim state is hidden by default (see section 6).
- Light/dark follows the system, with a manual toggle. Warm, personal styling:
  covers first, text second, no tables.
- Footer: "Uses the Discogs API but is not affiliated with, sponsored or
  endorsed by Discogs" (required by the Discogs API terms), plus MusicBrainz
  credit.

## 5. Adding and editing

### Why not a custom Sveltia widget

The original plan put the scanner inside the Sveltia new-entry form as a
custom widget that fills every field. Sveltia supports custom field types
(React, via `registerFieldType`), but a field can only change **its own**
value, not its siblings. A widget can't fill title, artist, tracklist and
cover. So scanning moves to its own page.

### `/add`: the scanner page (the ≤4 tap flow)

1. **Open `/add`** (saved to the phone's home screen). The first time, sign
   in with GitHub through the same sveltia-cms-auth Worker; the token stays
   in that browser.
2. **Scan.** Camera opens immediately. Barcode reading uses the
   `barcode-detector` polyfill (native `BarcodeDetector` where it exists,
   ZXing WASM elsewhere, which includes iPhones since Safari has no native
   detector).
3. **Pick.** The Worker looks the barcode up (MusicBrainz first, Discogs as
   fallback) and returns candidates as cover thumbnails. One barcode often
   matches several pressings; if there's only one, it's preselected.
   If the barcode is already in `albums.json`: "You already have this".
4. **Save as Collection / Save to Wishlist.** Two big buttons. The page
   writes the Markdown file and the cover in **one commit** via the GitHub
   Git Data API, authored by the signed-in owner.

Then: "Saved. Live in about a minute." The page keeps a local list of
just-saved items so a second scan of the same CD warns before the rebuild
lands.

Fallbacks, in order: text search (artist + title) → "take a photo of the
cover" + minimal manual form → open the full Sveltia form.

### `/admin`: Sveltia CMS

Used for everything else: fixing fields, notes, favourites, deleting, and
"Got it", which is flipping `status` to `collection` (sets `acquiredAt`).
Commits go straight to `main`. The collection is sorted by `addedAt` desc,
with a wishlist/collection filter.

## 6. Gift claims

### Flow

- On the wishlist, a visitor taps **"I'll get this"**, optionally with a name
  ("Mum"). A Turnstile check runs invisibly.
- The Worker stores `{ slug, name?, tokenHash, createdAt, expiresAt }` in D1.
  The raw token goes back to the browser (localStorage) so that visitor can
  un-claim. Only its hash is stored.
- Other visitors (who have revealed claims, see below) see "Claimed by Mum"
  or "Claimed".

### Surprise protection (spoilers off by default)

The original plan relied on each owner flipping an "owner mode" toggle on
every device. One forgotten device, a new phone or cleared browser storage,
and the surprise is gone. So we flip the default:

- **Nobody sees claim state by default.** The wishlist just shows the items.
- Gift-givers tap **"I'm buying a gift, show what's taken"**. That choice is
  remembered on their device.
- Any browser that has ever signed in on `/add` or `/admin` is marked as an
  owner device. On those, the reveal button asks "This will spoil
  surprises. Are you sure?"

The claims API is still readable if someone goes digging. This protects
against accidents, not against snooping.

### Cleanup

- Claims expire after 60 days (Worker env var).
- A daily cron trigger deletes expired claims and claims whose slug is no
  longer in `/wishlist.json` (bought, got it, or removed).
- `POST /api/claims/reset` (admin secret header) clears everything after a
  birthday or the holidays. `DELETE /api/claims/:slug` with the admin secret
  clears one.

### Abuse limits

- Claiming only works for slugs currently in `/wishlist.json`.
- One active claim per item (`UNIQUE(slug)` in D1).
- At most 5 active claims per claimant token and 10 claim writes per IP per
  hour (IP stored hashed and only for the rate window).
- Turnstile on claim creation.

## 7. Worker API

All under `/api` on the site's own origin.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/lookup/barcode/:code` | none (rate limited) | Candidates: `{ source, id, title, artist, year, thumb }` |
| GET | `/api/lookup/search?q=` | none (rate limited) | Text search fallback |
| GET | `/api/lookup/release/:source/:id` | none | Full prefill data incl. tracklist |
| GET | `/api/lookup/cover/:source/:id` | none | Proxies the cover image bytes (avoids CORS in `/add`) |
| GET | `/api/claims` | none | `{ slug: { claimed, name? } }` for wishlist items |
| POST | `/api/claims/:slug` | Turnstile | Create claim, returns token |
| DELETE | `/api/claims/:slug` | claimant token or admin secret | Un-claim |
| POST | `/api/claims/reset` | admin secret | Clear all |

Lookups are cached for a short time (Cache API, ≤6h) so the MusicBrainz
1 req/s limit and the Discogs freshness rule are respected. MusicBrainz calls
send a proper `User-Agent` as their rules require.

Secrets (Worker env): `DISCOGS_TOKEN`, `ADMIN_SECRET`, `TURNSTILE_SECRET`,
`IP_HASH_SALT`. OAuth secrets live only in the sveltia-cms-auth Worker.

## 8. Build phases

Each phase ships something usable.

1. **Foundation**: Astro project, content schema, sample albums, collection
   grid, album page, base styling (light/dark), CI (`astro check` + build).
2. **Deploy + editing**: app Worker with static assets on Workers Builds,
   sveltia-cms-auth Worker + GitHub OAuth app, Sveltia at `/admin`, both
   owners added as collaborators.
3. **Lookup + `/add`**: Worker lookup endpoints (MusicBrainz + CAA, Discogs
   fallback), `/add` page with scanner, candidate picker, one-commit save,
   duplicate check, fallbacks.
4. **Wishlist + claims**: wishlist page, D1 schema, claim endpoints,
   Turnstile, spoiler-off reveal, owner-device marking, cron cleanup, admin
   reset.
5. **Polish**: filters and search, recently added, stats (per artist,
   decade, genre, owner), random pick, favourites shelf, PWA manifest.

## 9. What changed from the original plan, and why

| Original | Now | Why |
|---|---|---|
| Discogs as the only data source; copy its covers and tracklists into git | **MusicBrainz + Cover Art Archive first, Discogs as fallback** | Discogs API terms forbid storing content "longer than necessary" and displaying it if it's more than 6 hours stale. A git repo stores it forever. MusicBrainz data is CC0 and Cover Art Archive is made for reuse. When Discogs data is used, we keep only basic facts (title, artist, year, label, tracklist) and never re-host Discogs images. |
| Custom Sveltia widget auto-fills the form | **Separate `/add` scanner page that commits directly** | Sveltia custom fields can only set their own value, not other fields. |
| Cloudflare Pages + a Worker | **One Worker with static assets** (+ the stock auth Worker) | One origin, one deploy; Cloudflare's current recommendation. |
| "D1 or KV" | **D1** | Atomic one-claim-per-item. |
| Owner-mode toggle hides claims | **Claims hidden by default; givers opt in** | Safe by default; a forgotten device can't spoil a gift. |
| Covers in `public/covers` at 600px | **`src/assets/covers` at 500px** | Astro optimises them; 500px is CAA's standard size. |
| `BarcodeDetector` with zxing fallback | **`barcode-detector` polyfill (ZXing WASM)** | Safari/iOS has no native detector, so the fallback *is* the main path on iPhones. |
| Rate limit only | **Turnstile + slug validation + per-token caps** | Rate limiting alone doesn't stop one person claiming the whole list. |
| `addedBy` typed in by hand | **Set from the GitHub login** | One less tap, can't be wrong. |
| Rebuild message to prevent duplicates | **Message + duplicate check against `albums.json` + local recent list** | The message alone doesn't stop a second scan. |

## 10. Open decisions (defaults in bold)

1. **Metadata source**: **MusicBrainz first, Discogs fallback** / Discogs only
   (then covers must be our own photos).
2. **Partner's GitHub account**: **they create one** / no GitHub (then
   editing needs a different login, e.g. Cloudflare Access + a bot token).
3. **Claim visibility**: **hidden by default, givers opt in** / owner-mode
   toggle as originally planned.
4. **Site language**: **English** / Dutch / both.
5. **Partner's display name** for the `owner` field: **placeholder
   `partner`** until given.

## 11. Out of scope (for now)

Multiple collections, other users, selling or trading, vinyl or other formats,
native apps.
