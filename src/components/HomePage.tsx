import { Card, Typography, theme } from 'antd';
import { CustomerServiceOutlined, HeartOutlined } from '@ant-design/icons';
import { ToolCards, ownerTools } from './ManagePage';
import Shell from './Shell';
import { useRandomPick } from './RandomPick';
import OnThisDay from './OnThisDay';
import type { AlbumCard, CoverImage } from '../lib/albums';

export interface Tile {
  href: string;
  title: string;
  caption: string;
  /** Up to four covers, shown as a 2×2 mosaic. */
  covers: CoverImage[];
  icon?: 'wishlist';
}

const icons = { wishlist: <HeartOutlined /> };

function Mosaic({ tile }: { tile: Tile }) {
  const { token } = theme.useToken();
  const box = { aspectRatio: '1', width: '100%', background: token.colorFillTertiary } as const;
  if (tile.covers.length < 4) {
    // Too few covers for a mosaic: one big one, or an icon.
    const [cover] = tile.covers;
    return cover ? (
      <img src={cover.src} srcSet={cover.srcSet || undefined} sizes="(min-width: 768px) 220px, 50vw" alt="" style={{ ...box, display: 'block', objectFit: 'cover' }} />
    ) : (
      <div aria-hidden="true" style={{ ...box, display: 'grid', placeItems: 'center', fontSize: 48, color: token.colorTextQuaternary }}>
        {tile.icon ? icons[tile.icon] : <CustomerServiceOutlined />}
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ ...box, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {tile.covers.map((cover) => (
        <img
          key={cover.src}
          src={cover.src}
          srcSet={cover.srcSet || undefined}
          sizes="(min-width: 768px) 110px, 25vw"
          alt=""
          loading="lazy"
          style={{ width: '100%', aspectRatio: '1', display: 'block', objectFit: 'cover' }}
        />
      ))}
    </div>
  );
}

/** The front page: a tile per part of the site. */
export default function HomePage({ baseUrl, tiles, albums }: { baseUrl: string; tiles: Tile[]; albums: AlbumCard[] }) {
  const pick = useRandomPick(albums);
  return (
    <Shell baseUrl={baseUrl} section="home">
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Arthur & Marlou's CDs
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Our CD collection, and the ones we'd love to have.
      </Typography.Paragraph>
      <OnThisDay albums={albums} />
      {/* As many tiles per row as fit: all of them on a desktop, two on a phone. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {tiles.map((tile) => (
          <a key={tile.href} href={tile.href} style={{ display: 'block', height: '100%' }}>
            <Card hoverable style={{ height: '100%', overflow: 'hidden' }} styles={{ body: { padding: 12 } }} cover={<Mosaic tile={tile} />}>
              <Card.Meta title={tile.title} description={tile.caption} />
            </Card>
          </a>
        ))}
      </div>

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        For Arthur & Marlou
      </Typography.Title>
      {/* The random pick lives here rather than on the collection page: it's for the two of us, not a way to browse. */}
      <ToolCards
        tiles
        tools={[
          ...ownerTools(baseUrl),
          { onClick: pick.draw, icon: <CustomerServiceOutlined />, title: 'Pick a CD', description: "A random one we haven't played lately." },
        ]}
      />
      {pick.picker}
    </Shell>
  );
}
