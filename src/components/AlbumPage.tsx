import { Breadcrumb, Button, Col, Descriptions, Divider, List, Row, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { ExportOutlined, HeartOutlined } from '@ant-design/icons';
import Shell from './Shell';
import CoverImage from './CoverImage';
import ShareButton from './ShareButton';
import type { AlbumDetail } from '../lib/albums';

interface Props {
  baseUrl: string;
  album: AlbumDetail;
}

/** The list this album belongs to, with the search and filters it was opened from when it was opened from there. */
function listHref(baseUrl: string, status: AlbumDetail['status']) {
  const list = `${baseUrl}/${status}/`;
  try {
    const from = new URL(document.referrer);
    if (from.origin === location.origin && from.pathname === list) return `${from.pathname}${from.search}`;
  } catch {}
  return list;
}

export default function AlbumPage({ baseUrl, album }: Props) {
  const onWishlist = album.status === 'wishlist';
  const [back] = useState(() => listHref(baseUrl, album.status));
  const facts = [
    album.year && { key: 'year', label: 'Year', children: album.year },
    album.label && { key: 'label', label: 'Label', children: album.label },
    { key: 'owner', label: onWishlist ? 'Wished for by' : 'Belongs to', children: album.owner },
    !onWishlist && album.acquiredAt && { key: 'acquired', label: 'Got it on', children: album.acquiredAt },
    {
      key: 'added',
      label: 'Added',
      children: album.addedBy ? `${album.addedAt} by ${album.addedBy}` : album.addedAt,
    },
  ].filter(Boolean) as { key: string; label: string; children: React.ReactNode }[];

  return (
    <Shell baseUrl={baseUrl} section={album.status}>
      <Breadcrumb
        items={[{ title: onWishlist ? 'Wishlist' : 'Collection', href: back }, { title: album.title }]}
        style={{ marginBottom: 12 }}
      />
      <Row gutter={[32, 24]}>
        <Col xs={24} md={10} lg={8}>
          <CoverImage
            cover={album.cover}
            alt={`${album.title} by ${album.artist}`}
            sizes="(min-width: 768px) 360px, 100vw"
            eager
            radius="lg"
          />
        </Col>

        <Col xs={24} md={14} lg={16}>
          {onWishlist && (
            <Tag icon={<HeartOutlined />} color="magenta" style={{ marginBottom: 12 }}>
              On our wishlist
            </Tag>
          )}
          <Typography.Title level={2} style={{ margin: 0 }}>
            {album.title}
          </Typography.Title>
          <Typography.Title level={4} type="secondary" style={{ marginTop: 4 }}>
            {album.artist}
          </Typography.Title>

          {album.genres.length > 0 && (
            <Space size={[8, 8]} wrap style={{ marginBottom: 16 }}>
              {album.genres.map((genre) => (
                <Tag key={genre} variant="outlined" style={{ margin: 0 }}>
                  {genre}
                </Tag>
              ))}
            </Space>
          )}

          <Descriptions column={{ xs: 1, sm: 2 }} items={facts} size="small" />

          {album.note && (
            <Typography.Paragraph style={{ marginTop: 16 }}>
              <blockquote>{album.note}</blockquote>
            </Typography.Paragraph>
          )}

          {/* Wishlist CDs only: Share for the family chat, and the release details for whoever buys it. */}
          {onWishlist && (
            <Space wrap style={{ marginTop: 16 }}>
              <ShareButton
                href={album.href}
                title={`${album.title} by ${album.artist}`}
                text={`On Arthur & Marlou's wishlist: ${album.title} by ${album.artist}`}
                label="Share"
              />
              {album.musicbrainzUrl && (
                <Button href={album.musicbrainzUrl} icon={<ExportOutlined />} target="_blank" rel="noopener">
                  View on MusicBrainz
                </Button>
              )}
            </Space>
          )}

          {album.discs.length > 0 && (
            <>
              <Divider titlePlacement="start">Tracklist</Divider>
              {album.discs.map(({ disc, tracks }) => (
                <List
                  key={disc}
                  size="small"
                  header={album.discs.length > 1 ? <Typography.Text strong>Disc {disc}</Typography.Text> : undefined}
                  dataSource={tracks}
                  renderItem={(track) => (
                    <List.Item extra={track.duration && <Typography.Text type="secondary">{track.duration}</Typography.Text>}>
                      <Space>
                        <Typography.Text type="secondary" style={{ display: 'inline-block', minWidth: 20, textAlign: 'right' }}>
                          {track.position}
                        </Typography.Text>
                        {track.title}
                      </Space>
                    </List.Item>
                  )}
                />
              ))}
            </>
          )}
        </Col>
      </Row>
    </Shell>
  );
}
