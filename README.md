# Disckee

Our CD collection and wishlist, as a website. Friends and family can browse it
and quietly claim wishlist items as gifts.

- **Browse:** the public site (collection, album pages, wishlist).
- **Add a CD:** `/add` on your phone. Scan the barcode, pick the release, save.
- **Edit:** `/admin` (Sveltia CMS). Fix details, add notes, mark "got it".

Every change is a commit to `main`; the site rebuilds in about a minute.

Stack: Astro (static) on GitHub Pages · Sveltia CMS · MusicBrainz and Cover Art
Archive, called straight from the browser. No servers.

See [docs/PLAN.md](docs/PLAN.md) for the full plan and the reasoning behind it.
