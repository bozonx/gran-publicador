/**
 * Database transaction timeout constants
 */
export const TRANSACTION_TIMEOUT = {
  /**
   * Maximum time to wait for a transaction to start (in milliseconds)
   */
  MAX_WAIT: 5000,

  /**
   * Maximum time for a transaction to complete (in milliseconds)
   */
  TIMEOUT: 10000,
} as const;
