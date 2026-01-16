export interface PresetSignature {
  id: string;
  nameKey: string;
  contentKey: string;
  order: number;
}

export const PRESET_SIGNATURES: PresetSignature[] = [
  {
    id: 'subscriber',
    nameKey: 'authorSignature.presets.subscriber',
    contentKey: 'authorSignature.presets.subscriberContent',
    order: 0,
  },
  {
    id: 'source',
    nameKey: 'authorSignature.presets.source',
    contentKey: 'authorSignature.presets.sourceContent',
    order: 1,
  },
  {
    id: 'fromChannel',
    nameKey: 'authorSignature.presets.fromChannel',
    contentKey: 'authorSignature.presets.fromChannelContent',
    order: 2,
  },
  {
    id: 'editor',
    nameKey: 'authorSignature.presets.editor',
    contentKey: 'authorSignature.presets.editorContent',
    order: 3,
  },
];
