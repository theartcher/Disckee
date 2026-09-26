# Disckee: project plan

A free, public website where Arthur and Marlou catalog their shared CD
collection and wishlist. Friends and family can browse it, including the
wishlist, when looking for gift ideas. Adding a CD takes a few taps on a phone: scan the barcode,
pick the right release, save.

Design rule: **everything is static and lives on GitHub.** No servers, no
Workers, no databases, nothing with a pricing page that can change under us.
If a piece needs a server, we find a way around it or drop it.

---

## 1. Constraints

- **Zero cost, zero servers.** GitHub (repo, Actions, Pages) plus public,
  free, keyless APIs called straight from the browser.
- **Public to read, two people to edit.** Only Arthur has a GitHub account.
  Marlou edits through a login shared from Arthur's (see section 5).
- **Non-technical editing.** No pull requests and no hand-edited files for
  day-to-day use. New CDs go through `/add`; edits go through `/admin`.
- **Official APIs only, never scraping.** No secret tokens anywhere in the
  site.
- **Mobile-first web** (not a native app).

## 2. Architecture

```
                         phone / browser
   ┌──────────────────────────┼──────────────────────────┐
   │                          │                          │
 public site             /add (scanner)             /admin (Sveltia CMS)
 browse, wishlist        scan → MusicBrainz         edit, "got it", notes
   │                     → pick → save                   │
   │                          │  GitHub API (Arthur's token, in the browser)
   │                          ▼                          ▼
   │                  ┌──────────────────────────────────────┐
   │                  │ GitHub repo: Markdown + cover images │
   │                  └──────────────────────────────────────┘
   │                          │ push to main
   │                          ▼
   │                  GitHub Actions: astro build (~1 min)
   │                          ▼
   └──────────────────  GitHub Pages
```

What each piece used to need a server for, and what replaces it:

| Need | Old plan | Now |
|---|---|---|
| Album lookup | Worker proxying Discogs (secret token) | Browser calls **MusicBrainz** directly. It's keyless and allows cross-origin requests |
| Cover images | Worker downloads from Discogs | Browser fetches from **Cover Art Archive** (keyless, cross-origin OK) and commits it |
| CMS login | OAuth helper Worker | Sveltia's **personal access token** sign-in. No OAuth app, no server |
| Saving a new CD | Worker | Browser commits via the GitHub API with the same token |
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
| `addedBy` | enum | `arthur` \| `marlou`, from the device's "who's this?" choice |
| `addedAt` | date | Set automatically |
| `acquiredAt` | date, optional | Set when a wishlist item becomes collection ("got it") |
| `note` | string, optional | Short personal text, max ~280 chars |
| `favorite` | boolean | Optional, drives a "favourites" shelf later |
| `ids` | `{ musicbrainz?, barcode? }` | Traceability + duplicate detection |

The schema is defined once with Zod in `src/content.config.ts`, and the
Sveltia config mirrors it. A CI check fails the build if the two drift apart.

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

### Logins without a second GitHub account

Sveltia CMS talks to GitHub straight from the browser, and supports signing in
with a **personal access token** instead of OAuth, so no auth server is needed.

- Arthur creates one fine-grained token, limited to **this repo only**, with
  Contents read/write. That's all it can touch.
- Arthur signs in on his own phone, then uses Sveltia's **QR-code login** to
  sign Marlou's phone in with the same session. Marlou never creates an
  account.
- `/add` reuses that sign-in (same site, same browser storage), so there's
  nothing extra to set up.
- Each phone picks "Who's this? Arthur / Marlou" once, so `addedBy` and the
  site show the right person. In git history every commit is Arthur's, but
  nobody sees that on the site.
- If a phone is lost, revoking the token on GitHub cuts it off; Arthur makes a
  new one and signs in again.

### Why not a custom Sveltia widget

Sveltia custom fields (`registerFieldType`) can only change **their own**
value, not other fields, so a scan widget can't fill title, artist, tracklist
and cover. Scanning therefore lives on its own page.

### `/add`: the scanner page (≤4 taps)

1. **Open `/add`** (saved to the home screen).
2. **Scan.** The camera opens immediately. Barcode reading uses the
   `barcode-detector` polyfill: native `BarcodeDetector` where it exists, and
   ZXing WASM elsewhere, including iPhones, since Safari has no native
   detector.
3. **Pick.** The page asks MusicBrainz for releases with that barcode and
   shows them as cover thumbnails from Cover Art Archive. One barcode often
   has several pressings; if there's only one match, it's preselected. If the
   barcode is already in `albums.json`, the page says "You already have
   this".
4. **Save as Collection / Save to Wishlist.** Two big buttons. The page
   writes the Markdown file and the cover in **one commit** through the
   GitHub API.

The page then shows "Saved. Live in about a minute." It also keeps a local
list of just-saved items, so scanning the same CD again warns you even
before the rebuild lands.

Fallbacks, in order: text search (artist + title), then a photo of the cover
plus a minimal manual form, then the full Sveltia form.

MusicBrainz etiquette: at most 1 request per second from each phone, which a
person scanning CDs never gets near.

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
2. **Editing**: Sveltia at `/admin` with token sign-in, schema-sync check,
   QR login to a second phone, "who's this?" device choice.
3. **`/add`**: scanner, MusicBrainz lookup, candidate picker, cover fetch,
   one-commit save, duplicate check, fallbacks.
4. **Wishlist**: wishlist page, share links, "got it" flow.
5. **Polish**: filters and search, recently added, stats (per artist, decade,
   genre, owner), random pick, favourites shelf, PWA manifest.

## 8. Decisions

1. **Hosting**: GitHub Pages via GitHub Actions. No Cloudflare, no Worker.
2. **Metadata**: MusicBrainz + Cover Art Archive only, called from the
   browser. Discogs dropped (needs a secret token; terms forbid long-term
   storage).
3. **Logins**: one fine-grained token from Arthur, shared to Marlou's phone
   by QR code. Marlou doesn't need a GitHub account.
4. **Gift claims**: none online; family coordinates in their own chat.
5. **Site language**: English.
6. **Owner names**: Arthur and Marlou.

## 9. Out of scope (for now)

Multiple collections, other users, selling or trading, vinyl or other formats,
native apps.
