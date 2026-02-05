/**
 * Standard pagination metadata for list responses.
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  totalUnfiltered?: number;
}

/**
 * Standard paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}
