import type { ReactNode } from 'react';
import { Card, Col, Empty, Flex, Row, Typography } from 'antd';
import Shell from './Shell';
import CoverImage from './CoverImage';
import ShareButton from './ShareButton';
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
}

export default function AlbumListPage({ baseUrl, section, title, subtitle, albums, share, empty }: Props) {
  return (
    <Shell baseUrl={baseUrl} section={section}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {share && albums.length > 0 && <ShareButton {...share} label="Share" />}
      </Flex>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 24 }}>
        {subtitle}
      </Typography.Paragraph>

      {albums.length === 0 ? (
        <Empty description={empty ?? 'Nothing here yet'} />
      ) : (
        <Row gutter={[16, 16]}>
          {albums.map((album, i) => (
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
              {share && (
                <div style={{ position: 'absolute', top: 8, right: 16 }}>
                  <ShareButton
                    href={album.href}
                    title={`${album.title} by ${album.artist}`}
                    text={`On Arthur & Marlou's wishlist: ${album.title} by ${album.artist}`}
                    shape="circle"
                  />
                </div>
              )}
            </Col>
          ))}
        </Row>
      )}
    </Shell>
  );
}
