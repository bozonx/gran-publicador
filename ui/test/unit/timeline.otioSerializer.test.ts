import { describe, expect, it } from 'vitest';

import { parseTimelineFromOtio, serializeTimelineToOtio } from '../../app/timeline/otioSerializer';

describe('timeline/otioSerializer', () => {
  it('roundtrips OTIO and preserves item durations', () => {
    const input = {
      OTIO_SCHEMA: 'Timeline.1',
      name: 'Demo',
      tracks: {
        OTIO_SCHEMA: 'Stack.1',
        name: 'tracks',
        children: [
          {
            OTIO_SCHEMA: 'Track.1',
            name: 'Video 1',
            kind: 'Video',
            children: [
              {
                OTIO_SCHEMA: 'Clip.1',
                name: 'A',
                media_reference: {
                  OTIO_SCHEMA: 'ExternalReference.1',
                  target_url: 'sources/video/a.mp4',
                },
                source_range: {
                  OTIO_SCHEMA: 'TimeRange.1',
                  start_time: { OTIO_SCHEMA: 'RationalTime.1', value: 0, rate: 1000000 },
                  duration: { OTIO_SCHEMA: 'RationalTime.1', value: 1500000, rate: 1000000 },
                },
              },
            ],
          },
        ],
      },
      metadata: {
        gran: {
          docId: 'doc1',
          timebase: { fps: 25 },
          tracks: [{ id: 'v1', kind: 'video', name: 'Video 1' }],
        },
      },
    };

    const doc = parseTimelineFromOtio(JSON.stringify(input), { id: 'fallback', name: 'fallback', fps: 25 });
    expect(doc.OTIO_SCHEMA).toBe('Timeline.1');
    expect(doc.tracks).toHaveLength(1);
    expect(doc.tracks[0]!.items).toHaveLength(1);
    expect(doc.tracks[0]!.items[0]!.timelineRange.durationUs).toBe(1_500_000);

    const text = serializeTimelineToOtio(doc);
    const again = parseTimelineFromOtio(text, { id: 'fallback2', name: 'fallback2', fps: 25 });

    expect(again.tracks[0]!.items[0]!.timelineRange.durationUs).toBe(1_500_000);
  });
});
