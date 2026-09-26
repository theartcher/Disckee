# Setting up sign-in for /admin

`/admin` is [Sveltia CMS](https://sveltiacms.app). Arthur and Marlou each sign
in with their own GitHub account. The only piece not on GitHub is the official
[Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth), which
does the one step a browser can't: swapping GitHub's sign-in code for a token,
using a client secret. We deploy it unmodified and write none of its code.

These steps are done once, by the repo owner.

## 1. Deploy the authenticator

1. Open [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) and
   click **Deploy to Cloudflare Workers** (a free Cloudflare account is enough).
2. When it's done, copy the Worker's URL, e.g.
   `https://sveltia-cms-auth.<your-account>.workers.dev`.

## 2. Create the GitHub OAuth app

GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**:

| Field | Value |
|---|---|
| Application name | Disckee |
| Homepage URL | `https://theartcher.github.io/Disckee/` |
| Authorization callback URL | `<worker URL>/callback` |

Then click **Generate a new client secret** and keep the page open.

## 3. Give the authenticator the app's details

Cloudflare dashboard → Workers → the authenticator → Settings → Variables:

| Name | Value |
|---|---|
| `GITHUB_CLIENT_ID` | the OAuth app's Client ID |
| `GITHUB_CLIENT_SECRET` | the client secret, with **Encrypt** on |
| `ALLOWED_DOMAINS` | `theartcher.github.io` |

`ALLOWED_DOMAINS` makes the authenticator refuse sign-ins started from any
other site.

## 4. Point the site at it

Set `authUrl` in `src/lib/cms.ts` to the Worker URL and merge. Until then,
`/admin` says sign-in isn't set up.

## 5. Let CMS saves reach `main`

Sveltia saves by committing straight to `main`. The `main` ruleset requires
status checks, which blocks those direct commits. In Settings → Rules →
Rulesets → the `main` ruleset, under **Bypass list**, add the role that
Arthur and Marlou have (Repository admin, and Write for collaborators) with
**Always** allowed. Pull requests from anyone else still need green checks.
If GitHub doesn't offer a role that covers Marlou, the fallback is Sveltia's
editorial workflow: each save opens a pull request that is published once
its checks pass.

A broken save can't take the site down: the deploy only runs when
`typecheck`, `lint` and `build` pass, so the last good version stays live.

## 6. Add Marlou

1. Marlou creates a GitHub account and turns on two-factor authentication
   (Settings → Password and authentication), or adds a passkey.
2. Settings → Collaborators → **Add people** → her username. She accepts the
   invite from her email.
3. She opens `/admin`, taps **Sign In with GitHub** and approves Disckee once.

## Lost phone or leaked session

Either of these cuts access off at once; the site itself is unaffected.

- The person revokes Disckee in their GitHub settings → Applications →
  Authorized OAuth Apps.
- The owner removes them in Settings → Collaborators (add them back later).

For a lost phone, also sign out of GitHub everywhere via GitHub → Settings →
Sessions.
