import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Page-level buttons, like Share or "What should we play?". Sit to the right of the title. */
  actions?: ReactNode;
  /** A breadcrumb or back link above the title. */
  above?: ReactNode;
}

/** The title block every page starts with, so titles, subtitles and page actions line up the same everywhere. */
export default function PageHeader({ title, subtitle, actions, above }: Props) {
  return (
    <header style={{ marginBottom: 24 }}>
      {above && <div style={{ marginBottom: 12 }}>{above}</div>}
      {/* Actions share the title's row, so they stay beside it on a phone instead of dropping under the subtitle. */}
      <Flex align="center" justify="space-between" gap={12}>
        <Typography.Title level={2} style={{ margin: 0, minWidth: 0 }}>
          {title}
        </Typography.Title>
        {actions && (
          <Flex gap={8} style={{ flex: 'none' }}>
            {actions}
          </Flex>
        )}
      </Flex>
      {subtitle && (
        <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          {subtitle}
        </Typography.Paragraph>
      )}
    </header>
  );
}

/** A heading for a section within a page: "Latest additions", "All albums", "More from …". */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography.Title level={4} style={{ margin: '0 0 12px' }}>
      {children}
    </Typography.Title>
  );
}
