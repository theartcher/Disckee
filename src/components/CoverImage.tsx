import { theme } from 'antd';
import { CustomerServiceOutlined } from '@ant-design/icons';
import type { CoverImage as Cover } from '../lib/albums';

interface Props {
  cover?: Cover;
  alt: string;
  sizes: string;
  eager?: boolean;
  radius?: number;
}

export default function CoverImage({ cover, alt, sizes, eager, radius = 0 }: Props) {
  const { token } = theme.useToken();
  const box = { width: '100%', aspectRatio: '1', display: 'block', borderRadius: radius } as const;

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
          fontSize: 48,
        }}
      >
        <CustomerServiceOutlined />
      </div>
    );
  }

  return (
    <img
      src={cover.src}
      srcSet={cover.srcSet}
      sizes={sizes}
      alt={`Cover of ${alt}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ ...box, objectFit: 'cover', background: token.colorFillTertiary }}
    />
  );
}
