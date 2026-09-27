import { Flex, Typography } from 'antd';
import CoverImage from './CoverImage';
import type { AlbumCard } from '../lib/albums';

interface Props {
  title: string;
  albums: AlbumCard[];
  caption?: (album: AlbumCard) => string | undefined;
}

/** A horizontal, swipeable row of covers. */
export default function Shelf({ title, albums, caption }: Props) {
  return (
    <section style={{ marginBottom: 24 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {title}
      </Typography.Title>
      <Flex
        gap={12}
        style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollPaddingInline: 16, paddingBottom: 8, marginInline: -16, paddingInline: 16 }}
      >
        {albums.map((album) => (
          <a
            key={album.id}
            href={album.href}
            style={{ flex: '0 0 132px', scrollSnapAlign: 'start', color: 'inherit', minWidth: 0 }}
          >
            <CoverImage cover={album.cover} alt={`${album.title} by ${album.artist}`} sizes="132px" radius={6} iconSize={36} />
            <Typography.Text strong ellipsis style={{ display: 'block', marginTop: 6 }}>
              {album.title}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
              {caption?.(album) ?? album.artist}
            </Typography.Text>
          </a>
        ))}
      </Flex>
    </section>
  );
}
