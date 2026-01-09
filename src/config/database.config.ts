import { join, resolve } from 'path';

/**
 * Database configuration constants and utilities.
 */

/**
 * Hardcoded database filename.
 * This ensures consistent database naming across all environments.
 */
export const DB_FILENAME = 'gran-publicador.db';

/**
 * Generates the DATABASE_URL from the DATA_DIR environment variable.
 * The database filename is hardcoded as 'gran-publicador.db'.
 *
 * @returns The complete DATABASE_URL in SQLite format (file:...)
 * @throws Error if DATA_DIR is not set
 */
export function getDatabaseUrl(): string {
  const dataDir = process.env.DATA_DIR;

  if (!dataDir) {
    throw new Error(
      'DATA_DIR environment variable is not set. Please set it to the directory where the database should be stored.',
    );
  }

  // Resolve relative paths to absolute paths
  // If dataDir is already absolute (starts with /), resolve will return it as-is
  // If it's relative (e.g., ./test-data), it will be resolved relative to cwd
  const absoluteDataDir = resolve(process.cwd(), dataDir);

  // Construct the full path to the database file in the /db subdirectory
  const dbPath = join(absoluteDataDir, 'db', DB_FILENAME);

  // Return in SQLite URL format
  return `file:${dbPath}`;
}

/**
 * Gets the DATA_DIR from environment variables.
 * This is the directory where the database file will be stored.
 *
 * @returns The DATA_DIR path
 * @throws Error if DATA_DIR is not set
 */
export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR;

  if (!dataDir) {
    throw new Error('DATA_DIR environment variable is not set.');
  }

  return dataDir;
}

/**
 * Gets the absolute path to the directory where the database file is stored.
 * This is {DATA_DIR}/db.
 *
 * @returns The absolute path to the database directory
 * @throws Error if DATA_DIR is not set
 */
export function getDatabaseDirectory(): string {
  const dataDir = getDataDir();
  return join(resolve(process.cwd(), dataDir), 'db');
}

