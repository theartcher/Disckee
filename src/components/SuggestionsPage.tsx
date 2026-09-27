import { useState } from 'react';
import { Button, Empty, Flex, Typography, theme } from 'antd';
import { CustomerServiceOutlined, HeartOutlined } from '@ant-design/icons';
import Shell from './Shell';
import { newAlbumUrl } from '../lib/handoff';
import type { SuggestedAlbum, Suggestions } from '../lib/suggestions';

interface Props {
  baseUrl: string;
  suggestions: Suggestions;
}

const coverUrl = (album: SuggestedAlbum, size: 250 | 500) => `https://coverartarchive.org/release-group/${album.id}/front-${size}`;

/** A Cover Art Archive cover, or a placeholder when there is none. */
function Cover({ album, artist }: { album: SuggestedAlbum; artist: string }) {
  const { token } = theme.useToken();
  const [missing, setMissing] = useState(false);
  const box = { width: '100%', aspectRatio: '1', display: 'block', borderRadius: token.borderRadiusLG, background: token.colorFillTertiary } as const;
  if (missing) {
    return (
      <div aria-hidden="true" style={{ ...box, display: 'grid', placeItems: 'center', color: token.colorTextQuaternary, fontSize: 36 }}>
        <CustomerServiceOutlined />
      </div>
    );
  }
  return (
    <img
      src={coverUrl(album, 250)}
      alt={`Cover of ${album.title} by ${artist}`}
      loading="lazy"
      onError={() => setMissing(true)}
      style={{ ...box, objectFit: 'cover' }}
    />
  );
}

function AlbumTile({
  baseUrl,
  album,
  artist,
  caption,
  reason,
}: {
  baseUrl: string;
  album: SuggestedAlbum;
  artist: string;
  caption: string;
  reason?: string;
}) {
  // Opens the usual new-album form in /admin, set to the wishlist. The cover
  // is downloaded on the next publish, like a CD added from /add.
  const href = newAlbumUrl(baseUrl, {
    title: album.title,
    artist,
    year: album.year,
    status: 'wishlist',
    cover: coverUrl(album, 500),
    coverCredit: 'cover-art-archive',
  });
  return (
    <Flex vertical gap={6} style={{ flex: '0 0 148px', scrollSnapAlign: 'start', minWidth: 0 }}>
      <a href={`https://musicbrainz.org/release-group/${album.id}`} target="_blank" rel="noopener" style={{ color: 'inherit' }}>
        <Cover album={album} artist={artist} />
        <Typography.Text strong ellipsis style={{ display: 'block', marginTop: 6 }}>
          {album.title}
        </Typography.Text>
        <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
          {caption}
        </Typography.Text>
        {reason && (
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 12 }}>
            {reason}
          </Typography.Paragraph>
        )}
      </a>
      <Button size="small" icon={<HeartOutlined />} href={href}>
        Add to wishlist
      </Button>
    </Flex>
  );
}

const row = { overflowX: 'auto', scrollSnapType: 'x mandatory', scrollPaddingInline: 16, paddingBottom: 8, marginInline: -16, paddingInline: 16 } as const;

export default function SuggestionsPage({ baseUrl, suggestions }: Props) {
  const { more, similar } = suggestions;
  return (
    <Shell baseUrl={baseUrl} section="suggestions">
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Suggestions
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Ideas for the wishlist, based on what's already on the shelf. Updated every time the site is published.
      </Typography.Paragraph>

      {!more.length && !similar.length && <Empty description="No suggestions yet. They appear after the next publish." />}

      {similar.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <Typography.Title level={4}>You might also like</Typography.Title>
          <Flex gap={12} style={row}>
            {similar.map((item) => (
              <AlbumTile
                key={item.artistId}
                baseUrl={baseUrl}
                album={item.album}
                artist={item.artist}
                caption={item.artist}
                reason={`Because you have ${item.because.join(' and ')}`}
              />
            ))}
          </Flex>
        </section>
      )}

      {more.map((item) => (
        <section key={item.artistId} style={{ marginBottom: 24 }}>
          <Typography.Title level={4}>More from {item.artist}</Typography.Title>
          <Flex gap={12} style={row}>
            {item.albums.map((album) => (
              <AlbumTile key={album.id} baseUrl={baseUrl} album={album} artist={item.artist} caption={album.year ? String(album.year) : item.artist} />
            ))}
          </Flex>
        </section>
      ))}

      <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
        Albums from MusicBrainz, similar artists from ListenBrainz.
      </Typography.Paragraph>
    </Shell>
  );
}
