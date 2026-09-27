// Links between /admin (Sveltia CMS) and the site. `site` ends with a slash.

/** Where /admin goes after an album is saved. `?saved` makes the page reload itself once the change is live. */
export function afterSaveUrl(
  site: string,
  album: { slug: string; isNew: boolean; status: 'collection' | 'wishlist' },
) {
  const saved = `?saved=${encodeURIComponent(album.slug)}`;
  // A new album has no page of its own until the site is rebuilt, so it goes to its list.
  if (album.isNew)
    return `${site}${album.status === 'wishlist' ? 'wishlist/' : ''}${saved}`;
  return `${site}albums/${album.slug}/${saved}`;
}

/** The floating back button in /admin: the album being edited, or the site. */
export function backLink(site: string, hash: string) {
  const slug = hash.match(/^#\/collections\/albums\/entries\/([^/?]+)/)?.[1];
  return slug
    ? { href: `${site}albums/${slug}/`, label: 'Back to CD' }
    : { href: site, label: 'Back to site' };
}
