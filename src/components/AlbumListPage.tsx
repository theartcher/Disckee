import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card, Col, Empty, Flex, Input, List, Row, Segmented, Select, Tag, Typography } from 'antd';
import { AppstoreOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import Fuse from 'fuse.js';
import Shell from './Shell';
import CoverImage from './CoverImage';
import ShareButton from './ShareButton';
import Shelf from './Shelf';
import PageHeader, { SectionTitle } from './PageHeader';
import type { AlbumCard, Section } from '../lib/albums';

interface Props {
  baseUrl: string;
  section: Section;
  title: string;
  /** Under the title. The collection shows its album count instead. */
  subtitle?: ReactNode;
  albums: AlbumCard[];
  /** Adds share buttons for the page and for each album. */
  share?: { href: string; title: string; text: string };
  empty?: string;
  /** The collection: adds the "Latest additions" and favourites shelves. */
  home?: boolean;
}

const plural = (n: number) => `${n} ${n === 1 ? 'album' : 'albums'}`;
const names = { arthur: 'Arthur', marlou: 'Marlou' } as const;
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "added by Marlou, 3 days ago". Worked out in the browser, so it doesn't go stale between builds. */
function addedCaption(album: AlbumCard) {
  const days = Math.round((Date.parse(album.addedAt) - Date.now()) / 86_400_000);
  const when =
    days > -7 ? relative.format(Math.min(days, 0), 'day') : days > -60 ? relative.format(Math.round(days / 7), 'week') : relative.format(Math.round(days / 30), 'month');
  return album.addedBy ? `${names[album.addedBy]}, ${when}` : when[0].toUpperCase() + when.slice(1);
}

const owners = [
  { value: 'all', label: 'All' },
  { value: 'shared', label: 'Shared' },
  { value: 'arthur', label: 'Arthur' },
  { value: 'marlou', label: 'Marlou' },
] as const;
type Owner = (typeof owners)[number]['value'];
const ownerTitles = {
  collection: { shared: 'Shared CDs', arthur: "Arthur's CDs", marlou: "Marlou's CDs" },
  wishlist: { shared: 'Shared wishlist', arthur: "Arthur's wishlist", marlou: "Marlou's wishlist" },
} as const;

const byText = (a = '', b = '') => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
const sorts = {
  added: { label: 'Latest additions', compare: (a: AlbumCard, b: AlbumCard) => b.addedAt.localeCompare(a.addedAt) },
  title: { label: 'Title (A–Z)', compare: (a: AlbumCard, b: AlbumCard) => byText(a.title, b.title) },
  artist: {
    label: 'Artist (A–Z)',
    compare: (a: AlbumCard, b: AlbumCard) => byText(a.artist, b.artist) || (a.year ?? 0) - (b.year ?? 0) || byText(a.title, b.title),
  },
  newest: { label: 'Release year (newest)', compare: (a: AlbumCard, b: AlbumCard) => (b.year ?? 0) - (a.year ?? 0) },
  oldest: {
    label: 'Release year (oldest)',
    // Albums without a year go last.
    compare: (a: AlbumCard, b: AlbumCard) => (a.year ?? 9999) - (b.year ?? 9999),
  },
} as const;
type Sort = keyof typeof sorts;
type View = 'grid' | 'list';

const isSort = (value: unknown): value is Sort => typeof value === 'string' && value in sorts;
const decadeOf = (year?: number) => (year ? `${Math.floor(year / 10) * 10}s` : undefined);
const same = (a = '', b = '') => a.toLowerCase() === b.toLowerCase();

/** The choices for a filter, most common first, without case duplicates ("5 Seconds Of Summer"). */
function choices(values: string[]) {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of values) {
    const entry = counts.get(value.toLowerCase()) ?? { value, count: 0 };
    entry.count++;
    counts.set(value.toLowerCase(), entry);
  }
  return [...counts.values()].toSorted((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
const isOwner = (value: unknown): value is Owner => owners.some((owner) => owner.value === value);

/** The search, owner, sort and view, kept in the URL so a view can be shared. */
function useBrowseState() {
  const params = new URLSearchParams(location.search);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [owner, setOwner] = useState<Owner>(isOwner(params.get('owner')) ? (params.get('owner') as Owner) : 'all');
  const [sort, setSort] = useState<Sort>(isSort(params.get('sort')) ? (params.get('sort') as Sort) : 'added');
  const [artist, setArtist] = useState(params.get('artist') ?? undefined);
  const [genre, setGenre] = useState(params.get('genre') ?? undefined);
  const [decade, setDecade] = useState(params.get('decade') ?? undefined);
  const [view, setView] = useState<View>(() => {
    const fromUrl = params.get('view');
    if (fromUrl === 'grid' || fromUrl === 'list') return fromUrl;
    try {
      return localStorage.getItem('view') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query.trim());
    if (owner !== 'all') next.set('owner', owner);
    if (artist) next.set('artist', artist);
    if (genre) next.set('genre', genre);
    if (decade) next.set('decade', decade);
    if (sort !== 'added') next.set('sort', sort);
    if (view !== 'grid') next.set('view', view);
    const search = next.toString();
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}`);
    try {
      localStorage.setItem('view', view);
    } catch {}
  }, [query, owner, artist, genre, decade, sort, view]);

  return { query, setQuery, owner, setOwner, artist, setArtist, genre, setGenre, decade, setDecade, sort, setSort, view, setView };
}

export default function AlbumListPage({ baseUrl, section, title, subtitle, albums, share, empty, home }: Props) {
  const { query, setQuery, owner, setOwner, artist, setArtist, genre, setGenre, decade, setDecade, sort, setSort, view, setView } =
    useBrowseState();

  const filters = useMemo(
    () => ({
      artists: choices(albums.map((album) => album.artist)),
      genres: choices(albums.flatMap((album) => album.genres)),
      decades: choices(albums.flatMap((album) => decadeOf(album.year) ?? [])).toSorted((a, b) => b.value.localeCompare(a.value)),
    }),
    [albums],
  );

  const fuse = useMemo(
    () =>
      new Fuse(albums, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'artist', weight: 3 },
          { name: 'label', weight: 1 },
          { name: 'genres', weight: 1 },
          { name: 'tracks', weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [albums],
  );

  const shown = useMemo(() => {
    const found = query.trim() ? fuse.search(query.trim()).map((result) => result.item) : albums;
    const mine = found.filter(
      (album) =>
        (owner === 'all' || album.owner === owner) &&
        (!artist || same(album.artist, artist)) &&
        (!genre || album.genres.some((g) => same(g, genre))) &&
        (!decade || decadeOf(album.year) === decade),
    );
    // While searching with the default order, the best matches come first.
    return query.trim() && sort === 'added' ? mine : mine.toSorted(sorts[sort].compare);
  }, [albums, fuse, query, owner, artist, genre, decade, sort]);

  const filtered = query.trim() !== '' || owner !== 'all' || !!artist || !!genre || !!decade;
  const ownerTitle = owner === 'all' ? undefined : ownerTitles[section][owner];
  // Sharing one person's wishlist shares just their part of it.
  const pageShare = share && ownerTitle ? { ...share, href: `${share.href}?owner=${owner}`, title: ownerTitle } : share;
  // The shelves and the count follow the owner filter instead of disappearing, so switching owner doesn't reshape the page.
  const owned = useMemo(() => (owner === 'all' ? albums : albums.filter((album) => album.owner === owner)), [albums, owner]);
  const recent = useMemo(() => owned.toSorted(sorts.added.compare).slice(0, 10), [owned]);
  const favorites = useMemo(() => owned.filter((album) => album.favorite), [owned]);
  const shareItem = (album: AlbumCard) =>
    share && (
      <ShareButton
        href={album.href}
        title={`${album.title} by ${album.artist}`}
        text={`On Arthur & Marlou's wishlist: ${album.title} by ${album.artist}`}
        shape="circle"
      />
    );

  return (
    <Shell baseUrl={baseUrl} section={section}>
      <PageHeader
        title={ownerTitle ?? title}
        subtitle={section === 'collection' ? `${plural(owned.length)} on the shelf.` : subtitle}
        actions={pageShare && albums.length > 0 && <ShareButton {...pageShare} label="Share" />}
      />

      {home && recent.length > 0 && <Shelf title="Latest additions" albums={recent} caption={addedCaption} />}
      {home && favorites.length > 0 && <Shelf title="Favourites" albums={favorites} />}

      {albums.length > 0 && (
        <Flex vertical gap={12} style={{ marginBottom: 24 }}>
          {home && <SectionTitle>All albums</SectionTitle>}
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined />}
            placeholder="Search titles, artists, labels, songs"
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Flex gap={8} wrap align="center">
            <Segmented<Owner> options={[...owners]} value={owner} onChange={setOwner} />
            <Select<Sort>
              aria-label="Sort by"
              value={sort}
              onChange={setSort}
              options={Object.entries(sorts).map(([value, { label }]) => ({ value: value as Sort, label }))}
              style={{ minWidth: 190 }}
            />
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', icon: <AppstoreOutlined />, title: 'Covers' },
                { value: 'list', icon: <UnorderedListOutlined />, title: 'List' },
              ]}
              style={{ marginLeft: 'auto' }}
            />
          </Flex>
          <Flex gap={8}>
            {(
              [
                { label: 'Artist', value: artist, set: setArtist, options: filters.artists },
                { label: 'Genre', value: genre, set: setGenre, options: filters.genres },
                { label: 'Decade', value: decade, set: setDecade, options: filters.decades },
              ] as const
            ).map((filter) => (
              <Select<string>
                key={filter.label}
                allowClear
                showSearch
                placeholder={filter.label}
                aria-label={filter.label}
                value={filter.value}
                onChange={(value) => filter.set(value)}
                options={filter.options.map(({ value, count }) => ({ value, label: `${value} (${count})` }))}
                labelRender={({ value }) => value}
                popupMatchSelectWidth={false}
                style={{ flex: 1, minWidth: 0 }}
              />
            ))}
          </Flex>
          {/* Always there, so filtering doesn't push the albums down. */}
          <Typography.Text type="secondary" aria-live="polite">
            {filtered ? `${shown.length} of ${plural(albums.length)}` : plural(albums.length)}
          </Typography.Text>
        </Flex>
      )}

      {shown.length === 0 ? (
        <Empty description={albums.length ? 'No albums match' : (empty ?? 'Nothing here yet')} />
      ) : view === 'list' ? (
        <List
          dataSource={shown}
          renderItem={(album) => (
            <List.Item key={album.id} extra={shareItem(album)}>
              <a href={album.href} style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flex: 1, color: 'inherit' }}>
                <div style={{ width: 56, flex: 'none' }}>
                  <CoverImage cover={album.cover} alt={`${album.title} by ${album.artist}`} sizes="56px" radius="sm" iconSize={24} />
                </div>
                <Flex vertical style={{ minWidth: 0 }}>
                  <Typography.Text strong ellipsis>
                    {album.title}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis>
                    {album.year ? `${album.artist} · ${album.year}` : album.artist}
                  </Typography.Text>
                </Flex>
                {album.owner !== 'shared' && (
                  <Tag style={{ marginLeft: 'auto', flex: 'none' }}>{album.owner === 'arthur' ? 'Arthur' : 'Marlou'}</Tag>
                )}
              </a>
            </List.Item>
          )}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {shown.map((album, i) => (
            <Col key={album.id} xs={12} sm={8} md={6} xl={4} style={{ position: 'relative' }}>
              <a href={album.href} style={{ display: 'block', height: '100%' }}>
                <Card
                  hoverable
                  style={{ height: '100%' }}
                  styles={{ body: { padding: 12 } }}
                  cover={
                    <CoverImage
                      cover={album.cover}
                      alt={`${album.title} by ${album.artist}`}
                      sizes="(min-width: 1200px) 180px, (min-width: 768px) 25vw, (min-width: 576px) 33vw, 50vw"
                      eager={i < 6}
                    />
                  }
                >
                  <Card.Meta
                    title={album.title}
                    description={album.year ? `${album.artist} · ${album.year}` : album.artist}
                  />
                </Card>
              </a>
              {/* Outside the link: a button can't sit inside one. */}
              {share && <div style={{ position: 'absolute', top: 8, right: 16 }}>{shareItem(album)}</div>}
            </Col>
          ))}
        </Row>
      )}
    </Shell>
  );
}
