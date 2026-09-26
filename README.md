# Disckee

Our CD collection and wishlist, as a website. Friends and family can browse it
and quietly claim wishlist items as gifts.

- **Browse:** the public site (collection, album pages, wishlist).
- **Add a CD:** `/add` on your phone. Scan the barcode, pick the release, save.
- **Edit:** `/admin` (Sveltia CMS). Fix details, add notes, mark "got it".

Every change is a commit to `main`; the site rebuilds in about a minute.

Stack: Astro (static) · Sveltia CMS · one Cloudflare Worker (site, lookup API,
gift claims in D1) · MusicBrainz / Cover Art Archive, with Discogs as fallback.

See [docs/PLAN.md](docs/PLAN.md) for the full plan and the reasoning behind it.

This application uses Discogs' API but is not affiliated with, sponsored or
endorsed by Discogs.
