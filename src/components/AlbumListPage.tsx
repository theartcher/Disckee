import { Card, Col, Empty, Row, Typography } from 'antd';
import Shell from './Shell';
import CoverImage from './CoverImage';
import type { AlbumCard, Section } from '../lib/albums';

interface Props {
  baseUrl: string;
  section: Section;
  title: string;
  subtitle: string;
  albums: AlbumCard[];
}

export default function AlbumListPage({ baseUrl, section, title, subtitle, albums }: Props) {
  return (
    <Shell baseUrl={baseUrl} section={section}>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        {subtitle}
      </Typography.Paragraph>

      {albums.length === 0 ? (
        <Empty description="Nothing here yet" />
      ) : (
        <Row gutter={[16, 16]}>
          {albums.map((album, i) => (
            <Col key={album.id} xs={12} sm={8} md={6} xl={4}>
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
            </Col>
          ))}
        </Row>
      )}
    </Shell>
  );
}
