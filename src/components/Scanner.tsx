import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Flex, Spin, theme } from 'antd';
import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import { BarcodeDetector as ZXingDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
// Served from our own site instead of the jsDelivr CDN the library uses by default.
import zxingWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';

const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

/** The browser's own detector where it reads CD barcodes (Android Chrome), ZXing WASM elsewhere (iPhone). */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: typeof ZXingDetector }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      if (formats.every((format) => supported.includes(format))) return new Native({ formats: [...formats] });
    } catch {}
  }
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingWasm : prefix + path) },
  });
  return new ZXingDetector({ formats: [...formats] });
}

interface Props {
  onDetected: (barcode: string) => void;
}

/** Rear camera with a barcode frame. Calls onDetected once per new code it reads. */
export default function Scanner({ onDetected }: Props) {
  const { token } = theme.useToken();
  const video = useRef<HTMLVideoElement>(null);
  const [track, setTrack] = useState<MediaStreamTrack>();
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(true);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let last = '';

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setTrack(stream.getVideoTracks()[0]);
        const detector = await createDetector();
        setStarting(false);

        const tick = async () => {
          if (stopped) return;
          const element = video.current;
          if (element && element.readyState >= 2) {
            try {
              const [code] = await detector.detect(element);
              if (code && code.rawValue !== last) {
                last = code.rawValue;
                navigator.vibrate?.(60);
                onDetectedRef.current(code.rawValue);
              }
            } catch {}
          }
          timer = setTimeout(tick, 200);
        };
        void tick();
      } catch (reason) {
        setStarting(false);
        const name = reason instanceof DOMException ? reason.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the barcode below.'
            : 'No camera available here. Type the barcode below instead.',
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // The phone's flashlight, where the browser exposes it (Android Chrome).
  const canTorch = Boolean((track?.getCapabilities?.() as { torch?: boolean } | undefined)?.torch);
  const toggleTorch = async () => {
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {}
  };

  if (error) return <Alert type="warning" showIcon title={error} />;

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '4 / 3',
        maxHeight: '55vh',
        width: '100%',
        overflow: 'hidden',
        borderRadius: token.borderRadiusLG,
        background: '#000',
      }}
    >
      <video
        ref={video}
        muted
        playsInline
        aria-label="Camera view for scanning the barcode"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '30% 12%',
          border: `3px solid ${token.colorPrimary}`,
          borderRadius: token.borderRadius,
          boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.35)',
        }}
      />
      {starting && (
        <Flex align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
          <Spin size="large" />
        </Flex>
      )}
      {canTorch && (
        <Button
          shape="circle"
          size="large"
          aria-label={torch ? 'Turn the light off' : 'Turn the light on'}
          icon={torch ? <BulbFilled /> : <BulbOutlined />}
          onClick={toggleTorch}
          style={{ position: 'absolute', right: 12, bottom: 12 }}
        />
      )}
    </div>
  );
}
