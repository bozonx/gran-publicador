import { ref, computed } from 'vue'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'

export const SYSTEM_CATEGORY_KEYS = ['chat', 'content', 'editing', 'general', 'metadata']

export function useLlmTemplatesLogic() {
  const { t } = useI18n()

  const searchQuery = ref('')
  const sourceFilter = ref<'all' | 'system' | 'project' | 'personal'>('all')
  const showHiddenOnly = ref(false)

  function groupAndSortTemplates(templates: LlmPromptTemplate[]) {
    const groups = new Map<string, LlmPromptTemplate[]>()
    
    templates.forEach((tpl) => {
      const key = tpl.category || 'General'
      const list = groups.get(key) || []
      list.push(tpl)
      groups.set(key, list)
    })

    return [...groups.entries()]
      .sort(([a], [b]) => {
        const aLower = a.toLowerCase()
        const bLower = b.toLowerCase()
        const aIdx = SYSTEM_CATEGORY_KEYS.indexOf(aLower)
        const bIdx = SYSTEM_CATEGORY_KEYS.indexOf(bLower)

        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
        if (aIdx !== -1) return -1
        if (bIdx !== -1) return 1
        return a.localeCompare(b)
      })
      .map(([category, items]) => {
        const lower = category.toLowerCase()
        const isSystem = SYSTEM_CATEGORY_KEYS.includes(lower)
        return {
          category: isSystem ? t(`llm.categories.${lower}`) : category,
          items
        }
      })
  }

  function filterTemplates(templates: LlmPromptTemplate[], query: string, hiddenOnly: boolean) {
    const q = query.trim().toLowerCase()
    return templates.filter((tpl) => {
      if (hiddenOnly && !tpl.isHidden) return false
      if (!hiddenOnly && tpl.isHidden) return false
      if (!q) return true
      return (
        (tpl.name?.toLowerCase() || '').includes(q) ||
        tpl.prompt.toLowerCase().includes(q)
      )
    })
  }

  return {
    searchQuery,
    sourceFilter,
    showHiddenOnly,
    groupAndSortTemplates,
    filterTemplates
  }
}
