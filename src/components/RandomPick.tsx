import { useState } from 'react';
import { Button, Modal, Typography, message } from 'antd';
import { CheckOutlined, CustomerServiceOutlined, ReloadOutlined } from '@ant-design/icons';
import CoverImage from './CoverImage';
import type { AlbumCard } from '../lib/albums';

// What was played lives on this device only: the site is static, so there's
// nowhere shared to keep it without signing in.
const playedKey = 'disckee:played';
const restFor = 14 * 24 * 60 * 60 * 1000;

function recentlyPlayed(): Record<string, number> {
  try {
    const stored = JSON.parse(localStorage.getItem(playedKey) ?? '{}') as Record<string, number>;
    return Object.fromEntries(Object.entries(stored).filter(([, at]) => Date.now() - at < restFor));
  } catch {
    return {};
  }
}

function rememberPlayed(id: string) {
  try {
    localStorage.setItem(playedKey, JSON.stringify({ ...recentlyPlayed(), [id]: Date.now() }));
  } catch {}
}

/** "What should we play?": a random CD from the albums currently shown, skipping ones played in the last two weeks. */
export default function RandomPick({ albums }: { albums: AlbumCard[] }) {
  const [pick, setPick] = useState<AlbumCard>();
  const [toast, holder] = message.useMessage();

  const draw = () => {
    const played = recentlyPlayed();
    const fresh = albums.filter((album) => !played[album.id]);
    // Everything shown was played lately: pick from all of it rather than nothing.
    const candidates = fresh.length ? fresh : albums;
    // Avoid picking the same CD twice in a row when there's a choice.
    const pool = candidates.length > 1 ? candidates.filter((album) => album !== pick) : candidates;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  };

  const play = () => {
    if (!pick) return;
    rememberPlayed(pick.id);
    setPick(undefined);
    void toast.success(`Enjoy ${pick.title}! It won't come up again for two weeks.`);
  };

  return (
    <>
      {holder}
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
          <Button key="play" type="primary" icon={<CheckOutlined />} onClick={play}>
            We're playing this
          </Button>,
        ]}
      >
        {pick && (
          <a href={pick.href} style={{ color: 'inherit' }}>
            <CoverImage cover={pick.cover} alt={`${pick.title} by ${pick.artist}`} sizes="312px" eager radius="lg" />
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              {pick.title}
            </Typography.Title>
            <Typography.Text type="secondary">{pick.year ? `${pick.artist} · ${pick.year}` : pick.artist}</Typography.Text>
          </a>
        )}
      </Modal>
    </>
  );
}
