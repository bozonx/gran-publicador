import { stripHtmlAndSpecialChars } from '~/utils/text'

/**
 * Composable for consistent formatting utilities across the application
 */
export function useFormatters() {
  const { d } = useI18n()

  /**
   * Format date to short format
   */
  function formatDateShort(date: string | null | undefined): string {
    if (!date) return '—'
    const dObj = new Date(date)
    if (isNaN(dObj.getTime())) return '—'
    return d(dObj, 'short')
  }

  /**
   * Format date with time
   */
  function formatDateWithTime(date: string | null | undefined): string {
    if (!date) return '—'
    const dObj = new Date(date)
    if (isNaN(dObj.getTime())) return '—'
    return d(dObj, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * Format date with time including seconds
   */
  function formatDateWithSeconds(date: string | null | undefined): string {
    if (!date) return '—'
    const dObj = new Date(date)
    if (isNaN(dObj.getTime())) return '—'
    return d(dObj, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  /**
   * Truncate text content, stripping HTML tags
   */
  function truncateContent(
    content: string | null | undefined, 
    maxLength = 100
  ): string {
    if (!content) return ''
    const text = stripHtmlAndSpecialChars(content)
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  /**
   * Format number with locale
   */
  function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0'
    return value.toLocaleString()
  }

  /**
   * Get display title for publication with fallback logic
   */
  function getPublicationDisplayTitle(pub: any): string {
    let text = ''
    
    if (pub.title && typeof pub.title === 'string' && pub.title.trim()) {
      text = stripHtmlAndSpecialChars(pub.title)
    } 
    
    if (!text && pub.content && typeof pub.content === 'string' && pub.content.trim()) {
      text = stripHtmlAndSpecialChars(pub.content)
    } 
    
    if (!text && pub.tags) {
      if (Array.isArray(pub.tags) && pub.tags.length > 0) {
        text = pub.tags.join(', ')
      } else if (typeof pub.tags === 'string' && pub.tags.trim()) {
        text = pub.tags
      }
    }
    
    if (!text && pub.createdAt) {
      text = formatDateShort(pub.createdAt)
    }
    
    if (!text) {
      text = 'Untitled'
    }
    
    return text.toString().replace(/\s+/g, ' ').trim()
  }

  return {
    formatDateShort,
    formatDateWithTime,
    formatDateWithSeconds,
    truncateContent,
    formatNumber,
    getPublicationDisplayTitle,
  }
}
