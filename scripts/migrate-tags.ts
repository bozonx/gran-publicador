import { PrismaClient } from '../src/generated/prisma/index.js';
import { normalizeTags, parseTags } from '../src/common/utils/tags.util.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const { Pool } = pg;

// Load environment variables manually
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const url = process.env.DATABASE_URL;
console.log('DATABASE_URL from process.env:', url);

if (!url) {
  console.error('DATABASE_URL is not defined in .env.development');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function migrateTags() {
  console.log('Starting tag migration...');

  // 1. Migrate ContentItem tags
  console.log('Migrating ContentItem tags...');
  const contentItems = await prisma.contentItem.findMany({
    where: {
      tags: { isEmpty: false },
    },
    select: {
      id: true,
      tags: true,
      projectId: true,
      userId: true,
    },
  });

  for (const item of contentItems) {
    const tags = normalizeTags(item.tags);
    if (tags.length === 0) continue;

    console.log(`Updating ContentItem ${item.id} with tags: ${tags.join(', ')}`);
    try {
      await prisma.contentItem.update({
        where: { id: item.id },
        data: {
          tagObjects: {
            connectOrCreate: tags.map(name => {
              if (item.projectId) {
                return {
                  where: { projectId_name: { projectId: item.projectId, name } },
                  create: { name, projectId: item.projectId },
                };
              } else {
                return {
                  where: { userId_name: { userId: item.userId!, name } },
                  create: { name, userId: item.userId },
                };
              }
            }),
          },
        },
      });
    } catch (err) {
      console.error(`Failed to update ContentItem ${item.id}:`, err);
    }
  }
  console.log(`Processed ${contentItems.length} ContentItems.`);

  // 2. Migrate Publication tags
  console.log('Migrating Publication tags...');
  const publications = await prisma.publication.findMany({
    where: {
      tags: { not: null, not: '' },
    },
    select: {
      id: true,
      tags: true,
      projectId: true,
    },
  });

  for (const pub of publications) {
    const tags = normalizeTags(parseTags(pub.tags!));
    if (tags.length === 0) continue;

    console.log(`Updating Publication ${pub.id} with tags: ${tags.join(', ')}`);
    try {
      await prisma.publication.update({
        where: { id: pub.id },
        data: {
          tagObjects: {
            connectOrCreate: tags.map(name => ({
              where: { projectId_name: { projectId: pub.projectId, name } },
              create: { name, projectId: pub.projectId },
            })),
          },
        },
      });
    } catch (err) {
      console.error(`Failed to update Publication ${pub.id}:`, err);
    }
  }
  console.log(`Processed ${publications.length} Publications.`);

  // 3. Migrate Post tags
  console.log('Migrating Post tags...');
  const posts = await prisma.post.findMany({
    where: {
      tags: { not: null, not: '' },
    },
    include: {
      channel: {
        select: { projectId: true },
      },
    },
  });

  for (const post of posts) {
    const tags = normalizeTags(parseTags(post.tags!));
    if (tags.length === 0) continue;

    console.log(`Updating Post ${post.id} with tags: ${tags.join(', ')}`);
    try {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          tagObjects: {
            connectOrCreate: tags.map(name => ({
              where: { projectId_name: { projectId: post.channel.projectId, name } },
              create: { name, projectId: post.channel.projectId },
            })),
          },
        },
      });
    } catch (err) {
      console.error(`Failed to update Post ${post.id}:`, err);
    }
  }
  console.log(`Processed ${posts.length} Posts.`);

  console.log('Tag migration completed successfully.');
}

migrateTags()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
