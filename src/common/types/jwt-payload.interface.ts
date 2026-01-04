/**
 * Interface representing the JWT payload structure.
 * This payload is decoded from the JWT token and attached to the request.
 */
export interface JwtPayload {
  /** The subject of the token (user ID). */
  sub: string;
  /** The Telegram ID of the user (optional). */
  telegramId?: string;
  /** The username of the user (optional). */
  telegramUsername?: string;
  /** Issued at timestamp. */
  iat?: number;
  /** Expiration timestamp. */
  exp?: number;
}
