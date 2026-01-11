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

  return {
    formatDateShort,
    formatDateWithTime,
    truncateContent,
    formatNumber,
  }
}
