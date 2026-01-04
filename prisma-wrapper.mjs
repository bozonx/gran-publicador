#!/usr/bin/env node

/**
 * Wrapper script for Prisma CLI commands.
 * This script sets up DATABASE_URL from DATA_DIR before running Prisma commands.
 */

import { config } from 'dotenv';
import { join } from 'path';
import { spawn } from 'child_process';

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development';
config({ path: join(process.cwd(), `.env.${nodeEnv}`) });
config();

// Database filename is hardcoded
const DB_FILENAME = 'gran-publicador.db';

// Get DATA_DIR from environment
const dataDir = process.env.DATA_DIR;

if (!dataDir) {
    console.error('ERROR: DATA_DIR environment variable is not set.');
    console.error('Please set DATA_DIR in your .env file.');
    process.exit(1);
}

// Resolve to absolute path
const absoluteDataDir = join(process.cwd(), dataDir);

// Construct DATABASE_URL
const dbPath = join(absoluteDataDir, DB_FILENAME);
const databaseUrl = `file:${dbPath}`;

console.log(`📁 Data directory: ${absoluteDataDir}`);
console.log(`📊 Database file: ${DB_FILENAME}`);
console.log(`🔗 Database URL: ${databaseUrl}`);
console.log('');

// Get Prisma command arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('ERROR: No Prisma command specified.');
    console.error('Usage: node prisma-wrapper.mjs <prisma-command>');
    console.error('Example: node prisma-wrapper.mjs migrate dev');
    process.exit(1);
}

// Run Prisma CLI with DATABASE_URL set
const prisma = spawn('npx', ['prisma', ...args], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: true,
});

prisma.on('close', (code) => {
    process.exit(code || 0);
});
