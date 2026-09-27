import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Flex, Form, Image, Input, Radio, Result, Segmented, Spin, Typography, theme } from 'antd';
import { EditOutlined, ScanOutlined, SearchOutlined } from '@ant-design/icons';
import Shell from './Shell';
import Scanner from './Scanner';
import { coverThumbnail, releaseUrl, searchBarcode, searchText, type Candidate } from '../lib/musicbrainz';
import {
  editAlbumUrl,
  findDuplicate,
  newAlbumUrl,
  publishedAlbums,
  recentHandoffs,
  rememberHandoff,
  type Draft,
  type Known,
  type Status,
} from '../lib/handoff';

type Lookup =
  | { state: 'idle' }
  | { state: 'loading'; barcode?: string }
  | { state: 'done'; barcode?: string; candidates: Candidate[] }
  | { state: 'failed'; barcode?: string };

const isBarcode = (text: string) => /^\d{8,14}$/.test(text);

/** The scanned barcode, spelled as on MusicBrainz when it's the same number (a UPC stays 12 digits). */
function pickBarcode(scanned?: string, release?: string) {
  const known = release && isBarcode(release) ? release : undefined;
  if (!scanned) return known;
  return known && known.replace(/^0+/, '') === scanned.replace(/^0+/, '') ? known : scanned;
}

interface Props {
  baseUrl: string;
}

export default function AddPage({ baseUrl }: Props) {
  return (
    <Shell baseUrl={baseUrl} section="add">
      <Flex vertical gap={16} style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Add a CD
          </Typography.Title>
          <Typography.Text type="secondary">
            Scan the barcode on the back, pick the right release, then save it in the editor.
          </Typography.Text>
        </div>
        <Adder baseUrl={baseUrl} />
      </Flex>
    </Shell>
  );
}

function Adder({ baseUrl }: Props) {
  const [status, setStatus] = useState<Status>('collection');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [selected, setSelected] = useState<string>();
  const [known, setKnown] = useState<Known[]>([]);
  const [lastHandoff] = useState(() => recentHandoffs().at(-1));
  const abort = useRef<AbortController>(undefined);

  useEffect(() => {
    void publishedAlbums(baseUrl).then((albums) => setKnown([...albums, ...recentHandoffs()]));
  }, [baseUrl]);

  const run = async (barcode: string | undefined, find: (signal: AbortSignal) => Promise<Candidate[]>) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLookup({ state: 'loading', barcode });
    setSelected(undefined);
    try {
      const candidates = await find(controller.signal);
      if (controller.signal.aborted) return;
      setLookup({ state: 'done', barcode, candidates });
      if (candidates.length === 1) setSelected(candidates[0].id);
    } catch {
      if (!controller.signal.aborted) setLookup({ state: 'failed', barcode });
    }
  };

  const lookUpBarcode = (barcode: string) => run(barcode, (signal) => searchBarcode(barcode, signal));
  const reset = () => {
    abort.current?.abort();
    setLookup({ state: 'idle' });
    setSelected(undefined);
  };

  const barcode = lookup.state === 'idle' ? undefined : lookup.barcode;
  const candidates = lookup.state === 'done' ? lookup.candidates : [];
  const choice = candidates.find((candidate) => candidate.id === selected);
  const draft: Draft | undefined = choice && {
    title: choice.title,
    artist: choice.artist,
    status,
    musicbrainz: choice.id,
    barcode: pickBarcode(barcode, choice.barcode),
  };
  const duplicate = findDuplicate(known, { musicbrainz: choice?.id, barcode });

  return (
    <>
      {lastHandoff && lookup.state === 'idle' && (
        <Alert
          type="info"
          showIcon
          closable
          title="Saved it in the editor?"
          description="Press Publish Changes there and it shows up on the site in a minute or two."
        />
      )}

      <Segmented<Status>
        block
        size="large"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'collection', label: 'We have it' },
          { value: 'wishlist', label: 'We want it' },
        ]}
      />

      {lookup.state === 'idle' ? (
        <>
          <Scanner onDetected={lookUpBarcode} />
          <Input.Search
            size="large"
            inputMode="numeric"
            placeholder="Or type the barcode"
            enterButton="Look up"
            aria-label="Barcode"
            onSearch={(value) => {
              const code = value.replaceAll(/\D/g, '');
              if (isBarcode(code)) void lookUpBarcode(code);
            }}
          />
          <TextSearch onSearch={(artist, title) => run(undefined, (signal) => searchText(artist, title, signal))} />
        </>
      ) : (
        <Button icon={<ScanOutlined />} size="large" onClick={reset}>
          Scan another CD
        </Button>
      )}

      {lookup.state === 'loading' && (
        <Flex justify="center" style={{ padding: 32 }}>
          <Spin size="large" description={barcode ? `Looking up ${barcode}…` : 'Searching MusicBrainz…'}>
            <div style={{ width: 200, height: 40 }} />
          </Spin>
        </Flex>
      )}

      {lookup.state === 'failed' && (
        <Alert
          type="error"
          showIcon
          title="MusicBrainz didn't answer"
          description="Check your connection and try again."
          action={
            <Button onClick={() => (barcode ? void lookUpBarcode(barcode) : reset())}>Try again</Button>
          }
        />
      )}

      {lookup.state === 'done' && candidates.length === 0 && (
        <NotFound baseUrl={baseUrl} barcode={barcode} status={status} onSearch={(artist, title) => run(barcode, (signal) => searchText(artist, title, signal))} />
      )}

      {candidates.length > 0 && (
        <>
          <Typography.Text type="secondary">
            {candidates.length === 1
              ? 'One match on MusicBrainz.'
              : `${candidates.length} releases match. Pick the one that looks like your CD.`}
          </Typography.Text>
          <Radio.Group value={selected} onChange={(event) => setSelected(event.target.value as string)} style={{ width: '100%' }}>
            <Flex vertical gap={8}>
              {candidates.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} selected={candidate.id === selected} />
              ))}
            </Flex>
          </Radio.Group>
        </>
      )}

      {duplicate && (
        <Alert
          type="warning"
          showIcon
          title={duplicate.status === 'wishlist' ? "It's on your wishlist" : 'You already have this'}
          description={
            duplicate.slug
              ? duplicate.status === 'wishlist'
                ? 'Got it? Open it in the editor and set its status to In our collection.'
                : 'It is already in the collection.'
              : 'You added it from this phone in the last hour.'
          }
          action={
            duplicate.slug && (
              <Button href={editAlbumUrl(baseUrl, duplicate.slug)} icon={<EditOutlined />}>
                {duplicate.status === 'wishlist' ? 'Got it' : 'Open'}
              </Button>
            )
          }
        />
      )}

      {draft && (
        <div style={{ position: 'sticky', bottom: 16 }}>
          <Button
            type={duplicate ? 'default' : 'primary'}
            size="large"
            block
            href={newAlbumUrl(baseUrl, draft)}
            onClick={() => rememberHandoff(draft)}
          >
            {duplicate ? 'Add another copy' : status === 'wishlist' ? 'Add to the wishlist' : 'Add to the collection'}
          </Button>
        </div>
      )}
    </>
  );
}

