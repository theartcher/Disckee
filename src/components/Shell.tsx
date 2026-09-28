import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, ConfigProvider, Flex, Layout, Menu, Tooltip, Typography, message, theme, type ThemeConfig } from 'antd';
import { AimOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import type { Section } from '../lib/albums';

type Mode = 'light' | 'dark';

function initialMode(): Mode {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The hidden Easter-egg theme: Helldivers 2's Super Earth look. Opt-in only, via the Eagle 500kg Bomb
// stratagem (up, right, down, down, down) on the arrow keys, WASD or as swipes, and remembered on this device.
const helldiversKey = 'disckee:helldivers';
type Direction = 'up' | 'down' | 'left' | 'right';
const stratagem: Direction[] = ['up', 'right', 'down', 'down', 'down'];
const keys: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};
// How far a finger has to move before it counts as a swipe.
const swipeMin = 40;

const helldiversTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    // Super Earth yellow on gunmetal.
    colorPrimary: '#ffe81f',
    colorInfo: '#ffe81f',
    colorSuccess: '#ffe81f',
    colorTextHeading: '#ffe81f',
    colorLink: '#ffe81f',
    colorTextBase: '#e8e6df',
    colorBgBase: '#0b0c0e',
    // Text on primary buttons: black on the yellow.
    colorTextLightSolid: '#000',
    borderRadius: 0,
    borderRadiusLG: 0,
    borderRadiusSM: 0,
    borderRadiusXS: 0,
    fontFamily: "Bahnschrift, 'Roboto Condensed', 'Arial Narrow', sans-serif-condensed, system-ui, sans-serif",
  },
};

function initialHelldivers() {
  try {
    return localStorage.getItem(helldiversKey) === 'on';
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
  const [skin, setSkin] = useState(initialHelldivers);
  const [toast, toastHolder] = message.useMessage();

  useEffect(() => {
    document.documentElement.dataset.theme = skin ? 'dark' : mode;
    if (skin) document.documentElement.dataset.skin = 'helldivers';
    else delete document.documentElement.dataset.skin;
  }, [mode, skin]);

  const setHelldivers = useCallback(
    (on: boolean) => {
      setSkin(on);
      try {
        if (on) localStorage.setItem(helldiversKey, 'on');
        else localStorage.removeItem(helldiversKey);
      } catch {}
      void toast.open(
        on
          ? { type: 'success', content: 'Eagle 500kg Bomb inbound. For Super Earth!', icon: <AimOutlined /> }
          : { type: 'info', content: 'Back to normal.' },
      );
    },
    [toast],
  );

  // The stratagem switches the Easter egg on or off. Not while typing, so searching for "wasd" is safe.
  useEffect(() => {
    let at = 0;
    let start: { x: number; y: number } | undefined;
    const typing = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]');
    const enter = (direction: Direction) => {
      at = direction === stratagem[at] ? at + 1 : direction === stratagem[0] ? 1 : 0;
      if (at === stratagem.length) {
        at = 0;
        setHelldivers(!skin);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target)) return;
      const direction = keys[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (direction) enter(direction);
    };
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && !typing(event.target) ? { x: touch.clientX, y: touch.clientY } : undefined;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = undefined;
      // A tap isn't a swipe; it doesn't break the sequence either.
      if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeMin) return;
      // Screen directions: a finger moving up is "up".
      enter(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [skin, setHelldivers]);

  const toggle = () => {
    // In Helldivers mode the button is the way out, back to whatever light/dark was before.
    if (skin) {
      setHelldivers(false);
      return;
    }
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  return (
    <ConfigProvider theme={skin ? helldiversTheme : { algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      {toastHolder}
      <Frame baseUrl={baseUrl} section={section} mode={mode} helldivers={skin} onToggle={toggle}>
        {children}
      </Frame>
    </ConfigProvider>
  );
}

function Frame({
  baseUrl,
  section,
  mode,
  helldivers,
  onToggle,
  children,
}: Props & { mode: Mode; helldivers: boolean; onToggle: () => void }) {
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
          {/* Helldivers' condensed font isn't on every phone; tighter padding keeps the menu on one line anyway. */}
          <ConfigProvider theme={{ components: { Menu: { itemPaddingInline: screens.sm ? 20 : helldivers ? 6 : 10 } } }}>
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
          <Tooltip title={helldivers ? 'Back to normal' : mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <Button
              type="text"
              shape="circle"
              aria-label={helldivers ? 'Switch off Helldivers mode' : mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              icon={helldivers ? <AimOutlined /> : mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={onToggle}
            />
          </Tooltip>
        </Flex>
      </Layout.Header>
      {helldivers && (
        // Hazard stripes under the header, like a Hellpod's landing zone.
        <div
          aria-hidden="true"
          style={{
            position: 'sticky',
            top: 64,
            zIndex: 10,
            height: 6,
            background: `repeating-linear-gradient(-45deg, ${token.colorPrimary} 0 12px, #000 12px 24px)`,
          }}
        />
      )}
      <Layout.Content style={{ padding: '24px 16px 64px' }}>
        <Flex vertical style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          {children}
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
