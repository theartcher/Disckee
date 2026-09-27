# Disckee UI rules

How every page should look and behave, so the site feels like one app. Stock Ant Design components and theme tokens only: no custom colours, no hand-picked pixel radii, no home-made widgets where antd has one.

## 1. Page frame

- Every page is `Shell` + `PageHeader` + content, in that order.
- `PageHeader`: title (`Title level={2}`), optional one-line secondary subtitle, 24px below it before the content.
- A page shows its parent in a `Breadcrumb` above the title when it isn't in the header menu: album pages (`Collection / Album`, `Wishlist / Album`), owners' tools (`Admin / Add a CD`). The breadcrumb link keeps the filters you came from.
- Content width is the Shell's 1100px. Narrow forms (/add) centre at 640px.

## 2. Spacing

- Use antd's scale only: 4, 8, 12, 16, 24, 32.
- 8 between buttons and tags in a row, 12 inside toolbars, 16 between cards (grid gutter), 24 below the page header, 32 between sections.
- Section headings are `SectionTitle` (`Title level={4}`, 12 below). No per-page margins on headings.
- Card body padding is 12 for album and tile cards, antd's default everywhere else.

## 3. Rounding

- Covers on their own (shelves, album page, dialogs): `borderRadiusLG`.
- Small thumbnails (list rows, /add results): `borderRadiusSM`.
- Covers inside a `Card`: none of their own, the Card rounds them.
- Buttons, inputs, tags: antd's default. No pills (`shape="round"`) except icon-only circle buttons.

## 4. Actions

- One primary button per screen at most, for the thing the page is for (Look up on /add). Most pages have none.
- Page-wide actions (Share the wishlist) sit on the right of the page header. Per-item actions sit on the item.
- No novelty buttons in toolbars or headers. A toolbar only holds controls that change what the list shows: search, owner, filters, sort, view.
- Links out of the site only where people will actually use them. Saved CDs don't link to MusicBrainz.
- Icon-only buttons always have a tooltip and an `aria-label`.

## 5. Navigation

- The header menu is the map: Collection, Wishlist, Stats and Admin (the owners' tools). The current section is highlighted the menu's way (blue text and underline), never as a filled button.
- Every page is reachable in two taps from home, and every page has a way back that isn't the browser button.
- List state (search, owner, filters, sort, view) lives in the URL, so back, share and reload all land on the same view.

## 6. Stability: no flashes, no jumps, no logic shifts

- Something page-shaped is on screen from the first paint (the static header bar in `Base.astro`).
- The theme is chosen before paint; nothing may start light and turn dark.
- Changing a filter changes the albums, not the page's structure. Shelves, headings and counts stay where they are and follow the filter; they don't appear and disappear.
- Text that depends on state (counts, "3 of 51 albums") has a fixed place, so it doesn't push content down when it appears.
- Images reserve their square before they load (`aspect-ratio: 1`).
- Layout reads from state available on first render (e.g. `matchMedia`), never from a hook that is empty for one frame.

## 7. Words

- Plain, short, English. Titles are nouns ("Stats", "Marlou's CDs"), buttons are verbs ("Share", "Look up").
- The same thing has the same name everywhere ("Latest additions", "Admin", "Wishlist").

## 8. How changes land

- One PR per page (or per shared building block), with before/after screenshots at phone (390px) and desktop (1280px) width, light mode, in the PR description.
- `npm run typecheck`, `npm run lint` and `npm run build` pass before every push.
