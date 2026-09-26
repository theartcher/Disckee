# Disckee

Our CD collection and wishlist, as a website. Friends and family can browse it,
wishlist included, for gift ideas.

- **Browse:** the public site (collection, album pages, wishlist).
- **Add a CD:** `/add` on your phone. Scan the barcode, pick the release, then save in the prefilled form (signed in with GitHub).
- **Edit:** `/admin` (Sveltia CMS). Fix details, add notes, mark "got it".

Every change is a commit to `main`; the site rebuilds in about a minute.

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
`src/assets/covers/<slug>.jpg`. The schema is in `src/content.config.ts`.
The sample albums and their "SAMPLE" covers are placeholders; delete them once
real CDs are in.

Deploys run from `.github/workflows/deploy.yml` on every push to `main`. One-time
setup: in the repo's Settings → Pages, set **Source** to **GitHub Actions**.

Every pull request runs three checks: `typecheck`, `lint` and `build`. To make
them block merging, add a branch ruleset for `main` (Settings → Rules →
Rulesets) with "Require status checks to pass" and those three checks.
