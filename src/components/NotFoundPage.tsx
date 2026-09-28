import { Button, Result, theme } from 'antd';
import { CustomerServiceOutlined, HomeOutlined } from '@ant-design/icons';
import Shell from './Shell';
import { useRandomPick } from './RandomPick';
import type { AlbumCard } from '../lib/albums';

/** A scratched CD that spins, then skips back, then spins again. */
function SkippingDisc() {
  const { token } = theme.useToken();
  return (
    <>
      <style>{`
        @keyframes disckee-skip {
          0% { transform: rotate(0deg); }
          30% { transform: rotate(200deg); }
          34% { transform: rotate(170deg); }
          38% { transform: rotate(200deg); }
          42% { transform: rotate(170deg); }
          70% { transform: rotate(330deg); }
          100% { transform: rotate(360deg); }
        }
        .disckee-disc { animation: disckee-skip 2.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .disckee-disc { animation: none; } }
      `}</style>
      <svg className="disckee-disc" viewBox="0 0 200 200" width={160} height={160} aria-hidden="true">
        <circle cx="100" cy="100" r="96" fill={token.colorFillSecondary} stroke={token.colorBorder} strokeWidth="2" />
        <circle cx="100" cy="100" r="80" fill="none" stroke={token.colorFillTertiary} strokeWidth="10" />
        <circle cx="100" cy="100" r="58" fill="none" stroke={token.colorFillTertiary} strokeWidth="6" />
        <circle cx="100" cy="100" r="30" fill={token.colorPrimaryBg} stroke={token.colorPrimaryBorder} strokeWidth="2" />
        <circle cx="100" cy="100" r="8" fill={token.colorBgLayout} stroke={token.colorBorder} strokeWidth="2" />
        {/* The scratch. */}
        <path d="M 138 40 q 14 22 30 30 M 146 36 q 10 18 26 26" fill="none" stroke={token.colorError} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </>
  );
}

/** The 404 page: GitHub Pages shows it for any address that isn't on the site. */
export default function NotFoundPage({ baseUrl, albums }: { baseUrl: string; albums: AlbumCard[] }) {
  const pick = useRandomPick(albums);
  return (
    <Shell baseUrl={baseUrl} section="home">
      <Result
        icon={<SkippingDisc />}
        title="This track skips"
        subTitle="There's nothing at this address. Maybe the link has a scratch in it."
        extra={[
          <Button key="home" href={`${baseUrl}/`} icon={<HomeOutlined />}>
            Home
          </Button>,
          <Button key="pick" type="primary" icon={<CustomerServiceOutlined />} onClick={pick.draw} disabled={!albums.length}>
            Pick a CD instead
          </Button>,
        ]}
      />
      {pick.picker}
    </Shell>
  );
}
