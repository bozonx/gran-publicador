import type { NewsItem } from '~/composables/useNews'

/**
 * News mapping utilities to handle field inconsistencies from microservice
 */
export const newsMapper = {
  /**
   * Returns the best candidate for display date
   */
  getDisplayDate(item: NewsItem): string | undefined {
    return item._savedAt || item.savedAt || item.date || item.publishedAt;
  },

  /**
   * Returns display source/publisher name
   */
  getDisplaySource(item: NewsItem): string | undefined {
    return item.publisher || item._source;
  },

  /**
   * Returns display content/description
   */
  getDisplayText(item: NewsItem): string {
    return item.description || item.content || '';
  },
  
  /**
   * Returns display ID (handling legacy and new formats)
   */
  getDisplayId(item: any): string {
    return item.id || item._id || item.shortId;
  }
};
