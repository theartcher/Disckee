import { Card, List, Typography } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import CoverImage from './CoverImage';
import type { AlbumCard } from '../lib/albums';

const names = { arthur: 'Arthur', marlou: 'Marlou', shared: 'Arthur & Marlou' } as const;
const day = 24 * 60 * 60 * 1000;
// "This week": up to three days either side of the anniversary.
const weekSpan = 3;

interface Memory {
  album: AlbumCard;
  years: number;
  exact: boolean;
}

/** Today, as a UTC midnight like the stored dates. `?onthisday=12-25` pretends it's another day, to try the card out. */
function today() {
  const now = new Date();
  const [, month, date] = new URLSearchParams(location.search).get('onthisday')?.match(/^(\d{1,2})-(\d{1,2})$/) ?? [];
  return month
    ? Date.UTC(now.getFullYear(), Number(month) - 1, Number(date))
    : Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** CDs that joined the shelf on this day in an earlier year, or failing that, this week. */
function memories(albums: AlbumCard[]): Memory[] {
  const now = today();
  const year = new Date(now).getUTCFullYear();
  const found = albums.flatMap((album) => {
    if (album.addedUnknown) return [];
    const added = new Date(album.addedAt);
    const years = year - added.getUTCFullYear();
    if (years < 1) return [];
    // Date.UTC rolls 29 February over to 1 March in other years, which is close enough.
    const anniversary = Date.UTC(year, added.getUTCMonth(), added.getUTCDate());
    const off = Math.round(Math.abs(anniversary - now) / day);
    return off <= weekSpan ? [{ album, years, exact: off === 0 }] : [];
  });
  const exact = found.filter((memory) => memory.exact);
  return (exact.length ? exact : found).toSorted((a, b) => b.years - a.years);
}

const ago = ({ years, exact }: Memory) => `${years === 1 ? 'a year' : `${years} years`} ago ${exact ? 'today' : 'this week'}`;

/**
 * "On this day": which CDs arrived on this date in earlier years. Only shows up on days that have one,
 * so it's a small surprise rather than a fixture.
 */
export default function OnThisDay({ albums }: { albums: AlbumCard[] }) {
  const found = memories(albums);
  if (!found.length) return null;
  const exact = found[0].exact;
  return (
    <Card
      size="small"
      style={{ marginBottom: 24 }}
      title={
        <span>
          <CalendarOutlined style={{ marginRight: 8 }} />
          {exact ? 'On this day' : 'This week, years ago'}
        </span>
      }
    >
      <List
        dataSource={found.slice(0, 5)}
        renderItem={(memory) => (
          <List.Item key={memory.album.id}>
            <a href={memory.album.href} style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, flex: 1, color: 'inherit' }}>
              <div style={{ width: 56, flex: 'none' }}>
                <CoverImage cover={memory.album.cover} alt={`${memory.album.title} by ${memory.album.artist}`} sizes="56px" radius="sm" iconSize={24} />
              </div>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ display: 'block' }}>
                  {memory.album.title}
                </Typography.Text>
                <Typography.Text type="secondary" ellipsis style={{ display: 'block' }}>
                  {memory.album.artist}
                </Typography.Text>
                <Typography.Text ellipsis style={{ display: 'block' }}>
                  {names[memory.album.owner]} got it {ago(memory)}
                </Typography.Text>
              </div>
            </a>
          </List.Item>
        )}
      />
    </Card>
  );
}
