export const PUBLICATIONS_QUEUE = 'publications';
export const PROCESS_POST_JOB = 'process-post';

export interface ProcessPostJobData {
  postId: string;
  force?: boolean;
}
