import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Card, Collapse, Flex, Form, Image, Input, Radio, Spin, Steps, Tag, Typography, theme } from 'antd';
import { CheckCircleOutlined, EditOutlined, HeartOutlined, LinkOutlined, ScanOutlined, SearchOutlined } from '@ant-design/icons';
import Shell from './Shell';
import PageHeader, { SectionTitle } from './PageHeader';
import { AdminCrumb } from './ManagePage';
import Scanner from './Scanner';
import {
  coverThumbnail,
  findRelease,
  lookUpRelease,
  releaseIdFrom,
  releaseUrl,
  searchBarcode,
  searchText,
  type Candidate,
} from '../lib/musicbrainz';
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
  type Duplicate,
  type Known,
  type Status,
} from '../lib/handoff';

/** What was typed into the artist/title search, kept so a retry doesn't start over. */
interface Query {
  artist: string;
  title: string;
}

/** How the CD is found, picked in the second step. */
type Method = 'scan' | 'text' | 'id';

/** What a lookup went by: a scanned barcode, typed artist/title, or a pasted release id. */
interface Search {
  barcode?: string;
  query?: Query;
  releaseId?: string;
}

type Lookup =
  | { state: 'idle' }
  | ({ state: 'loading' } & Search)
  | ({ state: 'done'; candidates: Candidate[] } & Search)
  | ({ state: 'failed' } & Search);

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
      <div style={{ maxWidth: 640, width: '100%', margin: '0 auto' }}>
        <PageHeader
          above={<AdminCrumb baseUrl={baseUrl} page="Add a CD" />}
          title="Add a CD"
          subtitle="Scan the barcode on the back, pick the right release, then save it in the editor."
        />
        <Flex vertical gap={16}>
          <Adder baseUrl={baseUrl} />
        </Flex>
      </div>
    </Shell>
  );
}

