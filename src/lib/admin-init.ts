// Starts Sveltia CMS on /admin and links it back to the site.

import { init, registerEventListener } from '@sveltia/cms';
import { cmsConfig } from './cms';
import { afterSaveUrl, backLink } from './admin-nav';

init({ config: cmsConfig(new URL(import.meta.env.BASE_URL, location.origin).href) });

// The site's root, with a trailing slash.
const site = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/`, location.origin).href;

// After saving, go back to the site; it reloads itself once the save is live.
registerEventListener({
  name: 'postSave',
  handler: ({ entry }) => {
    const saved = entry as unknown as {
      get(key: string): unknown;
      getIn(path: string[]): unknown;
    };
    if (saved.get('collection') !== 'albums') return;
    const url = afterSaveUrl(site, {
      slug: String(saved.get('slug')),
      isNew: Boolean(saved.get('newRecord')),
      status:
        saved.getIn(['data', 'status']) === 'wishlist'
          ? 'wishlist'
          : 'collection',
    });
    setTimeout(() => location.assign(url), 300);
  },
});

// 'Back to CD' while editing an album, 'Back to site' everywhere else.
const back = document.querySelector<HTMLAnchorElement>('#back')!;
const update = () => {
  const link = backLink(site, location.hash);
  back.href = link.href;
  back.textContent = `← ${link.label}`;
};
addEventListener('hashchange', update);
update();
