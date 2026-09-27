import type { ReactNode } from 'react';
import { Card, Col, Flex, Progress, Row, Statistic, Tag, Tooltip, Typography, theme } from 'antd';
import { ClockCircleOutlined, CustomerServiceOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons';
import Shell from './Shell';
import type { Count, Stats } from '../lib/stats';

interface Props {
  baseUrl: string;
  stats: Stats;
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const hours = (seconds: number) => Math.round(seconds / 360) / 10;
const minutes = (seconds: number) => `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)} h ` : ''}${Math.round((seconds % 3600) / 60)} min`;
const monthName = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} style={{ height: '100%' }}>
      {children}
    </Card>
  );
}

/** A small column chart: one bar per item, tallest = full height. */
function Columns({ items, label, tip }: { items: Count[]; label: (item: Count) => ReactNode; tip: (item: Count) => string }) {
  const { token } = theme.useToken();
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div style={{ overflowX: 'auto' }}>
      <Flex gap={6} align="flex-end" style={{ height: 160, minWidth: items.length * 32 }}>
        {items.map((item) => (
          <Tooltip key={item.label} title={tip(item)}>
            <Flex vertical align="center" justify="flex-end" style={{ flex: 1, minWidth: 26, maxWidth: 64, height: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {item.count || ''}
              </Typography.Text>
              <div
                style={{
                  width: '100%',
                  height: `${(item.count / max) * 120}px`,
                  minHeight: item.count ? 4 : 1,
                  borderRadius: '4px 4px 0 0',
                  background: item.count ? token.colorPrimary : token.colorBorderSecondary,
                }}
              />
            </Flex>
          </Tooltip>
        ))}
      </Flex>
      <Flex gap={6} style={{ minWidth: items.length * 32, borderTop: `1px solid ${token.colorBorder}`, paddingTop: 4 }}>
        {items.map((item) => (
          <Typography.Text key={item.label} type="secondary" style={{ flex: 1, minWidth: 26, maxWidth: 64, fontSize: 12, textAlign: 'center' }}>
            {label(item)}
          </Typography.Text>
        ))}
      </Flex>
    </div>
  );
}

export default function StatsPage({ baseUrl, stats }: Props) {
  const { token } = theme.useToken();
  const search = (text: string) => `${baseUrl}/collection/?q=${encodeURIComponent(text)}`;
  const owners = [
    { key: 'marlou', name: 'Marlou', count: stats.owners.marlou, color: token.magenta },
    { key: 'arthur', name: 'Arthur', count: stats.owners.arthur, color: token.blue },
    { key: 'shared', name: 'Shared', count: stats.owners.shared, color: token.gold },
  ].filter((owner) => owner.count);
  const topArtist = stats.topArtists[0]?.count ?? 1;
  const topGenre = stats.genres[0]?.count ?? 1;
  const adders = stats.addedBy.arthur + stats.addedBy.marlou;

  if (!stats.cds) {
    return (
      <Shell baseUrl={baseUrl} section="stats">
        <Typography.Title level={2}>Stats</Typography.Title>
        <Typography.Paragraph type="secondary">Nothing to count yet. Add a CD first!</Typography.Paragraph>
      </Shell>
    );
  }

  return (
    <Shell baseUrl={baseUrl} section="stats">
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Stats
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Our shelf in numbers. {stats.wishlist > 0 && `Plus ${plural(stats.wishlist, 'CD')} on the wishlist.`}
      </Typography.Paragraph>

      <Row gutter={[16, 16]}>
        {[
          { title: 'CDs', value: stats.cds, icon: <CustomerServiceOutlined /> },
          { title: 'Artists', value: stats.artists, icon: <TeamOutlined /> },
          { title: 'Hours of music', value: hours(stats.seconds), icon: <ClockCircleOutlined /> },
          { title: 'Songs', value: stats.tracks, icon: <UnorderedListOutlined /> },
        ].map((item) => (
          <Col key={item.title} xs={12} md={6}>
            <Card>
              <Statistic title={item.title} value={item.value} prefix={item.icon} />
            </Card>
          </Col>
        ))}

        <Col xs={24} md={12}>
          <Section title="Whose CDs?">
            <Flex style={{ height: 28, borderRadius: 14, overflow: 'hidden' }}>
              {owners.map((owner) => (
                <Tooltip key={owner.key} title={`${owner.name}: ${owner.count}`}>
                  <a href={`${baseUrl}/collection/?owner=${owner.key}`} style={{ flex: owner.count, background: owner.color }} aria-label={`${owner.name}: ${owner.count}`} />
                </Tooltip>
              ))}
            </Flex>
            <Flex gap={16} wrap style={{ marginTop: 12 }}>
              {owners.map((owner) => (
                <a key={owner.key} href={`${baseUrl}/collection/?owner=${owner.key}`} style={{ color: 'inherit' }}>
                  <Flex gap={6} align="center">
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: owner.color }} />
                    {owner.name} <Typography.Text type="secondary">{owner.count}</Typography.Text>
                  </Flex>
                </a>
              ))}
            </Flex>
            {adders > 0 && (
              <>
                <Typography.Paragraph type="secondary" style={{ margin: '20px 0 8px' }}>
                  Who added the most?
                </Typography.Paragraph>
                <Flex vertical gap={4}>
                  {(['marlou', 'arthur'] as const).map((key) => (
                    <Flex key={key} gap={8} align="center">
                      <span style={{ width: 56 }}>{key === 'arthur' ? 'Arthur' : 'Marlou'}</span>
                      <Progress
                        percent={(stats.addedBy[key] / adders) * 100}
                        format={() => stats.addedBy[key]}
                        status="normal"
                        strokeColor={key === 'arthur' ? token.blue : token.magenta}
                        style={{ flex: 1, margin: 0 }}
                      />
                    </Flex>
                  ))}
                </Flex>
              </>
            )}
          </Section>
        </Col>

        <Col xs={24} md={12}>
          <Section title="Most-collected artists">
            <Flex vertical gap={4}>
              {stats.topArtists.map((artist) => (
                <a key={artist.label} href={search(artist.label)} style={{ color: 'inherit' }}>
                  <Typography.Text ellipsis style={{ display: 'block' }}>
                    {artist.label}
                  </Typography.Text>
                  <Progress percent={(artist.count / topArtist) * 100} format={() => artist.count} status="normal" size="small" style={{ margin: 0 }} />
                </a>
              ))}
            </Flex>
          </Section>
        </Col>

        <Col xs={24} md={12}>
          <Section title="Released in the…">
            <Columns items={stats.decades} label={(item) => `’${item.label.slice(2)}`} tip={(item) => `${item.label}: ${plural(item.count, 'CD')}`} />
          </Section>
        </Col>

        <Col xs={24} md={12}>
          <Section title="Added per month">
            <Columns
              items={stats.months}
              label={(item) => monthName.format(new Date(`${item.label}-01T00:00:00Z`))}
              tip={(item) => `${monthLong.format(new Date(`${item.label}-01T00:00:00Z`))}: ${plural(item.count, 'CD')}`}
            />
          </Section>
        </Col>

        {stats.genres.length > 0 && (
          <Col xs={24}>
            <Section title="Genres">
              <Flex wrap gap={8} align="center">
                {stats.genres.map((genre) => (
                  <a key={genre.label} href={search(genre.label)}>
                    <Tag
                      color={genre.count === topGenre ? 'blue' : undefined}
                      style={{ margin: 0, fontSize: 12 + Math.round((genre.count / topGenre) * 10), lineHeight: 1.6, paddingInline: 10 }}
                    >
                      {genre.label} <Typography.Text type="secondary">{genre.count}</Typography.Text>
                    </Tag>
                  </a>
                ))}
              </Flex>
            </Section>
          </Col>
        )}

        {(stats.oldest || stats.longest) && (
          <Col xs={24}>
            <Section title="Fun facts">
              <Flex vertical gap={8}>
                {stats.oldest && (
                  <Typography.Text>
                    The oldest CD is{' '}
                    <a href={stats.oldest.href}>
                      {stats.oldest.title} by {stats.oldest.artist}
                    </a>
                    , from {stats.oldest.year}.
                  </Typography.Text>
                )}
                {stats.longest && (
                  <Typography.Text>
                    The longest is{' '}
                    <a href={stats.longest.href}>
                      {stats.longest.title} by {stats.longest.artist}
                    </a>
                    , at {minutes(stats.longest.seconds)}.
                  </Typography.Text>
                )}
                {stats.seconds > 0 && (
                  <Typography.Text>
                    Playing everything back to back takes {minutes(stats.seconds)}
                    {stats.seconds > 86_400 && `, that's ${Math.round((stats.seconds / 86_400) * 10) / 10} days`}.
                  </Typography.Text>
                )}
              </Flex>
            </Section>
          </Col>
        )}
      </Row>
    </Shell>
  );
}
