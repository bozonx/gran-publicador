import type { PostRequestDto } from '../dto/social-posting.dto.js';
import type { FormatterParams } from './strategies/abstract-platform.formatter.js';
import { TelegramFormatter } from './strategies/telegram.formatter.js';
import { DefaultFormatter } from './strategies/default.formatter.js';

// Export FormatterParams type for external use/compatibility
export type { FormatterParams } from './strategies/abstract-platform.formatter.js';

export class SocialPostingRequestFormatter {
  private static strategies = {
    TELEGRAM: new TelegramFormatter(),
    DEFAULT: new DefaultFormatter(),
  };

  /**
   * Prepares the request object for the posting library.
   */
  static prepareRequest(params: FormatterParams): PostRequestDto {
    const { channel } = params;
    const platform = channel.socialMedia;

    // Select strategy
    const strategy =
      this.strategies[platform as keyof typeof this.strategies] || this.strategies.DEFAULT;

    return strategy.format(params);
  }
}
