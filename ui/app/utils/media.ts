export function formatBytes(bytes?: number | string): string {
  if (!bytes || bytes === 0 || bytes === '0') return '0 B'
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  const val = b / Math.pow(k, i)
  return (val < 10 ? val.toFixed(2) : val.toFixed(1)) + ' ' + sizes[i]
}

export function getMediaIcon(type: string): string {
  switch (type.toUpperCase()) {
    case 'IMAGE':
      return 'i-heroicons-photo'
    case 'VIDEO':
      return 'i-heroicons-film'
    case 'AUDIO':
      return 'i-heroicons-musical-note'
    case 'DOCUMENT':
      return 'i-heroicons-document-text'
    case 'PDF':
      return 'i-heroicons-document-text'
    default:
      return 'i-heroicons-document'
  }
}
