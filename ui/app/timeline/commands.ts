import type {
  TimelineClipItem,
  TimelineDocument,
  TimelineTrack,
  TimelineTrackItem,
  TrackKind,
} from './types';

export interface TimelineCommandResult {
  next: TimelineDocument;
}

export interface AddClipToTrackCommand {
  type: 'add_clip_to_track';
  trackKind: TrackKind;
  name: string;
  path: string;
  durationUs?: number;
}

export interface RemoveItemCommand {
  type: 'remove_item';
  trackId: string;
  itemId: string;
}

export interface MoveItemCommand {
  type: 'move_item';
  trackId: string;
  itemId: string;
  startUs: number;
}

export type TimelineCommand = AddClipToTrackCommand | RemoveItemCommand | MoveItemCommand;

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function assertNoOverlap(track: TimelineTrack, movedItemId: string, startUs: number, durationUs: number) {
  const endUs = startUs + durationUs;
  for (const it of track.items) {
    if (it.id === movedItemId) continue;
    const itStart = it.timelineRange.startUs;
    const itEnd = itStart + it.timelineRange.durationUs;
    if (rangesOverlap(startUs, endUs, itStart, itEnd)) {
      throw new Error('Item overlaps with another item');
    }
  }
}

function getTrackByKind(doc: TimelineDocument, kind: TrackKind): TimelineTrack {
  const t = doc.tracks.find((x) => x.kind === kind);
  if (!t) throw new Error('Track not found');
  return t;
}

function getTrackById(doc: TimelineDocument, trackId: string): TimelineTrack {
  const t = doc.tracks.find((x) => x.id === trackId);
  if (!t) throw new Error('Track not found');
  return t;
}

function nextItemId(trackId: string, prefix: string): string {
  return `${prefix}_${trackId}_${Math.random().toString(36).slice(2, 10)}`;
}

function computeTrackEndUs(track: TimelineTrack): number {
  let end = 0;
  for (const it of track.items) {
    end = Math.max(end, it.timelineRange.startUs + it.timelineRange.durationUs);
  }
  return end;
}

export function applyTimelineCommand(doc: TimelineDocument, cmd: TimelineCommand): TimelineCommandResult {
  if (cmd.type === 'add_clip_to_track') {
    const track = getTrackByKind(doc, cmd.trackKind);
    const durationUs = Math.max(0, Math.round(Number(cmd.durationUs ?? 0)));
    const startUs = computeTrackEndUs(track);

    assertNoOverlap(track, '', startUs, durationUs);

    const clip: TimelineClipItem = {
      kind: 'clip',
      id: nextItemId(track.id, 'clip'),
      trackId: track.id,
      name: cmd.name,
      source: { path: cmd.path },
      timelineRange: { startUs, durationUs },
      sourceRange: { startUs: 0, durationUs },
    };

    const nextTracks = doc.tracks.map((t) => (t.id === track.id ? { ...t, items: [...t.items, clip] } : t));

    return {
      next: {
        ...doc,
        tracks: nextTracks,
      },
    };
  }

  if (cmd.type === 'remove_item') {
    const track = getTrackById(doc, cmd.trackId);
    const nextItems = track.items.filter((x) => x.id !== cmd.itemId);
    if (nextItems.length === track.items.length) return { next: doc };

    const nextTracks = doc.tracks.map((t) => (t.id === track.id ? { ...t, items: nextItems } : t));
    return { next: { ...doc, tracks: nextTracks } };
  }

  if (cmd.type === 'move_item') {
    const track = getTrackById(doc, cmd.trackId);
    const item = track.items.find((x) => x.id === cmd.itemId);
    if (!item) return { next: doc };

    const startUs = Math.max(0, Math.round(cmd.startUs));
    const durationUs = Math.max(0, item.timelineRange.durationUs);

    assertNoOverlap(track, item.id, startUs, durationUs);

    const nextItems: TimelineTrackItem[] = track.items.map((x) =>
      x.id === item.id
        ? {
            ...x,
            timelineRange: { ...x.timelineRange, startUs },
          }
        : x,
    );

    nextItems.sort((a, b) => a.timelineRange.startUs - b.timelineRange.startUs);

    const nextTracks = doc.tracks.map((t) => (t.id === track.id ? { ...t, items: nextItems } : t));
    return { next: { ...doc, tracks: nextTracks } };
  }

  return { next: doc };
}