function Adder({ baseUrl }: Props) {
  const { token } = theme.useToken();
  const [status, setStatus] = useState<Status>('collection');
  const [method, setMethod] = useState<Method>('scan');
  // 0: where it goes, 1: how to find it, 2: find it and add it.
  const [step, setStep] = useState(0);
  // The furthest step reached, so the steps can be tapped forward again too.
  const [reached, setReached] = useState(0);
  // A barcode that was scanned but not found, kept when going back to try another way.
  const [carried, setCarried] = useState<string>();
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [selected, setSelected] = useState<string>();
  const [known, setKnown] = useState<Known[]>([]);
  const [lastHandoff] = useState(() => recentHandoffs().at(-1));
  const [details, setDetails] = useState<Details>();
  const abort = useRef<AbortController>(undefined);
  const results = useRef<HTMLDivElement>(null);

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

  const run = async (search: Search, find: (signal: AbortSignal) => Promise<Candidate[]>) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLookup({ state: 'loading', ...search });
    setSelected(undefined);
    try {
      const candidates = await find(controller.signal);
      if (controller.signal.aborted) return;
      setLookup({ state: 'done', ...search, candidates });
      if (candidates.length === 1) setSelected(candidates[0].id);
    } catch {
      if (!controller.signal.aborted) setLookup({ state: 'failed', ...search });
    }
  };

  const lookUpBarcode = (barcode: string) => run({ barcode }, (signal) => searchBarcode(barcode, signal));
  // Keeps the scanned barcode (if any) so it still ends up on the album.
  const lookUpText = (barcode: string | undefined) => (query: Query) =>
    run({ barcode, query }, (signal) => searchText(query.artist, query.title, signal));
  const lookUpId = (barcode: string | undefined) => (releaseId: string) =>
    run({ barcode, releaseId }, (signal) => findRelease(releaseId, signal));
  // Picking from far down a long list folds it, so bring the picked release into view.
  const pick = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => results.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const reset = () => {
    abort.current?.abort();
    setLookup({ state: 'idle' });
    setSelected(undefined);
    setCarried(undefined);
  };
  const goTo = (next: number) => {
    const keep = (lookup.state === 'idle' ? undefined : lookup.barcode) ?? carried;
    reset();
    setCarried(keep);
    setStep(next);
    setReached((furthest) => Math.max(furthest, next));
  };
  const pickStatus = (next: Status) => {
    setStatus(next);
    goTo(1);
  };
  const pickMethod = (next: Method) => {
    setMethod(next);
    goTo(2);
  };

  const barcode = lookup.state === 'idle' ? undefined : lookup.barcode;
  const query = lookup.state === 'idle' ? undefined : lookup.query;
  const releaseId = lookup.state === 'idle' ? undefined : lookup.releaseId;
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
  const duplicate = findDuplicate(known, { musicbrainz: choice?.id, barcode }, { artist: choice?.artist, title: choice?.title });
  // A CD from the wishlist arrived: move that entry over instead of adding a second one.
  const gotIt = duplicate?.album.slug && duplicate.album.status === 'wishlist' && status === 'collection' ? duplicate.album.slug : undefined;

  return (
    <>
      <Steps
        current={step}
        size="small"
        responsive={false}
        titlePlacement="vertical"
        // Any step already reached can be tapped, back or forward.
        onChange={(next) => next !== step && next <= reached && goTo(next)}
        items={[
          { title: 'Where', content: reached > 0 ? statusLabels[status] : undefined },
          { title: 'How', content: reached > 1 ? methodLabels[method].short : undefined, disabled: reached < 1 },
          { title: 'Find it', disabled: reached < 2 },
        ]}
      />

      {step === 0 && (
        <>
          {lastHandoff && (
            <Alert
              type="info"
              showIcon
              closable
              title="Saved it in the editor?"
              description="Press Publish Changes there and it shows up on the site in a minute or two."
            />
          )}
          <SectionTitle>Where does it go?</SectionTitle>
          <Flex vertical gap={12}>
            {(['collection', 'wishlist'] as const).map((option) => (
              <Button
                key={option}
                size="large"
                block
                type={option === status ? 'primary' : 'default'}
                icon={option === 'collection' ? <CheckCircleOutlined /> : <HeartOutlined />}
                onClick={() => pickStatus(option)}
              >
                {option === 'collection' ? 'Add to collection' : 'Add to wishlist'}
              </Button>
            ))}
          </Flex>
        </>
      )}

      {step === 1 && (
        <>
          <SectionTitle>How do you want to find it?</SectionTitle>
          <Flex vertical gap={12}>
            {(['scan', 'text', 'id'] as const).map((option) => (
              <Button
                key={option}
                size="large"
                block
                type={option === method ? 'primary' : 'default'}
                icon={methodLabels[option].icon}
                onClick={() => pickMethod(option)}
              >
                {methodLabels[option].long}
              </Button>
            ))}
            {/* Straight to the editor, for a CD MusicBrainz doesn't have. */}
            <ByHand baseUrl={baseUrl} status={status} barcode={carried} />
          </Flex>
          {carried && <Typography.Text type="secondary">Barcode {carried} will still be saved with the album.</Typography.Text>}
        </>
      )}

      {step === 2 && lookup.state === 'idle' && (
        <>
          {method === 'scan' && (
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
            </>
          )}
          {method === 'text' && <TextSearch onSearch={lookUpText(carried)} />}
          {method === 'id' && <IdSearch onSearch={lookUpId(carried)} />}
          {carried && <Typography.Text type="secondary">Barcode {carried} will still be saved with the album.</Typography.Text>}
        </>
      )}

      {/* Starts over in this step. A search that found nothing keeps its form below instead. */}
      {step === 2 && lookup.state !== 'idle' && candidates.length > 0 && (
        <Button icon={method === 'scan' ? <ScanOutlined /> : <SearchOutlined />} size="large" onClick={reset}>
          {method === 'scan' ? 'Scan another CD' : 'New search'}
        </Button>
      )}

      {lookup.state === 'loading' && (
        <Flex justify="center" style={{ padding: 32 }}>
          <Spin size="large" description={query || releaseId || !barcode ? 'Searching MusicBrainz…' : `Looking up ${barcode}…`}>
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
                if (releaseId) void lookUpId(barcode)(releaseId);
                else if (query) void lookUpText(barcode)(query);
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
        <NotFound
          barcode={barcode}
          query={query}
          releaseId={releaseId}
          method={method}
          onSearch={lookUpText(barcode)}
          onIdSearch={lookUpId(barcode)}
          onOtherWay={() => goTo(1)}
        />
      )}

      {/* Nothing found for a scan: scanning the next CD is the likely next step. */}
      {lookup.state === 'done' && candidates.length === 0 && method === 'scan' && (
        <Button type="primary" icon={<ScanOutlined />} size="large" block onClick={reset}>
          Scan another CD
        </Button>
      )}

      {candidates.length > 0 && (
        // A long list of pressings until one is picked, then just that one,
        // so the warning and the button are in reach without scrolling.
        <div ref={results} style={{ scrollMarginTop: 96 }}>
          {choice ? (
            <PickedRelease
              candidate={choice}
              release={release}
              loading={!current}
              hasCover={hasCover}
              others={candidates.length - 1}
              onChange={() => setSelected(undefined)}
            />
          ) : (
            <Flex vertical gap={8}>
              <Typography.Text type="secondary">{candidates.length} releases match. Pick the one that looks like your CD.</Typography.Text>
              <Card size="small" styles={{ body: { padding: 0 } }}>
                <Radio.Group value={selected} onChange={(event) => pick(event.target.value as string)} style={{ width: '100%' }}>
                  {candidates.map((candidate, index) => (
                    <CandidateRow key={candidate.id} candidate={candidate} first={index === 0} />
                  ))}
                </Radio.Group>
              </Card>
            </Flex>
          )}
        </div>
      )}

      {duplicate && <DuplicateAlert duplicate={duplicate} adding={status} baseUrl={baseUrl} />}

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
          {gotIt ? (
            <Flex vertical gap={8}>
              <Button type="primary" size="large" block href={editAlbumUrl(baseUrl, gotIt)} icon={<CheckCircleOutlined />}>
                Got it
              </Button>
              <Button type="text" block href={newAlbumUrl(baseUrl, draft)} onClick={() => rememberHandoff(draft)} loading={!current}>
                Add as a new CD instead
              </Button>
            </Flex>
          ) : (
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
          )}
        </div>
      )}
    </>
  );
}

