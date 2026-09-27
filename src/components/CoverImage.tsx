import { theme } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';
import type { CoverImage as Cover } from '../lib/albums';

interface Props {
  cover?: Cover;
  alt: string;
  sizes: string;
  eager?: boolean;
  /** Rounded corners from the theme: "lg" for a cover on its own, "sm" for a small thumbnail. Covers inside a Card follow the Card. */
  radius?: 'sm' | 'lg';
  iconSize?: number;
}

export default function CoverImage({ cover, alt, sizes, eager, radius, iconSize = 48 }: Props) {
  const { token } = theme.useToken();
  const box = { width: '100%', aspectRatio: '1', display: 'block', borderRadius: radius === 'lg' ? token.borderRadiusLG : radius === 'sm' ? token.borderRadiusSM : 0 } as const;

  if (!cover) {
    return (
      <div
        // Decorative: the album's title is always shown next to it.
        aria-hidden="true"
        style={{
          ...box,
          display: 'grid',
          placeItems: 'center',
          background: token.colorFillTertiary,
          color: token.colorTextQuaternary,
          fontSize: iconSize,
        }}
      >
        <CustomerServiceOutlined />
      </div>
    );
  }

  return (
    <img
      src={cover.src}
      srcSet={cover.srcSet || undefined}
      sizes={sizes}
      alt={`Cover of ${alt}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ ...box, objectFit: 'cover', background: token.colorFillTertiary }}
    />
  );
}
