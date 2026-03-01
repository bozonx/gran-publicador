import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { LlmPromptTemplate } from '~/types/llm-prompt-template';

/**
 * LLM Prompt Templates store using Dumb Store pattern.
 */
export const useTemplatesStore = defineStore('templates', () => {
  const systemTemplates = shallowRef<LlmPromptTemplate[]>([]);
  const userTemplates = shallowRef<LlmPromptTemplate[]>([]);
  const projectTemplates = shallowRef<LlmPromptTemplate[]>([]);
  const availableOrder = ref<string[]>([]);
  
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function setSystemTemplates(templates: LlmPromptTemplate[]) {
    systemTemplates.value = templates;
  }

  function setUserTemplates(templates: LlmPromptTemplate[]) {
    userTemplates.value = templates;
  }

  function setProjectTemplates(templates: LlmPromptTemplate[]) {
    projectTemplates.value = templates;
  }

  function setAvailableOrder(order: string[]) {
    availableOrder.value = order;
  }

  function updateTemplateInLists(updated: LlmPromptTemplate) {
    const updateInList = (list: LlmPromptTemplate[]) => {
      const index = list.findIndex(t => t.id === updated.id);
      if (index !== -1) {
        const newList = [...list];
        newList[index] = updated;
        return newList;
      }
      return list;
    };

    systemTemplates.value = updateInList(systemTemplates.value);
    userTemplates.value = updateInList(userTemplates.value);
    projectTemplates.value = updateInList(projectTemplates.value);
  }

  function removeTemplateFromLists(id: string) {
    const removeFromList = (list: LlmPromptTemplate[]) => list.filter(t => t.id !== id);
    
    systemTemplates.value = removeFromList(systemTemplates.value);
    userTemplates.value = removeFromList(userTemplates.value);
    projectTemplates.value = removeFromList(projectTemplates.value);
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function reset() {
    systemTemplates.value = [];
    userTemplates.value = [];
    projectTemplates.value = [];
    availableOrder.value = [];
    isLoading.value = false;
    error.value = null;
  }

  return {
    systemTemplates,
    userTemplates,
    projectTemplates,
    availableOrder,
    isLoading,
    error,
    setSystemTemplates,
    setUserTemplates,
    setProjectTemplates,
    setAvailableOrder,
    updateTemplateInLists,
    removeTemplateFromLists,
    setLoading,
    setError,
    reset,
  };
});
