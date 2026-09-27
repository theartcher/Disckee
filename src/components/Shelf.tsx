import { useState } from 'react';
import { Button, Flex, Typography } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { SectionTitle } from './PageHeader';
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

/** A horizontal, swipeable row of covers that can be folded away. */
export default function Shelf({ title, albums, caption }: Props) {
  const [open, setOpen] = useState(() => initiallyOpen(title));
  const toggle = () => {
    setOpen(!open);
    try {
      if (open) localStorage.setItem(storageKey(title), '1');
      else localStorage.removeItem(storageKey(title));
    } catch {}
  };

  return (
    <section style={{ marginBottom: open ? 32 : 20 }}>
      <SectionTitle
        action={
          <Button
            type="text"
            icon={open ? <UpOutlined /> : <DownOutlined />}
            iconPlacement="end"
            aria-expanded={open}
            onClick={toggle}
          >
            {open ? 'Hide' : 'Show'}
          </Button>
        }
      >
        {title}
      </SectionTitle>
      {open && (
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
      )}
    </section>
  );
}
