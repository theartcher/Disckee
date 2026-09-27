import { useEffect, useState, type ReactNode } from 'react';
import { Button, ConfigProvider, Flex, Grid, Layout, Menu, Tooltip, Typography, theme } from 'antd';
import { MoonOutlined, SettingOutlined, SunOutlined } from '@ant-design/icons';
import type { Section } from '../lib/albums';

type Mode = 'light' | 'dark';

function initialMode(): Mode {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface Props {
  baseUrl: string;
  section: Section | 'home' | 'add' | 'suggestions' | 'manage' | 'stats';
  children: ReactNode;
}

/** Page frame: Ant Design theme (light/dark), header with nav and theme toggle. */
export default function Shell({ baseUrl, section, children }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  return (
    <ConfigProvider theme={{ algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Frame baseUrl={baseUrl} section={section} mode={mode} onToggle={toggle}>
        {children}
      </Frame>
    </ConfigProvider>
  );
}

function Frame({
  baseUrl,
  section,
  mode,
  onToggle,
  children,
}: Props & { mode: Mode; onToggle: () => void }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const owners = section === 'add' || section === 'suggestions' || section === 'manage';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          paddingInline: 16,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Flex align="center" gap={8} style={{ maxWidth: 1100, height: '100%', margin: '0 auto' }}>
          {/* On a phone the app icon stands in for the name, so the whole nav fits. */}
          <Typography.Link
            href={`${baseUrl}/`}
            strong
            aria-label="Disckee home"
            style={{ display: 'flex', fontSize: 18, color: token.colorText, marginRight: screens.sm ? 8 : 0 }}
          >
            {screens.sm ? 'Disckee' : <img src={`${baseUrl}/icons/icon-192.png`} alt="" width={28} height={28} style={{ borderRadius: 6 }} />}
          </Typography.Link>
          <ConfigProvider theme={{ components: { Menu: { itemPaddingInline: screens.sm ? 20 : 10 } } }}>
            <Menu
              mode="horizontal"
              disabledOverflow={!screens.sm}
              selectedKeys={[section]}
              style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent' }}
              items={[
                { key: 'collection', label: <a href={`${baseUrl}/collection/`}>Collection</a> },
                { key: 'wishlist', label: <a href={`${baseUrl}/wishlist/`}>Wishlist</a> },
                { key: 'stats', label: <a href={`${baseUrl}/stats/`}>Stats</a> },
              ]}
            />
          </ConfigProvider>
          {/* The owners' tools live on one panel page, so the nav still fits on a phone. */}
          <Tooltip title="Owners' panel">
            <Button
              type={owners ? 'primary' : 'text'}
              ghost={owners}
              shape="circle"
              aria-label="Owners' panel"
              href={`${baseUrl}/manage/`}
              icon={<SettingOutlined />}
            />
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <Button
              type="text"
              shape="circle"
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={onToggle}
            />
          </Tooltip>
        </Flex>
      </Layout.Header>
      <Layout.Content style={{ padding: '24px 16px 64px' }}>
        <Flex vertical style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          {children}
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
