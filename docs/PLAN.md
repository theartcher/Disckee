# Disckee: project plan

A free, public website where Arthur and Marlou catalog their shared CD
collection and wishlist. Friends and family can browse it, including the
wishlist, when looking for gift ideas. Adding a CD takes a few taps on a phone: scan the barcode,
pick the right release, save.

Design rules:
- **Everything is static and lives on GitHub.** No servers, databases or
  code of ours running anywhere but GitHub Actions.
- **No homebrew login or authentication, ever.** Sign-in is GitHub's own
  (password + 2FA per person), through Sveltia's official, maintained
  authenticator. We write no auth code and handle no tokens ourselves.

---

## 1. Constraints

- **Zero cost.** GitHub (repo, Actions, Pages), public keyless APIs, and one
  free, stock Sveltia authenticator (section 5). That authenticator is the
  only piece not on GitHub.
- **Public to read, two people to edit.** Arthur and Marlou each have their
  own GitHub account and are the only collaborators with write access.
- **Non-technical editing.** No pull requests and no hand-edited files for
  day-to-day use. New CDs go through `/add`; edits go through `/admin`.
- **Official APIs only, never scraping.** No secrets anywhere in the site.
- **Mobile-first web** (not a native app).

## 2. Architecture

```
                         phone / browser
   ┌──────────────────────────┼──────────────────────────┐
   │                          │                          │
 public site             /add (scanner)             /admin (Sveltia CMS)
 browse, wishlist        scan → MusicBrainz         edit, "got it", notes
   │                     → pick ──── opens prefilled ──►   │ sign in with GitHub
   │                     (no login,      new-album form      │ (official Sveltia
   │                      no writes)                         │  authenticator)
   │                                                         ▼ save
   │                  ┌──────────────────────────────────────┐
   │                  │ GitHub repo: Markdown + cover images │
   │                  └──────────────────────────────────────┘
   │                          │ push to main
   │                          ▼
   │                  GitHub Actions: enrich new albums from MusicBrainz
   │                  (tracklist, cover) → astro build (~1–2 min)
   │                          ▼
   └──────────────────  GitHub Pages
```

What each piece used to need a server for, and what replaces it:

| Need | Old plan | Now |
|---|---|---|
| Album lookup | Worker proxying Discogs (secret token) | Browser calls **MusicBrainz** directly. It's keyless and allows cross-origin requests |
| Tracklist + cover | Worker downloads from Discogs | A **GitHub Action** fetches them from MusicBrainz / **Cover Art Archive** after save and commits them |
| CMS login | OAuth helper Worker | **GitHub sign-in** per person, via Sveltia's official authenticator, deployed unmodified |
| Saving a new CD | Worker | `/add` hands off to Sveltia's prefilled new-album form; Sveltia saves |
| Hosting + rebuild | Cloudflare Pages | **GitHub Actions → GitHub Pages** |
| Gift claims | Worker + D1 | Dropped: family coordinates in their own chat |

Discogs is dropped: its barcode search requires a secret token, which can't
live in a static site, and its terms don't allow storing its data long-term,
which is the whole point of a git-based catalog. MusicBrainz data is public
domain (CC0), so storing it in git is fine.

## 3. Content model

One Markdown file per album: `src/content/albums/<slug>.md`. The slug is
`<artist>-<title>` in kebab case, with `-2`, `-3` added on collision.

Covers live in `src/assets/covers/<slug>.jpg` (not `public/`), so Astro's
`<Image>` generates responsive sizes and WebP at build time. They're stored at
500px, the size Cover Art Archive serves.

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
| `owner` | enum | `arthur` \| `marlou` \| `shared` (default `shared`) |
| `addedBy` | enum | `arthur` \| `marlou`, set by the enrichment Action from the commit author |
| `addedAt` | date | Set automatically |
| `acquiredAt` | date, optional | Set when a wishlist item becomes collection ("got it") |
| `note` | string, optional | Short personal text, max ~280 chars |
| `favorite` | boolean | Optional, drives a "favourites" shelf later |
| `ids` | `{ musicbrainz?, barcode? }` | Traceability + duplicate detection |

The schema is defined once with Zod in `src/lib/album-schema.ts`, and the
Sveltia config (`src/lib/cms.ts`) mirrors it. The build fails if the two
drift apart.

The build also emits `/albums.json` (slug, ids and status for every album).
`/add` uses it to spot duplicates.

## 4. Public site

- **Home**: a "Recently added" strip, then the collection as a cover-art grid
  (the CD rack). Search, and filters for artist, genre, owner and decade, all
  client-side over a prebuilt index.
- **Album page**: big cover, tracklist, metadata, note, who added it and when,
  and a "View on MusicBrainz" link.
- **Wishlist**: same grid, with share links (section 6).
- Light/dark follows the system, with a manual toggle. Warm, personal styling:
  covers first, text second, no tables.
- Served from `theartcher.github.io/Disckee` (Astro `base: '/Disckee'`), or a
  custom domain later if wanted.

## 5. Adding and editing

### Sign-in: GitHub's own login, nothing homebrewed

- Arthur and Marlou each have a **GitHub account with 2FA** (or a passkey),
  and both are collaborators on the repo. GitHub only accepts changes from
  repo collaborators, so that is the real access control.
- `/admin` uses Sveltia's standard **"Sign in with GitHub"** button. The
  OAuth code exchange (which needs a client secret GitHub won't let a browser
  hold) goes through the **official Sveltia CMS Authenticator**, deployed
  unmodified on a free Cloudflare Worker. It's stateless, stores nothing, and
  we write none of its code. It's the one piece not hosted on GitHub; if it
  ever goes away, only sign-in pauses until it's redeployed elsewhere (the
  site keeps working).
