import { useState } from 'react';
import { Button, Modal, Typography } from 'antd';
import { CustomerServiceOutlined, ReloadOutlined } from '@ant-design/icons';
import CoverImage from './CoverImage';
import type { AlbumCard } from '../lib/albums';

/** "What should we play?": a random CD from the albums currently shown. */
export default function RandomPick({ albums }: { albums: AlbumCard[] }) {
  const [pick, setPick] = useState<AlbumCard>();

  const draw = () => {
    // Avoid picking the same CD twice in a row when there's a choice.
    const pool = albums.length > 1 ? albums.filter((album) => album !== pick) : albums;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  };

  return (
    <>
      <Button icon={<CustomerServiceOutlined />} onClick={draw} disabled={!albums.length}>
        What should we play?
      </Button>
      <Modal
        open={!!pick}
        onCancel={() => setPick(undefined)}
        title="How about this one?"
        width={360}
        footer={[
          <Button key="again" icon={<ReloadOutlined />} onClick={draw}>
            Another
          </Button>,
          <Button key="open" type="primary" href={pick?.href}>
            Open
          </Button>,
        ]}
      >
        {pick && (
          <>
            <CoverImage cover={pick.cover} alt={`${pick.title} by ${pick.artist}`} sizes="312px" eager radius={8} />
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              {pick.title}
            </Typography.Title>
            <Typography.Text type="secondary">{pick.year ? `${pick.artist} · ${pick.year}` : pick.artist}</Typography.Text>
          </>
        )}
      </Modal>
    </>
  );
}
