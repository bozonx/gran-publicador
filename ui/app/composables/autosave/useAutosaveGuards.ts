import { onMounted, onUnmounted, type Ref } from 'vue';
import { onBeforeRouteLeave, type RouteLocationNormalized } from 'vue-router';
import { logger } from '~/utils/logger';

export interface UseAutosaveGuardsOptions {
  isSaving: Ref<boolean>;
  isDirty: Ref<boolean>;
  enableNavigationGuards?: boolean;
  enableBlurSave?: boolean;
  t: (key: string) => string;
  onBlurSave: () => Promise<void> | void;
}

export function useAutosaveGuards(options: UseAutosaveGuardsOptions) {
  const { isSaving, isDirty, enableNavigationGuards, enableBlurSave, t, onBlurSave } = options;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isSaving.value || isDirty.value) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  };

  const handleFocusOut = () => {
    if (!enableBlurSave) return;
    if (!isDirty.value && !isSaving.value) return;
    void onBlurSave();
  };

  if (enableNavigationGuards) {
    try {
      onBeforeRouteLeave(
        (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
          if (isSaving.value || isDirty.value) {
            const key = isSaving.value
              ? 'common.savingInProgressConfirm'
              : 'common.unsavedChangesConfirm';
            return window.confirm(t(key));
          }
          return true;
        }
      );
    } catch (error) {
      logger.warn('Failed to register autosave route leave guard', error);
    }
  }

  onMounted(() => {
    if (enableNavigationGuards) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    if (enableBlurSave) {
      window.addEventListener('focusout', handleFocusOut, true);
    }
  });

  onUnmounted(() => {
    if (enableNavigationGuards) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
    if (enableBlurSave) {
      window.removeEventListener('focusout', handleFocusOut, true);
    }
    
    // Final flush on unmount if dirty
    if (isDirty.value && !isSaving.value) {
      void onBlurSave();
    }
  });
}
