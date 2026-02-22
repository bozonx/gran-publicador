export const PUBLICATIONS_QUEUE = 'publications';
export const PROCESS_PUBLICATION_JOB = 'process-publication';

export interface ProcessPublicationJobData {
  publicationId: string;
  force?: boolean;
}
