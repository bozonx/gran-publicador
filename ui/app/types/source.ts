export interface Source {
  name: string
  itemCount: number
  type: 'rss' | 'html'
  locale: string
  lang: string
  sourceTags: string[]
  lastUpdated: string
  lastSavedAt: string
}

export interface SourceResponse {
  items: Source[]
  meta: {
    total: number
    limit: number
    offset: number
  }
}
