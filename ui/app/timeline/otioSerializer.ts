import type {
  TimelineClipItem,
  TimelineDocument,
  TimelineGapItem,
  TimelineRange,
  TimelineTimebase,
  TimelineTrack,
  TimelineTrackItem,
  TrackKind,
} from './types';

interface OtioRationalTime {
  OTIO_SCHEMA: 'RationalTime.1';
  value: number;
  rate: number;
}

interface OtioTimeRange {
  OTIO_SCHEMA: 'TimeRange.1';
  start_time: OtioRationalTime;
  duration: OtioRationalTime;
}

interface OtioExternalReference {
  OTIO_SCHEMA: 'ExternalReference.1';
  target_url: string;
}

interface OtioClip {
  OTIO_SCHEMA: 'Clip.1';
  name: string;
  media_reference: OtioExternalReference;
  source_range: OtioTimeRange;
}

interface OtioGap {
  OTIO_SCHEMA: 'Gap.1';
  name: string;
  source_range: OtioTimeRange;
}

interface OtioTrack {
  OTIO_SCHEMA: 'Track.1';
  name: string;
  kind: 'Video' | 'Audio';
  children: Array<OtioClip | OtioGap>;
}

interface OtioStack {
  OTIO_SCHEMA: 'Stack.1';
  name: string;
  children: OtioTrack[];
}

interface OtioTimeline {
  OTIO_SCHEMA: 'Timeline.1';
  name: string;
  tracks: OtioStack;
  metadata?: Record<string, unknown>;
}

const TIME_RATE_US = 1_000_000;

function toRationalTimeUs(us: number): OtioRationalTime {
  return {
    OTIO_SCHEMA: 'RationalTime.1',
    value: Math.round(us),
    rate: TIME_RATE_US,
  };
}

function fromRationalTimeUs(rt: any): number {
  const value = Number(rt?.value);
  const rate = Number(rt?.rate);
  if (!Number.isFinite(value) || !Number.isFinite(rate) || rate <= 0) return 0;
  if (rate === TIME_RATE_US) return Math.round(value);
  return Math.round((value / rate) * TIME_RATE_US);
}

function toTimeRange(range: TimelineRange): OtioTimeRange {
  return {
    OTIO_SCHEMA: 'TimeRange.1',
    start_time: toRationalTimeUs(range.startUs),
    duration: toRationalTimeUs(range.durationUs),
  };
}

function fromTimeRange(tr: any): TimelineRange {
  return {
    startUs: fromRationalTimeUs(tr?.start_time),
    durationUs: fromRationalTimeUs(tr?.duration),
  };
}

function trackKindToOtioKind(kind: TrackKind): 'Video' | 'Audio' {
  return kind === 'audio' ? 'Audio' : 'Video';
}

function trackKindFromOtioKind(kind: any): TrackKind {
  return kind === 'Audio' ? 'audio' : 'video';
}

function assertTimelineTimebase(raw: any): TimelineTimebase {
  const fps = Number(raw?.fps);
  return {
    fps: Number.isFinite(fps) && fps > 0 ? Math.round(Math.min(240, Math.max(1, fps))) : 25,
  };
}

function coerceId(raw: any, fallback: string): string {
  const v = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
  return v;
}

function coerceName(raw: any, fallback: string): string {
  const v = typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
  return v;
}

function parseClipItem(trackId: string, otio: OtioClip, index: number): TimelineClipItem {
  const sourceRange = fromTimeRange(otio.source_range);
  const name = coerceName(otio.name, `clip_${index + 1}`);
  const path = typeof otio.media_reference?.target_url === 'string' ? otio.media_reference.target_url : '';

  return {
    kind: 'clip',
    id: `clip_${trackId}_${index + 1}`,
    trackId,
    name,
    source: { path },
    timelineRange: { startUs: 0, durationUs: sourceRange.durationUs },
    sourceRange,
  };
}

function parseGapItem(trackId: string, otio: OtioGap, index: number): TimelineGapItem {
  const range = fromTimeRange(otio.source_range);
  return {
    kind: 'gap',
    id: `gap_${trackId}_${index + 1}`,
    trackId,
    timelineRange: { startUs: 0, durationUs: range.durationUs },
  };
}

