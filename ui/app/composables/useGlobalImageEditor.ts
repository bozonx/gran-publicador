import { computed } from 'vue';

interface OpenEditorPayload {
  source: string;
  filename?: string;
  onSave: (file: File) => Promise<void> | void;
  onClose?: () => Promise<void> | void;
}

interface GlobalImageEditorState {
  isOpen: boolean;
  source: string | null;
  filename?: string;
  onSave?: (file: File) => Promise<void> | void;
  onClose?: () => Promise<void> | void;
}

export function useGlobalImageEditor() {
  const state = useState<GlobalImageEditorState>('global-image-editor', () => ({
    isOpen: false,
    source: null,
    filename: undefined,
    onSave: undefined,
    onClose: undefined,
  }));

  const isOpen = computed({
    get: () => state.value.isOpen,
    set: (value: boolean) => {
      state.value.isOpen = value;
    },
  });

  const openEditor = (payload: OpenEditorPayload) => {
    state.value = {
      isOpen: true,
      source: payload.source,
      filename: payload.filename,
      onSave: payload.onSave,
      onClose: payload.onClose,
    };
  };

  const closeEditor = async () => {
    const onClose = state.value.onClose;

    state.value.isOpen = false;
    state.value.source = null;
    state.value.filename = undefined;
    state.value.onSave = undefined;
    state.value.onClose = undefined;

    await onClose?.();
  };

  const handleSave = async (file: File) => {
    const onSave = state.value.onSave;
    await onSave?.(file);
  };

  return {
    isOpen,
    state,
    openEditor,
    closeEditor,
    handleSave,
  };
}
