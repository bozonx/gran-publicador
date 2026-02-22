import { describe, expect, it } from 'vitest';

import { applyTimelineCommand } from '../../app/timeline/commands';
import { createDefaultTimelineDocument } from '../../app/timeline/otioSerializer';

describe('timeline/commands', () => {
  it('adds clip sequentially to video track', () => {
    const doc = createDefaultTimelineDocument({ id: 'd1', name: 'Demo', fps: 25 });
    const vTrackId = doc.tracks.find(t => t.kind === 'video')!.id;

    const r1 = applyTimelineCommand(doc, {
      type: 'add_clip_to_track',
      trackId: vTrackId,
      name: 'A',
      path: 'sources/video/a.mp4',
      durationUs: 1_000_000,
      sourceDurationUs: 1_000_000,
    });

    const r2 = applyTimelineCommand(r1.next, {
      type: 'add_clip_to_track',
      trackId: vTrackId,
      name: 'B',
      path: 'sources/video/b.mp4',
      durationUs: 2_000_000,
      sourceDurationUs: 2_000_000,
    });

    const v1 = r2.next.tracks.find(t => t.kind === 'video')!;
    expect(v1.items).toHaveLength(2);
    expect(v1.items[0]!.timelineRange.startUs).toBe(0);
    expect(v1.items[0]!.timelineRange.durationUs).toBe(1_000_000);
    expect(v1.items[1]!.timelineRange.startUs).toBe(1_000_000);
    expect(v1.items[1]!.timelineRange.durationUs).toBe(2_000_000);
  });

  it('denies overlap on move', () => {
    const doc = createDefaultTimelineDocument({ id: 'd1', name: 'Demo', fps: 25 });
    const vTrackId = doc.tracks.find(t => t.kind === 'video')!.id;

    const r1 = applyTimelineCommand(doc, {
      type: 'add_clip_to_track',
      trackId: vTrackId,
      name: 'A',
      path: 'sources/video/a.mp4',
      durationUs: 2_000_000,
      sourceDurationUs: 2_000_000,
    });

    const r2 = applyTimelineCommand(r1.next, {
      type: 'add_clip_to_track',
      trackId: vTrackId,
      name: 'B',
      path: 'sources/video/b.mp4',
      durationUs: 2_000_000,
      sourceDurationUs: 2_000_000,
    });

    const v1 = r2.next.tracks.find(t => t.kind === 'video')!;
    const firstId = v1.items[0]!.id;

    expect(() =>
      applyTimelineCommand(r2.next, {
        type: 'move_item',
        trackId: v1.id,
        itemId: firstId,
        startUs: 1_000_000,
      }),
    ).toThrow(/overlaps/i);
  });

  it('trims clip end', () => {
    const doc = createDefaultTimelineDocument({ id: 'd1', name: 'Demo', fps: 25 });
    const vTrackId = doc.tracks.find(t => t.kind === 'video')!.id;

    const r1 = applyTimelineCommand(doc, {
      type: 'add_clip_to_track',
      trackId: vTrackId,
      name: 'A',
      path: 'sources/video/a.mp4',
      durationUs: 3_000_000,
      sourceDurationUs: 3_000_000,
    });

    const v1 = r1.next.tracks.find(t => t.kind === 'video')!;
    const clipId = v1.items[0]!.id;

    const r2 = applyTimelineCommand(r1.next, {
      type: 'trim_item',
      trackId: v1.id,
      itemId: clipId,
      edge: 'end',
      deltaUs: -1_000_000,
    });

    const v2 = r2.next.tracks.find(t => t.kind === 'video')!;
    const clip = v2.items.find(x => x.id === clipId)!;
    expect(clip.timelineRange.startUs).toBe(0);
    expect(clip.timelineRange.durationUs).toBe(2_000_000);
  });

  it('keeps clip id stable after move and trim operations', () => {
    const doc = createDefaultTimelineDocument({ id: 'd1', name: 'Demo', fps: 25 });
    const vTrackId = doc.tracks.find(t => t.kind === 'video')!.id;

    const added = applyTimelineCommand(doc, {
      type: 'add_clip_to_track',
      trackId: vTrackId,
      name: 'A',
      path: 'sources/video/a.mp4',
      durationUs: 3_000_000,
      sourceDurationUs: 3_000_000,
    });

    const trackAfterAdd = added.next.tracks.find(t => t.id === vTrackId)!;
    const originalId = trackAfterAdd.items[0]!.id;

    const moved = applyTimelineCommand(added.next, {
      type: 'move_item',
      trackId: vTrackId,
      itemId: originalId,
      startUs: 500_000,
    });

    const trackAfterMove = moved.next.tracks.find(t => t.id === vTrackId)!;
    const movedItem = trackAfterMove.items.find(item => item.id === originalId);
    expect(movedItem).toBeDefined();

    const trimmed = applyTimelineCommand(moved.next, {
      type: 'trim_item',
      trackId: vTrackId,
      itemId: originalId,
      edge: 'end',
      deltaUs: -500_000,
    });

    const trackAfterTrim = trimmed.next.tracks.find(t => t.id === vTrackId)!;
    const trimmedItem = trackAfterTrim.items.find(item => item.id === originalId);
    expect(trimmedItem).toBeDefined();
  });
});
