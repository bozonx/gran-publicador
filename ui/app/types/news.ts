export interface NewsItem {
  id: string;
  shortId: string;
  source: string;
  batchId: string;
  taskId: string;
  savedAt: string;
  uniqueKey: string;
  dataset: string;
  url: string;
  title: string;
  description: string;
  date: string;
  _score: number;
  locale?: string;
  type?: string;
  mainImageUrl?: string;
  mainVideoUrl?: string;
  content?: string;
  tags?: string[];
  publishedAt?: string;
  publisher?: string;
  _source?: string;
  _savedAt?: string;
  contentLength?: number;
}

export interface SearchNewsParams {
  q: string;
  mode?: 'text' | 'vector' | 'hybrid' | 'all';
  savedFrom?: string;
  savedTo?: string;
  afterSavedAt?: string;
  afterId?: string;
  cursor?: string;
  source?: string;
  sourceTags?: string | string[];
  lang?: string;
  minScore?: number;
  includeContent?: boolean;
  orderBy?: 'relevance' | 'savedAt';
  sources?: string | string[];
  limit?: number;
}
