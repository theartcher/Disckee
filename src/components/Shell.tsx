import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ConfigProvider, Flex, Layout, Menu, Tooltip, Typography, message, theme, type ThemeConfig } from 'antd';
import { MoonOutlined, SunOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Section } from '../lib/albums';

type Mode = 'light' | 'dark';

function initialMode(): Mode {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The hidden Easter-egg theme: Winamp 2 on a 2003 desktop. Opt-in only, via the Konami code or
// seven quick taps on the light/dark button, and remembered on this device.
const winampKey = 'disckee:winamp';
const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const tapsNeeded = 7;
const tapWindow = 2500;

const winampTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#00e000',
    colorInfo: '#00e000',
    colorLink: '#00e000',
    colorTextBase: '#00e000',
    colorBgBase: '#101018',
    // Text on primary buttons: black on the green, like the play button's LCD.
    colorTextLightSolid: '#000',
    borderRadius: 0,
    borderRadiusLG: 0,
    borderRadiusSM: 0,
    borderRadiusXS: 0,
    fontFamily: "'Courier New', ui-monospace, monospace",
    // Monospace runs wide: one size down keeps the phone header on one line.
    fontSize: 13,
  },
};

function initialWinamp() {
  try {
    return localStorage.getItem(winampKey) === 'on';
  } catch {
    return false;
  }
}

interface Props {
  baseUrl: string;
  section: Section | 'home' | 'add' | 'suggestions' | 'manage' | 'stats';
  children: ReactNode;
}

/**
 * Whether the window is at least antd's "sm" breakpoint. Read synchronously, unlike Grid.useBreakpoint(),
 * which is empty on the first render and made the desktop header start in its phone layout.
 */
function useWide() {
  const query = '(min-width: 576px)';
  const [wide, setWide] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setWide(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return wide;
}

/** Page frame: Ant Design theme (light/dark), header with nav and theme toggle. */
export default function Shell({ baseUrl, section, children }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [skin, setSkin] = useState(initialWinamp);
  const [toast, toastHolder] = message.useMessage();
  const taps = useRef<number[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = skin ? 'dark' : mode;
    if (skin) document.documentElement.dataset.skin = 'winamp';
    else delete document.documentElement.dataset.skin;
  }, [mode, skin]);

  const setWinamp = useCallback(
    (on: boolean) => {
      setSkin(on);
      try {
        if (on) localStorage.setItem(winampKey, 'on');
        else localStorage.removeItem(winampKey);
      } catch {}
      void toast.open(
        on
          ? { type: 'success', content: 'Winamp mode. It really whips the llama’s ass.', icon: <ThunderboltOutlined /> }
          : { type: 'info', content: 'Back to normal.' },
      );
    },
    [toast],
  );

  // The Konami code switches the Easter egg on or off. Not while typing, so searching for "ba" is safe.
  useEffect(() => {
    let at = 0;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      at = key === konami[at] ? at + 1 : key === konami[0] ? 1 : 0;
      if (at === konami.length) {
        at = 0;
        setWinamp(!skin);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skin, setWinamp]);

  const toggle = () => {
    // In Winamp mode the button is the way out, back to whatever light/dark was before.
    if (skin) {
      setWinamp(false);
      return;
    }
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < tapWindow), now];
    if (taps.current.length >= tapsNeeded) {
      taps.current = [];
      setWinamp(true);
      return;
    }
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  return (
    <ConfigProvider theme={skin ? winampTheme : { algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      {toastHolder}
      <Frame baseUrl={baseUrl} section={section} mode={mode} winamp={skin} onToggle={toggle}>
        {children}
      </Frame>
    </ConfigProvider>
  );
}

function Frame({
  baseUrl,
  section,
  mode,
  winamp,
  onToggle,
  children,
}: Props & { mode: Mode; winamp: boolean; onToggle: () => void }) {
  const { token } = theme.useToken();
  const screens = { sm: useWide() };
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
          {/* Winamp's monospace font runs wider, so its phone menu gets tighter padding to stay on one line. */}
          <ConfigProvider theme={{ components: { Menu: { itemPaddingInline: screens.sm ? 20 : winamp ? 6 : 10 } } }}>
            <Menu
              mode="horizontal"
              disabledOverflow={!screens.sm}
              selectedKeys={[owners ? 'admin' : section]}
              style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent' }}
              items={[
                { key: 'collection', label: <a href={`${baseUrl}/collection/`}>Collection</a> },
                { key: 'wishlist', label: <a href={`${baseUrl}/wishlist/`}>Wishlist</a> },
                { key: 'stats', label: <a href={`${baseUrl}/stats/`}>Stats</a> },
                // The owners' tools: adding CDs, suggestions, editing.
                { key: 'admin', label: <a href={`${baseUrl}/manage/`}>Admin</a> },
              ]}
            />
          </ConfigProvider>
          <Tooltip title={winamp ? 'Back to normal' : mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <Button
              type="text"
              shape="circle"
              aria-label={winamp ? 'Switch off Winamp mode' : mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              icon={winamp ? <ThunderboltOutlined /> : mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
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
