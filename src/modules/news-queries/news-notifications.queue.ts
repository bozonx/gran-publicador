export const NEWS_NOTIFICATIONS_QUEUE = 'news-notifications';
export const PROCESS_NEWS_QUERY_JOB = 'process-news-query';

export interface ProcessNewsQueryJobData {
  queryId: string;
}
