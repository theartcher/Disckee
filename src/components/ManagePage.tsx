import type { ReactNode } from 'react';
import { Card, Col, Row } from 'antd';
import { BulbOutlined, EditOutlined, ScanOutlined } from '@ant-design/icons';
import Shell from './Shell';
import PageHeader from './PageHeader';

export interface Tool {
  /** A link, or an action like the random pick. */
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}

export const ownerTools = (baseUrl: string): Tool[] => [
  { href: `${baseUrl}/add/`, icon: <ScanOutlined />, title: 'Add a CD', description: 'Scan a barcode or search.' },
  { href: `${baseUrl}/suggestions/`, icon: <BulbOutlined />, title: 'Suggestions', description: 'Wishlist ideas from what we own.' },
  { href: `${baseUrl}/admin/`, icon: <EditOutlined />, title: 'Edit albums', description: 'Fix details, favourites, "Got it", publish.' },
];

/** The owners' tools as a grid of cards. */
export function ToolCards({ tools, tiles }: { tools: Tool[]; tiles?: boolean }) {
  return (
    <Row gutter={[16, 16]}>
      {tools.map((tool) => {
        const card = (
          <Card hoverable style={{ height: '100%' }} styles={tiles ? { body: { padding: 16 } } : undefined}>
            {tiles ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{tool.icon}</div>
                <Card.Meta title={tool.title} description={tool.description} />
              </>
            ) : (
              <Card.Meta avatar={<span style={{ fontSize: 24 }}>{tool.icon}</span>} title={tool.title} description={tool.description} />
            )}
          </Card>
        );
        return (
          <Col key={tool.title} xs={tiles ? 12 : 24} sm={12} lg={tiles ? 6 : 8}>
            {tool.href ? (
              <a href={tool.href} style={{ display: 'block', height: '100%' }}>
                {card}
              </a>
            ) : (
              <button
                type="button"
                onClick={tool.onClick}
                style={{ all: 'unset', display: 'block', width: '100%', height: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                {card}
              </button>
            )}
          </Col>
        );
      })}
    </Row>
  );
}

/** Admin: one place for the owners' tools that change the collection. */
export default function ManagePage({ baseUrl }: { baseUrl: string }) {
  return (
    <Shell baseUrl={baseUrl} section="manage">
      <PageHeader title="Admin" subtitle="Tools for Arthur and Marlou. Saving anything asks you to sign in with GitHub." />
      <ToolCards tools={ownerTools(baseUrl)} />
    </Shell>
  );
}
