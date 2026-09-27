import type { CmsConfig, Field } from '@sveltia/cms';
import { people } from './album-schema';

/**
 * Where the official Sveltia CMS Authenticator is deployed (docs/SETUP.md).
 * It does the GitHub OAuth code exchange; we run none of its code ourselves.
 * If this is empty, /admin explains that sign-in isn't set up.
 */
export const authUrl = 'https://sveltia-cms-auth.jorisplayz.workers.dev';

const personOptions = people.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

/** Mirrors src/lib/album-schema.ts; checked against it at build time by cms-check.ts. */
export const albumFields: Field[] = [
  { name: 'title', label: 'Title', widget: 'string' },
  { name: 'artist', label: 'Artist', widget: 'string' },
  {
    name: 'status',
    label: 'Status',
    widget: 'select',
    options: [
      { value: 'collection', label: 'In our collection' },
      { value: 'wishlist', label: 'On the wishlist' },
    ],
    default: 'collection',
  },
  {
    name: 'acquiredAt',
    label: 'Got it on',
    widget: 'datetime',
    type: 'date',
    format: 'YYYY-MM-DD',
    required: false,
    hint: 'Set this when a wishlist CD arrives and you move it to the collection.',
  },
  { name: 'year', label: 'Year', widget: 'number', value_type: 'int', min: 1900, max: 2100, required: false },
  { name: 'label', label: 'Record label', widget: 'string', required: false },
  { name: 'genres', label: 'Genres', widget: 'list', required: false, hint: 'Lowercase, separated by commas.' },
  {
    name: 'owner',
    label: 'Whose CD',
    widget: 'select',
    options: [...personOptions, { value: 'shared', label: 'Shared' }],
    default: 'shared',
    required: false,
  },
  { name: 'note', label: 'Note', widget: 'text', maxlength: 280, required: false },
  { name: 'favorite', label: 'Favourite', widget: 'boolean', default: false, required: false },
  { name: 'cover', label: 'Cover', widget: 'image', required: false, hint: 'Filled in automatically for CDs added with a MusicBrainz id.' },
  {
    name: 'coverCredit',
    label: 'Cover source',
    widget: 'select',
    options: [
      { value: 'cover-art-archive', label: 'Cover Art Archive' },
      { value: 'own-photo', label: 'Our own photo' },
      { value: 'other', label: 'Other' },
    ],
    required: false,
  },
  {
    name: 'tracklist',
    label: 'Tracklist',
    label_singular: 'track',
    widget: 'list',
    required: false,
    collapsed: true,
    summary: '{{fields.position}}. {{fields.title}}',
    fields: [
      { name: 'position', label: 'Position', widget: 'string', hint: 'Like "3", or "1-3" for disc 1, track 3.' },
      { name: 'title', label: 'Title', widget: 'string' },
      { name: 'duration', label: 'Duration', widget: 'string', required: false, pattern: ['^\\d+:\\d{2}$', 'Like 4:05'] },
    ],
  },
  {
    name: 'musicbrainzId',
    label: 'MusicBrainz release id',
    widget: 'string',
    required: false,
    pattern: ['^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'A MusicBrainz release id'],
    hint: 'Filled in by Add a CD. Tracklist, label, genres and cover are fetched from it on the next publish.',
  },
  { name: 'barcode', label: 'Barcode', widget: 'string', required: false, pattern: ['^\\d{8,14}$', '8 to 14 digits'] },
  {
    name: 'addedBy',
    label: 'Added by',
    widget: 'select',
    options: personOptions,
    required: false,
    hint: 'Set automatically from who saved it.',
  },
  { name: 'addedAt', label: 'Added on', widget: 'datetime', type: 'date', format: 'YYYY-MM-DD', default: '{{now}}' },
];

/** Sveltia CMS settings for /admin (docs/PLAN.md section 5). */
export const cmsConfig = (siteUrl: string): CmsConfig => ({
  load_config_file: false,
  app_title: 'Disckee',
  site_url: siteUrl,
  backend: {
    name: 'github',
    repo: 'theartcher/Disckee',
    branch: 'main',
    base_url: authUrl,
    // GitHub sign-in only: no pasting personal access tokens into the browser.
    auth_methods: ['oauth'],
    // Saves don't deploy on their own ("[skip ci]"); the Publish Changes
    // button deploys everything saved so far (repository_dispatch in deploy.yml).
    skip_ci: true,
    commit_messages: {
      create: 'Add {{collection}} “{{slug}}”',
      update: 'Update {{collection}} “{{slug}}”',
      delete: 'Delete {{collection}} “{{slug}}”',
      uploadMedia: 'Upload “{{path}}”',
      deleteMedia: 'Delete “{{path}}”',
    },
  },
  media_folder: 'src/assets/covers',
  public_folder: '/src/assets/covers',
  media_libraries: {
    default: {
      config: {
        // Phone photos are shrunk to the size Cover Art Archive covers are stored at.
        transformations: { raster_image: { format: 'webp', quality: 85, width: 500, height: 500 } },
      },
    },
  },
  slug: { encoding: 'ascii', clean_accents: true },
  // Without this, cleared optional fields are saved as "" and fail the schema.
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'albums',
      label: 'Albums',
      label_singular: 'Album',
      icon: 'album',
      folder: 'src/content/albums',
      // Entries reference covers relative to their own file, as Astro's image() expects.
      media_folder: '/src/assets/covers',
      public_folder: '../../assets/covers',
      extension: 'md',
      format: 'yaml-frontmatter',
      slug: '{{artist}}-{{title}}',
      summary: '{{artist}} – {{title}}',
      sortable_fields: { fields: ['addedAt', 'artist', 'title', 'year'], default: { field: 'addedAt', direction: 'descending' } },
      view_filters: [
        { name: 'collection', label: 'Collection', field: 'status', pattern: 'collection' },
        { name: 'wishlist', label: 'Wishlist', field: 'status', pattern: 'wishlist' },
      ],
      editor: { preview: false },
      fields: albumFields,
    },
  ],
});
