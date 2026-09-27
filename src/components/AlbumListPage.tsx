import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card, Col, Empty, Flex, Input, List, Row, Segmented, Select, Tag, Typography } from 'antd';
import { AppstoreOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import Fuse from 'fuse.js';
import Shell from './Shell';
import CoverImage from './CoverImage';
import ShareButton from './ShareButton';
import Shelf from './Shelf';
import RandomPick from './RandomPick';
import type { AlbumCard, Section } from '../lib/albums';

interface Props {
  baseUrl: string;
  section: Section;
  title: string;
  subtitle: ReactNode;
  albums: AlbumCard[];
  /** Adds share buttons for the page and for each album. */
  share?: { href: string; title: string; text: string };
  empty?: string;
  /** The home page: adds the "Recently added" and favourites shelves and a random pick. */
  home?: boolean;
}

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

const byText = (a = '', b = '') => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
const sorts = {
  added: { label: 'Recently added', compare: (a: AlbumCard, b: AlbumCard) => b.addedAt.localeCompare(a.addedAt) },
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
const isOwner = (value: unknown): value is Owner => owners.some((owner) => owner.value === value);

/** The search, owner, sort and view, kept in the URL so a view can be shared. */
function useBrowseState() {
  const params = new URLSearchParams(location.search);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [owner, setOwner] = useState<Owner>(isOwner(params.get('owner')) ? (params.get('owner') as Owner) : 'all');
  const [sort, setSort] = useState<Sort>(isSort(params.get('sort')) ? (params.get('sort') as Sort) : 'added');
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
    if (sort !== 'added') next.set('sort', sort);
    if (view !== 'grid') next.set('view', view);
    const search = next.toString();
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}`);
    try {
      localStorage.setItem('view', view);
    } catch {}
  }, [query, owner, sort, view]);

  return { query, setQuery, owner, setOwner, sort, setSort, view, setView };
}

export default function AlbumListPage({ baseUrl, section, title, subtitle, albums, share, empty, home }: Props) {
  const { query, setQuery, owner, setOwner, sort, setSort, view, setView } = useBrowseState();

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
    const mine = owner === 'all' ? found : found.filter((album) => album.owner === owner);
    // While searching with the default order, the best matches come first.
    return query.trim() && sort === 'added' ? mine : mine.toSorted(sorts[sort].compare);
  }, [albums, fuse, query, owner, sort]);

  const filtered = query.trim() !== '' || owner !== 'all';
  const recent = useMemo(() => albums.toSorted(sorts.added.compare).slice(0, 10), [albums]);
  const favorites = useMemo(() => albums.filter((album) => album.favorite), [albums]);
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
      <Flex align="center" justify="space-between" gap={16} wrap>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {share && albums.length > 0 && <ShareButton {...share} label="Share" />}
      </Flex>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 16 }}>
        {subtitle}
      </Typography.Paragraph>

      {home && !filtered && recent.length > 0 && <Shelf title="Recently added" albums={recent} caption={addedCaption} />}
      {home && !filtered && favorites.length > 0 && <Shelf title="Favourites" albums={favorites} />}

      {albums.length > 0 && (
        <Flex vertical gap={12} style={{ marginBottom: 24 }}>
          {home && (
            <Typography.Title level={4} style={{ margin: 0 }}>
              All albums
            </Typography.Title>
          )}
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
            {home && <RandomPick albums={shown} />}
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
          {filtered && (
            <Typography.Text type="secondary">
              {shown.length} of {albums.length} {albums.length === 1 ? 'album' : 'albums'}
            </Typography.Text>
          )}
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
                  <CoverImage cover={album.cover} alt={`${album.title} by ${album.artist}`} sizes="56px" radius={4} iconSize={24} />
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