function buildTrackItemsWithTimelineStarts(trackId: string, rawItems: TimelineTrackItem[]): TimelineTrackItem[] {
  let cursorUs = 0;
  return rawItems.map((it) => {
    const next = {
      ...it,
      timelineRange: {
        ...it.timelineRange,
        startUs: cursorUs,
      },
    } as TimelineTrackItem;

    cursorUs += Math.max(0, next.timelineRange.durationUs);
    return next;
  });
}

export function createDefaultTimelineDocument(params: {
  id: string;
  name: string;
  fps: number;
}): TimelineDocument {
  return {
    OTIO_SCHEMA: 'Timeline.1',
    id: params.id,
    name: params.name,
    timebase: { fps: params.fps },
    tracks: [
      { id: 'v1', kind: 'video', name: 'Video 1', items: [] },
      { id: 'a1', kind: 'audio', name: 'Audio 1', items: [] },
    ],
  };
}

export function serializeTimelineToOtio(doc: TimelineDocument): string {
  const tracks: OtioTrack[] = doc.tracks.map((t) => {
    const children: Array<OtioClip | OtioGap> = t.items.map((item) => {
      if (item.kind === 'gap') {
        return {
          OTIO_SCHEMA: 'Gap.1',
          name: 'gap',
          source_range: toTimeRange({ startUs: 0, durationUs: item.timelineRange.durationUs }),
        };
      }

      return {
        OTIO_SCHEMA: 'Clip.1',
        name: item.name,
        media_reference: {
          OTIO_SCHEMA: 'ExternalReference.1',
          target_url: item.source.path,
        },
        source_range: toTimeRange(item.sourceRange),
      };
    });

    return {
      OTIO_SCHEMA: 'Track.1',
      name: t.name,
      kind: trackKindToOtioKind(t.kind),
      children,
    };
  });

  const payload: OtioTimeline = {
    OTIO_SCHEMA: 'Timeline.1',
    name: doc.name,
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      children: tracks,
    },
    metadata: {
      gran: {
        docId: doc.id,
        timebase: doc.timebase,
        tracks: doc.tracks.map((t) => ({
          id: t.id,
          kind: t.kind,
          name: t.name,
        })),
      },
    },
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseTimelineFromOtio(text: string, fallback: { id: string; name: string; fps: number }): TimelineDocument {
  let parsed: OtioTimeline | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return createDefaultTimelineDocument({ id: fallback.id, name: fallback.name, fps: fallback.fps });
  }

  if (!parsed || parsed.OTIO_SCHEMA !== 'Timeline.1') {
    return createDefaultTimelineDocument({ id: fallback.id, name: fallback.name, fps: fallback.fps });
  }

  const granMeta = (parsed.metadata as any)?.gran;
  const timebase = assertTimelineTimebase(granMeta?.timebase ?? { fps: fallback.fps });

  const stackChildren = Array.isArray((parsed.tracks as any)?.children) ? (parsed.tracks as any).children : [];

  const trackMetas = Array.isArray(granMeta?.tracks) ? granMeta.tracks : [];

  const tracks: TimelineTrack[] = stackChildren.map((otioTrack: OtioTrack, trackIndex: number) => {
    const meta = trackMetas[trackIndex] ?? {};
    const id = coerceId(meta?.id, `${otioTrack.kind === 'Audio' ? 'a' : 'v'}${trackIndex + 1}`);
    const kind = meta?.kind === 'audio' || meta?.kind === 'video' ? meta.kind : trackKindFromOtioKind(otioTrack.kind);
    const name = coerceName(meta?.name ?? otioTrack.name, kind === 'audio' ? `Audio ${trackIndex + 1}` : `Video ${trackIndex + 1}`);

    const children = Array.isArray(otioTrack.children) ? otioTrack.children : [];

    const rawItems: TimelineTrackItem[] = children.map((child: any, itemIndex: number) => {
      if (child?.OTIO_SCHEMA === 'Gap.1') return parseGapItem(id, child as OtioGap, itemIndex);
      return parseClipItem(id, child as OtioClip, itemIndex);
    });

    const items = buildTrackItemsWithTimelineStarts(id, rawItems);

    return { id, kind, name, items };
  });

  const docId = coerceId(granMeta?.docId, fallback.id);
  const name = coerceName(parsed.name, fallback.name);

  if (tracks.length === 0) {
    return createDefaultTimelineDocument({ id: docId, name, fps: timebase.fps });
  }

  return {
    OTIO_SCHEMA: 'Timeline.1',
    id: docId,
    name,
    timebase,
    tracks,
  };
}
