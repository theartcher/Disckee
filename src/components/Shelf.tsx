import { useState } from 'react';
import { Collapse, Flex, Typography } from 'antd';
import CoverImage from './CoverImage';
import type { AlbumCard } from '../lib/albums';

interface Props {
  title: string;
  albums: AlbumCard[];
  caption?: (album: AlbumCard) => string | undefined;
}

/** Whether this shelf was folded away on this device. Open unless someone closed it. */
const storageKey = (title: string) => `disckee:shelf-closed:${title}`;
function initiallyOpen(title: string) {
  try {
    return localStorage.getItem(storageKey(title)) !== '1';
  } catch {
    return true;
  }
}

/** A horizontal, swipeable row of covers, folded with antd's Collapse. */
export default function Shelf({ title, albums, caption }: Props) {
  const [open, setOpen] = useState(() => initiallyOpen(title));
  const toggle = (keys: string[]) => {
    const next = keys.includes('shelf');
    setOpen(next);
    try {
      if (next) localStorage.removeItem(storageKey(title));
      else localStorage.setItem(storageKey(title), '1');
    } catch {}
  };

  const row = (
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
          <CoverImage cover={album.cover} alt={`${album.title} by ${album.artist}`} sizes="132px" radius="lg" iconSize={36} />
          <Typography.Text strong ellipsis style={{ display: 'block', marginTop: 6 }}>
            {album.title}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
            {caption?.(album) ?? album.artist}
          </Typography.Text>
        </a>
      ))}
    </Flex>
  );

  return (
    <Collapse
      ghost
      // The arrow goes after the title, so the title lines up with the page's other headings.
      expandIconPlacement="end"
      activeKey={open ? ['shelf'] : []}
      onChange={toggle}
      style={{ marginBottom: open ? 32 : 20 }}
      items={[
        {
          key: 'shelf',
          label: (
            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
          ),
          children: row,
          styles: { header: { padding: '0 0 12px', alignItems: 'center' }, body: { padding: 0 } },
        },
      ]}
    />
  );
}
