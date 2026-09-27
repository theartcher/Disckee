import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Collapse, Descriptions, Flex, Form, Image, Input, Radio, Segmented, Spin, Tag, Typography, theme } from 'antd';
import { EditOutlined, ScanOutlined, SearchOutlined } from '@ant-design/icons';
import Shell from './Shell';
import Scanner from './Scanner';
import { coverThumbnail, lookUpRelease, releaseUrl, searchBarcode, searchText, type Candidate } from '../lib/musicbrainz';
import {
  frontCover500,
  releaseGenres,
  releaseLabel,
  releaseTracklist,
  releaseYear,
  type Release,
  type Track,
} from '../lib/release';
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

/** What was typed into the artist/title search, kept so a retry doesn't start over. */
interface Query {
  artist: string;
  title: string;
}

type Lookup =
  | { state: 'idle' }
  | { state: 'loading'; barcode?: string; query?: Query }
  | { state: 'done'; barcode?: string; query?: Query; candidates: Candidate[] }
  | { state: 'failed'; barcode?: string; query?: Query };

/** The picked release's full details, fetched once it's selected. */
interface Details {
  id: string;
  release?: Release;
  failed?: boolean;
}

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
  const { token } = theme.useToken();
  const [status, setStatus] = useState<Status>('collection');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [selected, setSelected] = useState<string>();
  const [known, setKnown] = useState<Known[]>([]);
  const [lastHandoff] = useState(() => recentHandoffs().at(-1));
  const [details, setDetails] = useState<Details>();
  const abort = useRef<AbortController>(undefined);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    lookUpRelease(selected, controller.signal).then(
      (release) => setDetails({ id: selected, release }),
      () => {
        // Without the details, the basics from the search result are still prefilled.
        if (!controller.signal.aborted) setDetails({ id: selected, failed: true });
      },
    );
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    void publishedAlbums(baseUrl).then((albums) => setKnown([...albums, ...recentHandoffs()]));
  }, [baseUrl]);

  const run = async (
    barcode: string | undefined,
    query: Query | undefined,
    find: (signal: AbortSignal) => Promise<Candidate[]>,
  ) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLookup({ state: 'loading', barcode, query });
    setSelected(undefined);
    try {
      const candidates = await find(controller.signal);
      if (controller.signal.aborted) return;
      setLookup({ state: 'done', barcode, query, candidates });
      if (candidates.length === 1) setSelected(candidates[0].id);
    } catch {
      if (!controller.signal.aborted) setLookup({ state: 'failed', barcode, query });
    }
  };

  const lookUpBarcode = (barcode: string) => run(barcode, undefined, (signal) => searchBarcode(barcode, signal));
  // Keeps the scanned barcode (if any) so it still ends up on the album.
  const lookUpText = (barcode: string | undefined) => (query: Query) =>
    run(barcode, query, (signal) => searchText(query.artist, query.title, signal));
  const reset = () => {
    abort.current?.abort();
    setLookup({ state: 'idle' });
    setSelected(undefined);
  };

  const barcode = lookup.state === 'idle' ? undefined : lookup.barcode;
  const query = lookup.state === 'idle' ? undefined : lookup.query;
  const candidates = lookup.state === 'done' ? lookup.candidates : [];
  const choice = candidates.find((candidate) => candidate.id === selected);
  const current = details?.id === selected ? details : undefined;
  const release = current?.release;
  const hasCover = !!release?.['cover-art-archive']?.front;
  const draft: Draft | undefined = choice && {
    title: choice.title,
    artist: choice.artist,
    status,
    musicbrainz: choice.id,
    barcode: pickBarcode(barcode, choice.barcode),
    ...(release && {
      year: releaseYear(release),
      genres: releaseGenres(release),
      label: releaseLabel(release),
      ...(hasCover && { cover: frontCover500(choice.id), coverCredit: 'cover-art-archive' as const }),
    }),
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
          <TextSearch onSearch={lookUpText(undefined)} />
          <ByHand baseUrl={baseUrl} status={status} />
        </>
      ) : (
        <Button icon={<ScanOutlined />} size="large" onClick={reset}>
          Scan another CD
        </Button>
      )}

      {lookup.state === 'loading' && (
        <Flex justify="center" style={{ padding: 32 }}>
          <Spin size="large" description={query || !barcode ? 'Searching MusicBrainz…' : `Looking up ${barcode}…`}>
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
            <Button
              onClick={() => {
                if (query) void lookUpText(barcode)(query);
                else if (barcode) void lookUpBarcode(barcode);
                else reset();
              }}
            >
              Try again
            </Button>
          }
        />
      )}

      {lookup.state === 'done' && candidates.length === 0 && (
        <NotFound baseUrl={baseUrl} barcode={barcode} query={query} status={status} onSearch={lookUpText(barcode)} />
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
          <ByHand baseUrl={baseUrl} status={status} barcode={barcode} query={query} label="None of these? Fill it in by hand" />
        </>
      )}

      {choice && release && <ReleaseDetails id={choice.id} release={release} hasCover={hasCover} />}

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
        // Stays in reach at the bottom of the screen, clear of the iPhone home bar.
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            marginTop: 8,
            paddingTop: 12,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            background: token.colorBgLayout,
          }}
        >
          <Button
            type={duplicate ? 'default' : 'primary'}
            size="large"
            block
            href={newAlbumUrl(baseUrl, draft)}
            onClick={() => rememberHandoff(draft)}
            loading={!current}
          >
            {duplicate ? 'Add another copy' : status === 'wishlist' ? 'Add to the wishlist' : 'Add to the collection'}
          </Button>
        </div>
      )}
    </>
  );
}

const placeholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#8884"/></svg>')}`;

/** What will be filled in, so it can be checked before opening the editor. */
function ReleaseDetails({ id, release, hasCover }: { id: string; release: Release; hasCover: boolean }) {
  const { token } = theme.useToken();
  const year = releaseYear(release);
  const genres = releaseGenres(release);
  const label = releaseLabel(release);
  const tracks = releaseTracklist(release);

  return (
    <Card size="small" title="This gets filled in">
      <Flex gap={16} wrap>
        {hasCover && (
          <Image
            src={frontCover500(id)}
            alt="Front cover"
            width={120}
            height={120}
            style={{ objectFit: 'cover', borderRadius: token.borderRadiusSM }}
            fallback={placeholder}
          />
        )}
        <Descriptions
          size="small"
          column={1}
          style={{ flex: 1, minWidth: 180 }}
          items={[
            { key: 'year', label: 'Year', children: year ?? '–' },
            {
              key: 'genres',
              label: 'Genres',
              children: genres.length ? (
                <Flex wrap gap={4}>
                  {genres.map((genre) => (
                    <Tag key={genre} style={{ marginInlineEnd: 0 }}>
                      {genre}
                    </Tag>
                  ))}
                </Flex>
              ) : (
                '–'
              ),
            },
            { key: 'label', label: 'Label', children: label ?? '–' },
            { key: 'cover', label: 'Cover', children: hasCover ? 'From Cover Art Archive' : 'None found, add a photo' },
          ]}
        />
      </Flex>
      {tracks.length > 0 && (
        <Collapse
          ghost
          size="small"
          style={{ marginTop: 8 }}
          items={[
            {
              key: 'tracks',
              label: `Tracklist, ${tracks.length} tracks (added when you publish)`,
              children: <Tracklist tracks={tracks} />,
            },
          ]}
        />
      )}
    </Card>
  );
}

function Tracklist({ tracks }: { tracks: Track[] }) {
  return (
    <Flex vertical gap={2}>
      {tracks.map((track) => (
        <Flex key={track.position} gap={8}>
          <Typography.Text type="secondary" style={{ minWidth: 32 }}>
            {track.position}
          </Typography.Text>
          <Typography.Text style={{ flex: 1 }}>{track.title}</Typography.Text>
          {track.duration && <Typography.Text type="secondary">{track.duration}</Typography.Text>}
        </Flex>
      ))}
    </Flex>
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
            fallback={placeholder}
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

function TextSearch({
  onSearch,
  initialValues,
  initiallyOpen = false,
}: {
  onSearch: (query: Query) => void;
  initialValues?: Query;
  initiallyOpen?: boolean;
}) {
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
      initialValues={initialValues}
      onFinish={({ artist, title }: { artist?: string; title?: string }) =>
        onSearch({ artist: artist?.trim() ?? '', title: title?.trim() ?? '' })
      }
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

/** Opens the editor without a MusicBrainz match, keeping whatever was scanned or typed. */
function ByHand({
  baseUrl,
  status,
  barcode,
  query,
  label = 'Fill it in by hand',
}: {
  baseUrl: string;
  status: Status;
  barcode?: string;
  query?: Query;
  label?: string;
}) {
  const draft: Draft = {
    status,
    barcode,
    artist: query?.artist || undefined,
    title: query?.title || undefined,
    coverCredit: 'own-photo',
  };
  return (
    <Button size="large" block icon={<EditOutlined />} href={newAlbumUrl(baseUrl, draft)} onClick={() => rememberHandoff(draft)}>
      {label}
    </Button>
  );
}

function NotFound({
  baseUrl,
  barcode,
  query,
  status,
  onSearch,
}: {
  baseUrl: string;
  barcode?: string;
  query?: Query;
  status: Status;
  onSearch: (query: Query) => void;
}) {
  const searched = query && [query.artist, query.title].filter(Boolean).join(' – ');
  return (
    <Card>
      <Alert
        type="warning"
        showIcon
        title={searched ? `No CDs found for “${searched}”` : `No CDs found for barcode ${barcode}`}
        description={
          searched
            ? 'Check the spelling, or leave out words you are unsure of. Or fill it in by hand and add a photo of the cover.'
            : 'Search by artist and title instead, or fill it in by hand and add a photo of the cover.'
        }
        style={{ marginBottom: 16 }}
      />
      {barcode && searched && (
        <Typography.Paragraph type="secondary">Barcode {barcode} will still be saved with the album.</Typography.Paragraph>
      )}
      <TextSearch onSearch={onSearch} initialValues={query} initiallyOpen />
      <div style={{ marginTop: 16 }}>
        <ByHand baseUrl={baseUrl} status={status} barcode={barcode} query={query} />
      </div>
    </Card>
  );
}
