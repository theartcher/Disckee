import { Button, message, type ButtonProps } from 'antd';
import { ShareAltOutlined } from '@ant-design/icons';

interface Props extends Pick<ButtonProps, 'type' | 'size' | 'shape'> {
  /** Path on this site, like /Disckee/wishlist/. */
  href: string;
  title: string;
  text?: string;
  label?: string;
}

/** Opens the phone's share sheet, or copies the link where there is none. */
export default function ShareButton({ href, title, text, label, ...button }: Props) {
  const [toast, holder] = message.useMessage();

  const share = async () => {
    const url = new URL(href, location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // Closing the share sheet rejects too; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      void toast.success('Link copied');
    } catch {
      void toast.info(url, 8);
    }
  };

  return (
    <>
      {holder}
      <Button {...button} icon={<ShareAltOutlined />} aria-label={label ? undefined : `Share ${title}`} onClick={share}>
        {label}
      </Button>
    </>
  );
}