- After sign-in, Sveltia keeps GitHub's access token in the browser, as every
  git-based CMS does. Nothing of ours ever sees or stores it.
- **Lost phone or leaked session:** revoke the Disckee OAuth app in that
  person's GitHub settings (Settings → Applications), or remove them as a
  collaborator. Access stops immediately; nothing on the site changes.
- **Who added what:** the commit is made by that person's own GitHub
  account, so there's no "who's this?" step. The enrichment Action sets
  `addedBy` from the commit author.

### Why not a custom Sveltia widget

Sveltia custom fields (`registerFieldType`) can only change **their own**
value, not other fields, so a scan widget can't fill title, artist, tracklist
and cover. Scanning therefore lives on its own page.

### `/add`: the scanner page (≤4 taps)

`/add` has **no login and never writes anything**. It only looks things up
and hands off to Sveltia, which does the signed-in save.

1. **Open `/add`** (saved to the home screen).
2. **Scan.** The camera opens immediately. Barcode reading uses the
   `barcode-detector` polyfill: native `BarcodeDetector` where it exists, and
   ZXing WASM elsewhere, including iPhones, since Safari has no native
   detector. The WASM file is served from the site itself, not a CDN.
3. **Pick.** The page asks MusicBrainz for releases with that barcode and
   shows them as cover thumbnails from Cover Art Archive. One barcode often
   has several pressings; if there's only one match, it's preselected. If the
   barcode is already in `albums.json`, the page says "You already have
   this".
4. **Add → Save.** A "We have it / We want it" switch sets the status. The
   Add button opens Sveltia's new-album form with title, artist, status and
   the MusicBrainz id/barcode already filled in (Sveltia supports
   prefilling via URL parameters). Tap Save. The original year comes from
   enrichment.

After the save, a GitHub Action fills in the rest (section 5, "Enrichment").
The site is live in a minute or two. `/add` keeps a local list of
just-scanned items, so scanning the same CD again warns you before the
rebuild lands.

Fallbacks, in order: text search (artist + title), then the empty Sveltia
form, where a phone photo can be uploaded as the cover.

MusicBrainz etiquette: at most 1 request per second from each phone, which a
person scanning CDs never gets near.

### Enrichment (GitHub Action)

Runs in the build job of every deploy (Publish Changes in `/admin`, or a
push to `main`), before the site is built:

- For each album with `ids.musicbrainz` but no tracklist or cover, fetch the
  release from MusicBrainz and the 500px front cover from Cover Art Archive.
- Fill in tracklist, label and genres, save the cover to
  `src/assets/covers/`, and set `addedBy` from the commit author's GitHub
  login (`arthur` / `marlou` mapping in config).
- Commit the result to `main` and build from it in the same run. The
  `main` ruleset refuses pushes from the workflow's own token, so the push
  uses an optional deploy key (GitHub's own per-repo key, kept as an Actions
  secret, docs/SETUP.md section 7). Without it the build still includes the
  details, and the next deploy fetches them again.

### `/admin`: Sveltia CMS

Used for everything else: fixing fields, notes, favourites, deleting, and
"Got it", which flips `status` to `collection` and sets `acquiredAt`.
Commits go straight to `main`. The list is sorted by `addedAt` (newest
first), with a wishlist/collection filter.

## 6. Gift claims: none online

Decided: there are no online claims. The wishlist is a plain list, and family
coordinates who buys what in their own chat. This keeps the site 100% static
with nothing to store, expire or protect against surprises leaking.

What the wishlist does offer:
- A share button (native share sheet) for the wishlist page and each item,
  so it's easy to drop a link in the family chat.
- When a gift arrives, "Got it" in `/admin` moves the item to the collection,
  and it drops off the wishlist on the next rebuild.

## 7. Build phases

Each phase ships something usable.

1. **Foundation**: Astro project, content schema, sample albums, collection
   grid, album page, base styling (light/dark), GitHub Actions build and
   deploy to Pages.
2. **Editing**: Sveltia at `/admin` with GitHub sign-in via the official
   authenticator, both accounts as collaborators, schema-sync check.
3. **`/add`**: scanner, MusicBrainz lookup, candidate picker, prefilled
   hand-off to Sveltia, enrichment Action, duplicate check, fallbacks.
4. **Wishlist**: wishlist page, share links, "got it" flow.
5. **Polish**: filters and search, recently added, stats (per artist, decade,
   genre, owner), random pick, favourites shelf, PWA manifest.

## 8. Decisions

1. **Hosting**: GitHub Pages via GitHub Actions.
2. **Metadata**: MusicBrainz + Cover Art Archive only. Lookups from the
   browser in `/add`, tracklist and cover from the enrichment Action. Discogs
   dropped (needs a secret token; terms forbid long-term storage).
3. **Logins**: no homebrew auth. Each person signs in with their own GitHub
   account (2FA) through Sveltia's official authenticator. Marlou creates a
   GitHub account. The authenticator runs on a free Cloudflare Worker
   (chosen over Pages CMS or Netlify as the relay).
4. **Gift claims**: none online; family coordinates in their own chat.
5. **Site language**: English.
6. **Owner names**: Arthur and Marlou.

## 9. Out of scope (for now)

Multiple collections, other users, selling or trading, vinyl or other formats,
native apps.
