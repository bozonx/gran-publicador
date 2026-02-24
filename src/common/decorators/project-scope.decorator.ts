import { SetMetadata } from '@nestjs/common';

export type ProjectScopeSource = 'body' | 'query' | 'params';

export interface ProjectScopeOptions {
  param?: string;
  source?: ProjectScopeSource;
}

export const PROJECT_SCOPE_KEY = 'project_scope';

/**
 * Decorator to automatically validate project scope for API tokens.
 * Default param is 'projectId' from 'query'.
 */
export const CheckProjectScope = (options: ProjectScopeOptions = {}) =>
  SetMetadata(PROJECT_SCOPE_KEY, {
    param: options.param || 'projectId',
    source: options.source || 'query',
  });