function CandidateCard({ candidate, selected }: { candidate: Candidate; selected: boolean }) {
  const { token } = theme.useToken();
  const details = [
    candidate.date?.slice(0, 4),
    candidate.country,
    candidate.format,
    candidate.tracks && `${candidate.tracks} tracks`,
    [candidate.label, candidate.catalogNumber].filter(Boolean).join(' '),
  ].filter(Boolean);

  return (
    <Card size="small" style={{ borderColor: selected ? token.colorPrimary : undefined }}>
      <Radio value={candidate.id} style={{ width: '100%', alignItems: 'center' }}>
        <Flex gap={12} align="center">
          <Image
            src={coverThumbnail(candidate.id)}
            alt=""
            width={64}
            height={64}
            preview={false}
            style={{ objectFit: 'cover', borderRadius: token.borderRadiusSM }}
            fallback={`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#8884"/></svg>')}`}
          />
          <Flex vertical style={{ minWidth: 0 }}>
            <Typography.Text strong>{candidate.title}</Typography.Text>
            <Typography.Text>{candidate.artist}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {details.join(' · ')}
              {candidate.disambiguation && ` (${candidate.disambiguation})`}
            </Typography.Text>
            <Typography.Link href={releaseUrl(candidate.id)} target="_blank" style={{ fontSize: token.fontSizeSM }}>
              View on MusicBrainz
            </Typography.Link>
          </Flex>
        </Flex>
      </Radio>
    </Card>
  );
}

function TextSearch({ onSearch, initiallyOpen = false }: { onSearch: (artist: string, title: string) => void; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  if (!open) {
    return (
      <Button type="link" icon={<SearchOutlined />} onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start', paddingInline: 0 }}>
        No barcode? Search by artist and title
      </Button>
    );
  }
  return (
    <Form
      layout="vertical"
      onFinish={({ artist, title }: { artist?: string; title?: string }) => onSearch(artist?.trim() ?? '', title?.trim() ?? '')}
    >
      <Form.Item name="artist" label="Artist">
        <Input size="large" autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="title"
        label="Album title"
        rules={[
          ({ getFieldValue }) => ({
            validator: (_, value?: string) =>
              value?.trim() || String(getFieldValue('artist') ?? '').trim()
                ? Promise.resolve()
                : Promise.reject(new Error('Fill in the artist, the title, or both')),
          }),
        ]}
      >
        <Input size="large" autoComplete="off" />
      </Form.Item>
      <Button htmlType="submit" size="large" icon={<SearchOutlined />}>
        Search MusicBrainz
      </Button>
    </Form>
  );
}

function NotFound({
  baseUrl,
  barcode,
  status,
  onSearch,
}: {
  baseUrl: string;
  barcode?: string;
  status: Status;
  onSearch: (artist: string, title: string) => void;
}) {
  const draft: Draft = { status, barcode, coverCredit: 'own-photo' };
  return (
    <Card>
      <Result
        status="info"
        title={barcode ? `MusicBrainz doesn't know barcode ${barcode}` : 'Nothing found on MusicBrainz'}
        subTitle="Search by artist and title instead, or fill it in by hand and add a photo of the cover."
        style={{ padding: 0 }}
      />
      <TextSearch onSearch={onSearch} initiallyOpen />
      <Button
        type="link"
        icon={<EditOutlined />}
        href={newAlbumUrl(baseUrl, draft)}
        onClick={() => rememberHandoff(draft)}
        style={{ paddingInline: 0, marginTop: 16 }}
      >
        Fill it in by hand
      </Button>
    </Card>
  );
}
