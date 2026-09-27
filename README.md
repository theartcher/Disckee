# Disckee

Our CD collection and wishlist, as a website. Friends and family can browse it,
wishlist included, for gift ideas.

- **Browse:** the public site (collection, album pages, wishlist).
- **Add a CD:** `/add` on your phone (the pencil menu → Add a CD). Scan the barcode, pick the release, then save in the prefilled form (signed in with GitHub). On the next deploy, the tracklist, label, genres and cover are filled in from MusicBrainz by `scripts/enrich.ts`.
- **Edit:** `/admin` (Sveltia CMS). Fix details, add notes, mark "got it".

Every save is a commit to `main` and rebuilds the site. After saving, `/admin`
takes you back to the site, which reloads by itself once the change is live
(a minute or two).

Stack: Astro (static) + React with Ant Design, on GitHub Pages · Sveltia CMS · MusicBrainz and Cover Art
Archive, called straight from the browser. No servers.

See [docs/PLAN.md](docs/PLAN.md) for the full plan and the reasoning behind it.

## Development

```sh
npm install
npm run dev        # http://localhost:4321/Disckee/
npm run typecheck  # astro check, including album front matter
npm run lint       # oxlint
npm run build      # static site in dist/
```

Albums live in `src/content/albums/<slug>.md`, covers in
`src/assets/covers/<slug>.jpg`. The schema is in `src/lib/album-schema.ts`;
the `/admin` fields in `src/lib/cms.ts` mirror it, and the build fails if the
two drift apart.
The sample albums and their "SAMPLE" covers are placeholders; delete them once
real CDs are in.

To try `/admin` locally without signing in: run `npm run dev`, open
http://localhost:4321/Disckee/admin/ in Chrome or Edge, pick **Work with Local
Repository** and choose this folder. Saves write files to your working copy;
commit them yourself.

Setting up sign-in for `/admin` (once): see [docs/SETUP.md](docs/SETUP.md).

Deploys run from `.github/workflows/deploy.yml` on every push to `main`. One-time
setup: in the repo's Settings → Pages, set **Source** to **GitHub Actions**.

Every pull request runs three checks: `typecheck`, `lint` and `build`. To make
them block merging, add a branch ruleset for `main` (Settings → Rules →
Rulesets) with "Require status checks to pass" and those three checks.
