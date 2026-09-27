import type { ReactNode } from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { BulbOutlined, EditOutlined, ScanOutlined } from '@ant-design/icons';
import Shell from './Shell';

interface Tool {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}

/** The owners' panel: one place for the tools that change the collection. */
export default function ManagePage({ baseUrl }: { baseUrl: string }) {
  const tools: Tool[] = [
    { href: `${baseUrl}/add/`, icon: <ScanOutlined />, title: 'Add a CD', description: 'Scan a barcode or search, then save it to the collection or the wishlist.' },
    { href: `${baseUrl}/suggestions/`, icon: <BulbOutlined />, title: 'Suggestions', description: 'Wishlist ideas based on what is already on the shelf.' },
    { href: `${baseUrl}/admin/`, icon: <EditOutlined />, title: 'Edit albums', description: 'Fix details, mark favourites, move a wishlist CD to the collection, and publish.' },
  ];

  return (
    <Shell baseUrl={baseUrl} section="manage">
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Owners' panel
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Tools for Arthur and Marlou. Saving anything asks you to sign in with GitHub.
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {tools.map((tool) => (
          <Col key={tool.href} xs={24} sm={12} lg={8}>
            <a href={tool.href} style={{ display: 'block', height: '100%' }}>
              <Card hoverable style={{ height: '100%' }}>
                <Card.Meta
                  avatar={<span style={{ fontSize: 24 }}>{tool.icon}</span>}
                  title={tool.title}
                  description={tool.description}
                />
              </Card>
            </a>
          </Col>
        ))}
      </Row>
    </Shell>
  );
}
