import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsConfig } from '../../config/news.config.js';
import { HttpConfig } from '../../config/http.config.js';
import {
  requestJsonWithRetry,
  requestTextWithRetry,
} from '../../common/utils/http-request-with-retry.util.js';
import { SearchNewsQueryDto, FetchNewsContentDto } from './dto/index.js';

@Injectable()
export class NewsClientService {
  private readonly logger = new Logger(NewsClientService.name);
  private readonly httpConfig: HttpConfig;

  constructor(private readonly configService: ConfigService) {
    this.httpConfig = this.configService.get<HttpConfig>('http')!;
  }

  private get retryConfig() {
    return {
      maxAttempts: this.httpConfig.retryMaxAttempts,
      initialDelayMs: this.httpConfig.retryInitialDelayMs,
      maxDelayMs: this.httpConfig.retryMaxDelayMs,
    };
  }

  public async searchNews(query: SearchNewsQueryDto) {
    const config = this.configService.get<NewsConfig>('news')!;
    let baseUrl = config.serviceUrl.replace(/\/$/, '');

    // Ensure we don't duplicate /api/v1 if it's already in the config
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }

    const url = `${baseUrl}/news`;

    try {
      const searchParams: any = {
        q: query.q,
      };

      if (query.mode) searchParams.mode = query.mode;
      if (query.savedFrom) searchParams.savedFrom = query.savedFrom;
      if (query.savedTo) searchParams.savedTo = query.savedTo;
      if (query.afterSavedAt) searchParams.afterSavedAt = query.afterSavedAt;
      if (query.afterId) searchParams.afterId = query.afterId;
      if (query.cursor) searchParams.cursor = query.cursor;
      if (query.source) searchParams.sources = query.source;
      if (query.sources) searchParams.sources = query.sources;
      if (query.sourceTags) searchParams.sourceTags = query.sourceTags;
      if (query.includeContent) searchParams.includeContent = query.includeContent;

      if (query.lang) searchParams.locale = query.lang;

      if (query.limit) searchParams.limit = query.limit;
      if (query.minScore !== undefined) searchParams.minScore = query.minScore;
      if (query.orderBy) searchParams.orderBy = query.orderBy;

      const headers: Record<string, string> = {};
      if (config.apiToken) {
        headers['Authorization'] = `Bearer ${config.apiToken}`;
      }

      const timeoutMs = (config.requestTimeoutSecs ?? 30) * 1000;
      const { data } = await requestJsonWithRetry<any>({
        url,
        method: 'GET',
        headers,
        query: searchParams,
        timeoutMs,
        retry: this.retryConfig,
      });

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to search news: ${error.message}`);
      throw error;
    }
  }

  public async fetchNewsContent(newsId: string, data: FetchNewsContentDto) {
    this.logger.debug(
      `fetchNewsContent called for ${newsId}, contentLength: ${data.contentLength}, force: ${data.force}`,
    );

    const config = this.configService.get<NewsConfig>('news')!;
    let baseUrl = config.serviceUrl.replace(/\/$/, '');
    if (!baseUrl.endsWith('/api/v1')) baseUrl += '/api/v1';

    try {
      const timeoutMs = (config.requestTimeoutSecs ?? 30) * 1000;

      let statusCode: number;
      let responseText: string;
      // If contentLength is 0 or no value (undefined/null), or force is true, we call refresh
      if (!data.contentLength || data.force) {
        this.logger.debug(`Refreshing news content for ${newsId}`);
        const url = `${baseUrl}/news/${newsId}/refresh`;

        let fingerprint: any = {};
        if (config.refreshFingerprint) {
          try {
            fingerprint = JSON.parse(config.refreshFingerprint);
          } catch (e) {
            this.logger.warn(
              `Failed to parse refreshFingerprint config: ${config.refreshFingerprint}`,
            );
          }
        }

        // We do not pass locale here, letting the microservice use the stored news item locale
        // to ensure consistency with the locale used during the initial crawling (listing).

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
        };

        const result = await requestTextWithRetry({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify({
            fingerprint,
            mode: config.refreshMode,
          }),
          timeoutMs,
          retry: this.retryConfig,
        });

        statusCode = result.statusCode;
        responseText = result.text;
      } else {
        // Otherwise we just GET the news item which should already have content
        this.logger.debug(`Fetching existing news content for ${newsId}`);
        const url = `${baseUrl}/news/${newsId}`;

        // We do not pass locale query param to avoid implicit translation;
        // we want the item as it exists in the DB (original language/state).

        const headers: Record<string, string> = {};
        if (config.apiToken) {
          headers['Authorization'] = `Bearer ${config.apiToken}`;
        }

        const result = await requestTextWithRetry({
          url,
          method: 'GET',
          headers,
          timeoutMs,
          retry: this.retryConfig,
        });

        statusCode = result.statusCode;
        responseText = result.text;
      }

      if (statusCode >= 400) {
        this.logger.error(`News microservice returned ${statusCode}: ${responseText}`);

        // If it failed and we have fallback data, use it
        if (data.title || data.description) {
          this.logger.warn(
            `Using fallback data for news ${newsId} after service error ${statusCode}`,
          );
          return {
            title: data.title,
            content: data.description,
            description: data.description,
          };
        }

        throw new Error(`News microservice error: ${statusCode}`);
      }

      const result = JSON.parse(responseText || '{}');
      this.logger.debug(
        `Microservice response keys for news ${newsId}: ${Object.keys(result).join(', ')}`,
      );

      // Extract data with proper priority
      // 1. Check result.item (new API)
      // 2. Check result top level (original API/compatibility)
      const item = result.item || result;

      const content = item.content || item.body || item.text || item.original?.content;
      const title = item.title || item.original?.title || data.title;
      const description =
        item.description || item.summary || item.original?.description || data.description;

      // If we got an empty content from refresh/get, try fallback
      if (!content && (data.title || data.description)) {
        this.logger.warn(
          `No content found in microservice response for news ${newsId}, using fallback from DTO (description length: ${data.description?.length})`,
        );
        return {
          ...result,
          title: title || data.title,
          content: data.description,
          description: description || data.description,
        };
      }

      this.logger.debug(
        `Successfully fetched content for news ${newsId} (length: ${content?.length})`,
      );

      return {
        ...result,
        title,
        content,
        description,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch news content: ${error.message}`);

      // Attempt fallback on catch as well
      if (data.title || data.description) {
        this.logger.warn(
          `Using fallback data for news ${newsId} after exception: ${error.message}`,
        );
        return {
          title: data.title,
          content: data.description,
          description: data.description,
        };
      }
      throw error;
    }
  }
}
