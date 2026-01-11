import { join, resolve } from 'path';

/**
 * Database configuration constants and utilities.
 */

/**
 * Gets the DATABASE_URL from the environment variable.
 *
 * @returns The complete DATABASE_URL
 * @throws Error if DATABASE_URL is not set
 */
export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error('DATABASE_URL environment variable is not set.');
}