const placeholder = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#8884"/></svg>')}`;

const yearOf = (date?: string) => date?.slice(0, 4);

/**
 * The picked release, as it will go into the editor: one card with the
 * cover, the details that get filled in and the tracklist folded away.
 */
function PickedRelease({
  candidate,
  release,
  loading,
  hasCover,
  others,
  onChange,
}: {
  candidate: Candidate;
  release?: Release;
  loading: boolean;
  hasCover: boolean;
  others: number;
  onChange: () => void;
}) {
  const { token } = theme.useToken();
  const genres = release ? releaseGenres(release) : [];
  const tracks = release ? releaseTracklist(release) : [];
  const facts = [
    (release && releaseYear(release)) ?? yearOf(candidate.date),
    (release && releaseLabel(release)) ?? candidate.label,
    candidate.country,
    candidate.format,
    candidate.tracks && `${candidate.tracks} tracks`,
  ].filter(Boolean);

  return (
    <Card size="small">
      <Flex gap={16} align="start">
        <div style={{ width: 96, flexShrink: 0 }}>
          <Image
            src={hasCover ? frontCover500(candidate.id) : coverThumbnail(candidate.id)}
            alt="Front cover"
            width={96}
            height={96}
            preview={hasCover}
            style={{ objectFit: 'cover' }}
            fallback={placeholder}
          />
        </div>
        <Flex vertical gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
            {candidate.title}
          </Typography.Text>
          <Typography.Text>{candidate.artist}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {facts.join(' · ')}
            {candidate.disambiguation && ` (${candidate.disambiguation})`}
          </Typography.Text>
          {genres.length > 0 && (
            <Flex wrap gap={4}>
              {genres.map((genre) => (
                <Tag key={genre} variant="outlined" style={{ marginInlineEnd: 0 }}>
                  {genre}
                </Tag>
              ))}
            </Flex>
          )}
        </Flex>
      </Flex>
      {loading ? (
        <Flex justify="center" style={{ paddingTop: 12 }}>
          <Spin size="small" />
        </Flex>
      ) : (
        tracks.length > 0 && (
          <Collapse
            ghost
            size="small"
            style={{ marginTop: 8 }}
            items={[{ key: 'tracks', label: `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}, added when you publish`, children: <Tracklist tracks={tracks} /> }]}
          />
        )
      )}
      <Flex wrap gap={8} justify="space-between" align="center" style={{ marginTop: 8 }}>
        <Typography.Link href={releaseUrl(candidate.id)} target="_blank" style={{ fontSize: token.fontSizeSM }}>
          View on MusicBrainz
        </Typography.Link>
        {others > 0 && (
          <Button type="link" size="small" onClick={onChange} style={{ paddingInline: 0, fontSize: token.fontSizeSM }}>
            Change release
          </Button>
        )}
      </Flex>
      {!loading && !hasCover && (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: token.fontSizeSM }}>
          No cover on MusicBrainz, so add a photo in the editor.
        </Typography.Text>
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

/** One pressing in the list of matches: the whole row picks it. */
function CandidateRow({ candidate, first }: { candidate: Candidate; first: boolean }) {
  const { token } = theme.useToken();
  const details = [
    yearOf(candidate.date),
    candidate.country,
    candidate.format,
    candidate.tracks && `${candidate.tracks} tracks`,
    [candidate.label, candidate.catalogNumber].filter(Boolean).join(' '),
  ].filter(Boolean);

  return (
    <Radio
      value={candidate.id}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        margin: 0,
        padding: 12,
        borderTop: first ? undefined : `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Flex gap={12} align="center">
        <Image
          src={coverThumbnail(candidate.id)}
          alt=""
          width={48}
          height={48}
          preview={false}
          style={{ objectFit: 'cover', borderRadius: token.borderRadiusSM }}
          fallback={placeholder}
        />
        <Flex vertical style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis>
            {candidate.title}
            {candidate.disambiguation && <Typography.Text type="secondary"> ({candidate.disambiguation})</Typography.Text>}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {candidate.artist} · {details.join(' · ')}
          </Typography.Text>
        </Flex>
      </Flex>
    </Radio>
  );
}

function TextSearch({ onSearch, initialValues }: { onSearch: (query: Query) => void; initialValues?: Query }) {
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
      <Button type="primary" htmlType="submit" size="large" block icon={<SearchOutlined />}>
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

/** Says where this CD already is, and how to get there. */
function DuplicateAlert({ duplicate, adding, baseUrl }: { duplicate: Duplicate; adding: Status; baseUrl: string }) {
  const { album, samePressing } = duplicate;
  const pressing = samePressing ? '' : ' (another pressing)';
  let title: string;
  let description: string | undefined;
  if (!album.slug) {
    title = 'You just added this';
    description = 'You added it from this phone in the last hour.';
  } else if (album.status === 'collection') {
    title = `You already have this${pressing}`;
    description = samePressing ? undefined : 'Another pressing of this album is in the collection.';
  } else if (adding === 'collection') {
    title = `It's on your wishlist${pressing}`;
    description = 'Got it opens it in the editor: set its status to In our collection and save. Its date added and note stay.';
  } else {
    title = `It's already on your wishlist${pressing}`;
    description = undefined;
  }
  // Got it is the main button below, so the wishlist-to-collection case needs no button here.
  const open = album.slug && !(album.status === 'wishlist' && adding === 'collection');
  return (
    <Alert
      type="warning"
      showIcon
      title={title}
      description={description}
      action={
        open && (
          <Button href={editAlbumUrl(baseUrl, album.slug!)} icon={<EditOutlined />}>
            Open
          </Button>
        )
      }
    />
  );
}

const statusLabels: Record<Status, string> = { collection: 'Collection', wishlist: 'Wishlist' };

const methodLabels: Record<Method, { short: string; long: string; icon: ReactNode }> = {
  scan: { short: 'Scan', long: 'Scan the barcode', icon: <ScanOutlined /> },
  text: { short: 'Search', long: 'Search by artist and title', icon: <SearchOutlined /> },
  id: { short: 'Link', long: 'Paste a MusicBrainz link', icon: <LinkOutlined /> },
};

function NotFound({
  barcode,
  query,
  releaseId,
  method,
  onSearch,
  onIdSearch,
  onOtherWay,
}: {
  barcode?: string;
  query?: Query;
  releaseId?: string;
  method: Method;
  onSearch: (query: Query) => void;
  onIdSearch: (releaseId: string) => void;
  onOtherWay: () => void;
}) {
  const searched = query && [query.artist, query.title].filter(Boolean).join(' – ');
  const [title, description] = releaseId
    ? ['No release with that id on MusicBrainz', 'Copy the link from the release page itself (musicbrainz.org/release/…).']
    : searched
      ? [`No CDs found for “${searched}”`, 'Check the spelling, or leave out words you are unsure of.']
      : [`No CDs found for barcode ${barcode}`, 'Search another way or fill it in by hand. The barcode is kept.'];
  return (
    <>
      <Alert
        type="warning"
        showIcon
        title={title}
        description={
          <Flex vertical align="flex-start" gap={12}>
            {description}
            {/* Back to the "How" step, where the other ways and "Fill it in by hand" are. */}
            <Button onClick={onOtherWay}>Try another way</Button>
          </Flex>
        }
      />
      {barcode && (searched || releaseId) && (
        <Typography.Text type="secondary">Barcode {barcode} will still be saved with the album.</Typography.Text>
      )}
      {method === 'text' && <TextSearch onSearch={onSearch} initialValues={query} />}
      {method === 'id' && <IdSearch onSearch={onIdSearch} initialValue={releaseId} />}
    </>
  );
}

/** For a release that's on MusicBrainz but the searches miss: paste its link (or id). */
function IdSearch({ onSearch, initialValue }: { onSearch: (releaseId: string) => void; initialValue?: string }) {
  const [invalid, setInvalid] = useState(false);
  return (
    <Form layout="vertical">
      <Form.Item
        label="MusicBrainz release link or id"
        validateStatus={invalid ? 'error' : undefined}
        help={invalid ? 'That isn’t a release link. It looks like musicbrainz.org/release/…' : undefined}
        style={{ marginBottom: 0 }}
      >
        <Input.Search
          size="large"
          defaultValue={initialValue}
          placeholder="https://musicbrainz.org/release/…"
          enterButton="Look up"
          autoComplete="off"
          onChange={() => setInvalid(false)}
          onSearch={(value) => {
            const id = releaseIdFrom(value);
            setInvalid(!id);
            if (id) onSearch(id);
          }}
        />
      </Form.Item>
    </Form>
  );
}
