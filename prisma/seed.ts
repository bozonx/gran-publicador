import {
  PrismaClient,
  SocialMedia,
  PostType,
  PostStatus,
  PublicationStatus,
  NotificationType,
  LlmPromptTemplateCategory,
  ContentLibraryTabType,
} from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { getDatabaseUrl } from '../src/config/database.config.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/common/constants/default-permissions.constants.js';

// Manual env loading
const nodeEnv = process.env.NODE_ENV || 'development';
config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
config();

// getDatabaseUrl() will throw if DATA_DIR is not set
const url = getDatabaseUrl();
console.log('Using DB URL:', url);

const pool = new pg.Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting comprehensive seeding...');

  // 1. CLEAR OLD DATA
  console.log('  Cleaning up old data...');
  // Delete in order to respect FK constraints
  await prisma.apiTokenProject.deleteMany({});
  await prisma.apiToken.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.publicationMedia.deleteMany({});

  // Content Library cleanup
  await prisma.publicationContentItem.deleteMany({});
  await prisma.contentBlockMedia.deleteMany({});
  await prisma.contentBlock.deleteMany({});
  await prisma.contentItem.deleteMany({});
  await prisma.contentLibraryTab.deleteMany({});

  await prisma.media.deleteMany({});
  await prisma.publication.deleteMany({});
  await prisma.authorSignature.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.projectNewsQuery.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.llmPromptTemplate.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. CREATE TEST USERS
  const devTelegramId = BigInt(
    process.env.TELEGRAM_ADMIN_ID || process.env.VITE_DEV_TELEGRAM_ID || '123456789',
  );

  const users = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      telegramId: devTelegramId,
      telegramUsername: 'dev_user',
      fullName: 'Developer',
      isAdmin: true,
      language: 'ru-RU',
      uiLanguage: 'ru-RU',
      preferences: {
        theme: 'dark',
        notifications: {
          PUBLICATION_FAILED: { internal: true, telegram: true },
          PROJECT_INVITE: { internal: true, telegram: true },
          SYSTEM: { internal: true, telegram: true },
          NEW_NEWS: { internal: true, telegram: true },
        },
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      telegramId: 111111111n,
      telegramUsername: 'anna_editor',
      fullName: 'Anna Editor',
      isAdmin: false,
      language: 'ru-RU',
      uiLanguage: 'ru-RU',
      preferences: {},
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      telegramId: 987654321n,
      telegramUsername: 'viewer_user',
      fullName: 'Victor Viewer',
      isAdmin: false,
      language: 'en-US',
      uiLanguage: 'en-US',
      preferences: {},
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      telegramId: 222222222n,
      telegramUsername: 'alex_admin',
      fullName: 'Alex Admin',
      isAdmin: true,
      language: 'ru-RU',
      uiLanguage: 'ru-RU',
      preferences: {},
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: u,
      create: u,
    });
  }

  const devUser = users[0];
  const editorUser = users[1];
  const viewerUser = users[2];
  const adminUser = users[3];

  // 3. CREATE DIVERSE PROJECTS
  const projectData = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Future Tech 🚀',
      description:
        'Advanced tutorials on Node.js, Rust and AI agents. Target audience: Professional developers.',
      ownerId: devUser.id,
      preferences: {},
    },
    {
      id: '11111111-1111-4111-8111-111111111112',
      name: 'Travel Chronicles 🌍',
      description:
        'Photo stories from around the world. Budget travel tips and luxury resort reviews.',
      ownerId: devUser.id,
      preferences: {},
    },
    {
      id: '11111111-1111-4111-8111-111111111113',
      name: 'Finance & Crypto 💰',
      description: 'Market analysis and investment strategies. Not financial advice.',
      ownerId: adminUser.id,
      preferences: {},
    },
    {
      id: '11111111-1111-4111-8111-111111111114',
      name: 'Healthy Lifestyle 🥗',
      description: null,
      ownerId: devUser.id,
      preferences: {},
    },
    {
      id: '11111111-1111-4111-8111-111111111115',
      name: 'UI Stress Test Project 🧪',
      description:
        'A project designed specifically to break the UI with long strings and edge cases.',
      ownerId: devUser.id,
      preferences: {},
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Pagination Test Project 📑',
      description: 'Project specifically for testing pagination with many posts.',
      ownerId: devUser.id,
      preferences: {},
    },
    {
      id: '11111111-1111-4111-8111-111111111116',
      name: 'Stale Test Project 🕸️',
      description: 'Project for testing stale channel warnings.',
      ownerId: devUser.id,
      preferences: {},
    },
    {
      id: '11111111-1111-4111-8111-111111111117',
      name: 'Problematic Project ⚠️',
      description: 'Project with various problems regarding activity and channels.',
      ownerId: devUser.id,
      preferences: {},
    },
  ];

  for (const p of projectData) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: p,
      create: p,
    });

    // CREATE SYSTEM ROLES FOR EACH PROJECT
    const roles = [
      {
        id: p.id.replace(/^........-..../, '00000000-0001'),
        projectId: p.id,
        name: 'Admin',
        systemType: 'ADMIN',
        isSystem: true,
        permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN as any,
      },
      {
        id: p.id.replace(/^........-..../, '00000000-0002'),
        projectId: p.id,
        name: 'Editor',
        systemType: 'EDITOR',
        isSystem: true,
        permissions: DEFAULT_ROLE_PERMISSIONS.EDITOR as any,
      },
      {
        id: p.id.replace(/^........-..../, '00000000-0003'),
        projectId: p.id,
        name: 'Viewer',
        systemType: 'VIEWER',
        isSystem: true,
        permissions: DEFAULT_ROLE_PERMISSIONS.VIEWER as any,
      },
    ];

    for (const role of roles) {
      await prisma.role.upsert({
        where: { id: role.id },
        update: role,
        create: role,
      });
    }

    // ADD OWNER AS ADMIN MEMBER
    const ownerRole = roles.find(r => r.systemType === 'ADMIN')!;
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: p.id, userId: p.ownerId } },
      update: { roleId: ownerRole.id },
      create: {
        projectId: p.id,
        userId: p.ownerId,
        roleId: ownerRole.id,
      },
    });
  }

  // 3.1 PROJECT NEWS QUERIES
  console.log('  Generating news queries...');
  const newsQueries = [
    {
      id: '90000000-0000-4000-8000-000000000001',
      projectId: projectData[0].id,
      name: 'Node.js News',
      settings: {
        q: 'Node.js',
        mode: 'all',
        lang: 'ru-RU',
        sourceTags: ['programming', 'tech'],
        minScore: 0.6,
      },
      isNotificationEnabled: true,
      order: 0,
    },
    {
      id: '90000000-0000-4000-8000-000000000002',
      projectId: projectData[0].id,
      name: 'Rust Development',
      settings: { q: 'Rust lang', mode: 'all', lang: 'en-US', newsTags: ['rust', 'systems'] },
      isNotificationEnabled: false,
      order: 1,
    },
  ];

  for (const nq of newsQueries) {
    await prisma.projectNewsQuery.upsert({
      where: { id: nq.id },
      update: nq,
      create: nq,
    });
  }

  // 3.2 CONTENT LIBRARY TABS
  console.log('  Generating content library tabs...');
  const contentLibraryTabs = [
    {
      id: 'tab10000-0000-4000-8000-000000000001',
      type: ContentLibraryTabType.FOLDER,
      title: 'Common Assets',
      projectId: projectData[0].id,
      order: 0,
      config: {},
    },
    {
      id: 'tab10000-0000-4000-8000-000000000002',
      type: ContentLibraryTabType.SAVED_VIEW,
      title: 'Recent Images',
      projectId: projectData[0].id,
      order: 1,
      config: { filter: { type: 'IMAGE' } },
    },
  ];

  for (const tab of contentLibraryTabs) {
    await prisma.contentLibraryTab.upsert({
      where: { id: tab.id },
      update: tab,
      create: tab,
    });
  }

  // 4. PROJECT MEMBERSHIPS (GUESTS)
  console.log('  Adding guest memberships...');

  // Helper to get role ID by project and type (using our new ID pattern)
  const getRoleId = (projectId: string, systemType: string) => {
    const prefix =
      systemType === 'ADMIN'
        ? '00000000-0001'
        : systemType === 'EDITOR'
          ? '00000000-0002'
          : '00000000-0003';
    return projectId.replace(/^........-..../, prefix);
  };

  const project1Id = projectData[0].id;
  const project3Id = projectData[2].id;

  const memberships = [
    { projectId: project1Id, userId: editorUser.id, roleId: getRoleId(project1Id, 'EDITOR') },
    { projectId: project1Id, userId: viewerUser.id, roleId: getRoleId(project1Id, 'VIEWER') },
    { projectId: project3Id, userId: devUser.id, roleId: getRoleId(project3Id, 'ADMIN') },
  ];

  for (const m of memberships) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: m.projectId, userId: m.userId } },
      update: { roleId: m.roleId },
      create: m,
    });
  }

  // 5. CHANNELS
  console.log('  Generating channels...');
  const channelData = [
    {
      id: '22222222-2222-4222-8222-222222222221',
      projectId: projectData[0].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Main Tech Channel',
      channelIdentifier: '@tech_main',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100123' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      projectId: projectData[0].id,
      socialMedia: SocialMedia.YOUTUBE,
      name: 'Tech Tutorials YT',
      channelIdentifier: 'UC_TechTuts',
      language: 'en-US',
      isActive: true,
      credentials: { token: 'valid' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222223',
      projectId: projectData[1].id,
      socialMedia: SocialMedia.VK,
      name: 'Wanderlust VK',
      channelIdentifier: 'wander_vk_page',
      language: 'ru-RU',
      isActive: true,
      credentials: { vkAccessToken: 'vk_tok' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222224',
      projectId: projectData[1].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Travel Daily',
      channelIdentifier: '@travel_daily',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100124' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222225',
      projectId: projectData[2].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Crypto Signals',
      channelIdentifier: '@crypto_signals',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100130' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222226',
      projectId: projectData[0].id,
      socialMedia: SocialMedia.TIKTOK,
      name: 'Tech Shorts',
      channelIdentifier: '@tech_shorts',
      language: 'en-US',
      isActive: true,
      credentials: { token: 'tok' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222227',
      projectId: projectData[4].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Stress Test Channel',
      channelIdentifier: '@stress_test',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100125' },
      preferences: {},
    },
    {
      id: '99999999-9999-4999-8999-999999999999',
      projectId: projectData[5].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Pagination Channel',
      channelIdentifier: '@pag_test',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100126' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222228',
      projectId: projectData[6].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Stale Channel',
      channelIdentifier: '@stale_channel',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100127' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222230',
      projectId: projectData[7].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'No Credentials Channel',
      channelIdentifier: '@no_creds',
      language: 'ru-RU',
      isActive: true,
      credentials: {},
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222231',
      projectId: projectData[7].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Inactive Channel',
      channelIdentifier: '@inactive_ch',
      language: 'ru-RU',
      isActive: false,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100128' },
      preferences: {},
    },
    {
      id: '22222222-2222-4222-8222-222222222232',
      projectId: projectData[7].id,
      socialMedia: SocialMedia.TELEGRAM,
      name: 'Failed Posts Channel',
      channelIdentifier: '@failed_posts',
      language: 'ru-RU',
      isActive: true,
      credentials: { telegramBotToken: '123:abc', telegramChannelId: '-100129' },
      preferences: {},
    },
  ];

  for (const c of channelData) {
    await prisma.channel.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }

  // 5.1 AUTHOR SIGNATURES
  console.log('  Generating author signatures...');
  const authorSignatures = [
    {
      id: 'eee11111-1111-4111-8111-111111111111',
      userId: devUser.id,
      channelId: channelData[0].id, // Tech Main
      name: 'Standard Signature',
      content: '\n---\n*Sent via Gran Publicador*',
      isDefault: true,
      order: 0,
    },
    {
      id: 'eee11112-1111-4111-8111-111111111111',
      userId: devUser.id,
      channelId: channelData[0].id,
      name: 'Follow us',
      content: "\n---\n**Don't forget to subscribe!**",
      isDefault: false,
      order: 1,
    },
  ];

  for (const sig of authorSignatures) {
    await prisma.authorSignature.upsert({
      where: { id: sig.id },
      update: sig,
      create: sig,
    });
  }

  // 6. PUBLICATIONS
  const translationGroup1 = '55555555-5555-4555-8555-555555555551';
  const publications = [
    {
      id: '44444444-4444-4444-8444-444444444441',
      projectId: projectData[0].id,
      createdBy: devUser.id,
      title: 'Intro to Nuxt 4',
      description: 'Brief overview of new Nuxt 4 features.',
      content: '<h1>Mastering Nuxt 4</h1>',
      authorComment: 'Important post.',
      tags: 'nuxt,vue,frontend',
      status: PublicationStatus.PUBLISHED,
      postType: PostType.ARTICLE,
      postDate: new Date(2025, 0, 1),
      language: 'ru-RU',
      translationGroupId: translationGroup1,
      meta: {},
    },
    {
      id: '44444444-4444-4444-8444-444444444445',
      projectId: projectData[0].id,
      createdBy: devUser.id,
      title: 'Introduction to Nuxt 4',
      content: '<h1>Mastering Nuxt 4</h1>',
      tags: 'nuxt,vue,frontend',
      status: PublicationStatus.PUBLISHED,
      postType: PostType.ARTICLE,
      language: 'en-US',
      translationGroupId: translationGroup1,
      meta: {},
    },
    {
      id: '44444444-4444-4444-8444-444444444442',
      projectId: projectData[1].id,
      createdBy: devUser.id,
      title: 'Top 5 Kyoto',
      content: '<p>Kyoto is great.</p>',
      tags: 'kyoto,japan',
      status: PublicationStatus.PUBLISHED,
      postType: PostType.POST,
      language: 'ru-RU',
      meta: {},
    },
    {
      id: '44444444-4444-4444-8444-444444444443',
      projectId: projectData[2].id,
      createdBy: adminUser.id,
      title: 'Bitcoin 2025',
      content: '<p>BTC Analysis...</p>',
      tags: 'crypto,bitcoin',
      status: PublicationStatus.SCHEDULED,
      postType: PostType.NEWS,
      language: 'ru-RU',
      meta: {},
    },
    {
      id: '44444444-4444-4444-8444-444444444460',
      projectId: projectData[6].id,
      createdBy: devUser.id,
      title: 'Old Post',
      content: 'Old content',
      status: PublicationStatus.PUBLISHED,
      postType: PostType.POST,
      language: 'ru-RU',
      meta: {},
    },
    {
      id: '44444444-4444-4444-8444-444444444481',
      projectId: projectData[7].id,
      createdBy: devUser.id,
      title: 'Failed in Prob Project',
      content: 'Failed',
      status: PublicationStatus.FAILED,
      postType: PostType.POST,
      language: 'ru-RU',
      meta: {},
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: '44444444-4444-4444-8444-444444444490',
      projectId: projectData[4].id,
      createdBy: devUser.id,
      title: 'UI Stress Test Publication',
      content: '<h1>Testing UI Layouts</h1><p>This is a publication for project 4.</p>',
      status: PublicationStatus.PUBLISHED,
      postType: PostType.ARTICLE,
      meta: {},
      createdAt: new Date(),
    },
    {
      id: '44444444-4444-4444-8444-444444444470',
      projectId: projectData[0].id,
      createdBy: devUser.id,
      title: 'News Derived Post',
      content: '<p>Content derived from news item...</p>',
      status: PublicationStatus.DRAFT,
      postType: PostType.NEWS,
      language: 'ru-RU',
      newsItemId: 'news-item-123456789',
      meta: { originalUrl: 'https://example.com/news/123' },
      createdAt: new Date(),
    },
  ];

  for (const pub of publications) {
    const pubData = {
      ...pub,
      effectiveAt: (pub as any).postDate || (pub as any).createdAt || new Date(),
    };
    await prisma.publication.upsert({
      where: { id: pub.id },
      update: pubData,
      create: pubData,
    });
  }

  // 7. POSTS
  const posts = [
    {
      id: '33333333-3333-4333-8333-333333333331',
      publicationId: publications[0].id,
      channelId: channelData[0].id,
      socialMedia: 'TELEGRAM',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 3600000),
      meta: {},
      platformOptions: { disableNotification: true },
    },
    {
      id: '33333333-3333-4333-8333-333333333360',
      publicationId: publications[4].id,
      channelId: channelData[7].id,
      socialMedia: 'TELEGRAM',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      meta: {},
    },
    {
      id: '33333333-3333-4333-8333-333333333380',
      publicationId: publications[5].id,
      channelId: channelData[10].id,
      socialMedia: 'TELEGRAM',
      status: PostStatus.FAILED,
      errorMessage: 'API error',
      meta: {},
    },
    {
      id: '33333333-3333-4333-8333-333333333390',
      publicationId: '44444444-4444-4444-8444-444444444490',
      channelId: '22222222-2222-4222-8222-222222222227',
      socialMedia: 'TELEGRAM',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      meta: {},
    },
  ];

  for (const post of posts) {
    await prisma.post.upsert({
      where: { id: post.id },
      update: post,
      create: post,
    });
  }

  // 8. PAGINATION
  console.log('  Generating 30 publications...');
  const pagProjectId = projectData[5].id;
  const pagChannelId = channelData[6].id;
  for (let i = 1; i <= 30; i++) {
    const pubId = `77777777-7777-4777-8777-${i.toString().padStart(12, '0')}`;
    const postId = `66666666-6666-4666-8666-${i.toString().padStart(12, '0')}`;
    await prisma.publication.upsert({
      where: { id: pubId },
      create: {
        id: pubId,
        projectId: pagProjectId,
        createdBy: devUser.id,
        title: `Pagination Post ${i}`,
        content: `Content ${i}`,
        status: PublicationStatus.PUBLISHED,
        postType: PostType.POST,
        language: 'ru-RU',
        meta: {},
        effectiveAt: new Date(Date.now() - 1000 * 60 * 60 * i),
      },
      update: {},
    });
    await prisma.post.upsert({
      where: { id: postId },
      create: {
        id: postId,
        publicationId: pubId,
        channelId: pagChannelId,
        socialMedia: 'TELEGRAM',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * i),
        meta: {},
      },
      update: {},
    });
  }

  // 9. MEDIA & PUBLICATION MEDIA
  console.log('  Generating media data...');
  const mediaSamples = [
    {
      id: '99999999-9999-4999-8999-000000000001',
      type: 'IMAGE' as const,
      storageType: 'FS' as const,
      storagePath: 'samples/image1.jpg',
      filename: 'image1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024n * 100n,
      meta: {},
    },
    {
      id: '99999999-9999-4999-8999-000000000002',
      type: 'VIDEO' as const,
      storageType: 'FS' as const,
      storagePath: 'samples/video1.mp4',
      filename: 'video1.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1024n * 1024n * 5n,
      meta: {},
    },
  ];

  for (const m of mediaSamples) {
    await prisma.media.upsert({
      where: { id: m.id },
      update: m,
      create: m,
    });
  }

  await prisma.publicationMedia.upsert({
    where: { id: '99999999-9999-4999-8999-100000000001' },
    update: {},
    create: {
      id: '99999999-9999-4999-8999-100000000001',
      publicationId: publications[0].id,
      mediaId: mediaSamples[0].id,
      order: 0,
    },
  });

  // 10. API TOKENS (Skipped in seed as they require encryption)
  // console.log('  Generating API tokens...');
  /*
    await prisma.apiToken.upsert({
        where: { hashedToken: 'mock-hashed-dev-token' },
        update: {},
        create: {
            id: '00000000-0000-4000-8000-00000000000a',
            userId: devUser.id,
            name: 'Dev Local Token',
            hashedToken: 'mock-hashed-dev-token',
            encryptedToken: 'mock-encrypted-dev-token',
            scopeProjectIds: [projectData[0].id],
        }
    });
    */

  // 11. NOTIFICATIONS
  console.log('  Generating notifications...');
  const notificationData = [
    {
      id: 'ccccccc1-cccc-4ccc-8ccc-cccccccccccc',
      userId: devUser.id,
      type: NotificationType.PUBLICATION_FAILED,
      title: 'Publication Error',
      message: 'Failed to publish post "Intro to Nuxt 4" to Telegram.',
      meta: { publicationId: publications[0].id, channelId: channelData[0].id },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      readAt: null,
    },
    {
      id: 'ccccccc2-cccc-4ccc-8ccc-cccccccccccc',
      userId: devUser.id,
      type: NotificationType.PROJECT_INVITE,
      title: 'Project Invitation',
      message: 'Alex Admin invited you to project "Finance & Crypto 💰".',
      meta: { projectId: projectData[2].id },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      readAt: new Date(Date.now() - 1000 * 60 * 60 * 23),
    },
    {
      id: 'ccccccc3-cccc-4ccc-8ccc-cccccccccccc',
      userId: devUser.id,
      type: NotificationType.SYSTEM,
      title: 'System Update',
      message: 'System was updated to version 1.2.0. Check out the new features.',
      meta: {},
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      readAt: null,
    },
  ];

  for (const n of notificationData) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: n,
      create: n,
    });
  }

  // 12. PROMPT TEMPLATES
  console.log('  Generating prompt templates...');
  const promptTemplates = [
    // Personal templates for devUser
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: devUser.id,
      projectId: null,
      name: 'Summarize for Telegram',
      description: 'Creates a short summary for Telegram posts',
      category: LlmPromptTemplateCategory.CONTENT,
      prompt:
        'Summarize the following text for a Telegram post. Keep it under 500 characters. Use emojis.',
      order: 0,
    },
    // Project templates
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-baaaaaaaaaaa',
      userId: null,
      projectId: projectData[0].id,
      name: 'Technical Tone Rewriter',
      description: 'Rewrites text in a technical tone',
      category: LlmPromptTemplateCategory.EDITING,
      prompt:
        'Rewrite the following text to sound more technical and professional. Use appropriate terminology.',
      order: 0,
    },
  ];

  for (const pt of promptTemplates) {
    await prisma.llmPromptTemplate.upsert({
      where: { id: pt.id },
      update: pt,
      create: pt,
    });
  }

  // 13. CONTENT LIBRARY
  console.log('  Generating content library...');
  const contentItems = [
    {
      id: 'cccc1111-1111-4111-8111-111111111111',
      userId: null,
      projectId: projectData[0].id,
      title: 'Draft Idea: Nuxt 5 Predictions',
      tags: ['nuxt', 'future', 'speculation'],
      folderId: 'tab10000-0000-4000-8000-000000000001',
      note: 'Just some random thoughts',
      blocks: [
        {
          id: 'cblk1111-1111-4111-8111-111111111111',
          text: 'Nuxt 5 might introduce native AI integration...',
          order: 0,
          meta: {},
          media: [],
        },
      ],
    },
    {
      id: 'cccc1111-1111-4111-8111-111111111112',
      userId: null,
      projectId: projectData[0].id,
      title: 'Cool Image for Post',
      tags: ['image', 'asset'],
      folderId: 'tab10000-0000-4000-8000-000000000001',
      note: 'To be used in upcoming posts',
      blocks: [
        {
          id: 'cblk1111-1111-4111-8111-111111111112',
          text: null,
          order: 0,
          meta: {},
          media: [
            {
              id: 'cbm11111-1111-4111-8111-111111111111',
              mediaId: mediaSamples[0].id,
              order: 0,
              hasSpoiler: false,
            },
          ],
        },
      ],
    },
    {
      id: 'cccc1111-1111-4111-8111-111111111113',
      userId: null,
      projectId: projectData[1].id,
      title: 'Travel Log Segment',
      tags: ['travel', 'raw'],
      note: null,
      blocks: [
        {
          id: 'cblk1111-1111-4111-8111-111111111113',
          text: 'Arrived in Tokyo at 5 AM. The city was already awake.',
          order: 0,
          meta: {},
          media: [
            {
              id: 'cbm11111-1111-4111-8111-111111111112',
              mediaId: mediaSamples[1].id,
              order: 1,
              hasSpoiler: false,
            },
          ],
        },
      ],
    },
    {
      id: 'cccc1111-1111-4111-8111-111111111114',
      userId: null,
      projectId: projectData[0].id,
      title: 'Archived: Old snippet',
      tags: ['archived', 'example'],
      note: 'This item is archived to test trash flow',
      archivedBy: devUser.id,
      blocks: [
        {
          id: 'cblk1111-1111-4111-8111-111111111114',
          text: 'This content item is in archive.',
          order: 0,
          meta: {},
          media: [],
        },
      ],
    },
    {
      id: 'cccc1111-1111-4111-8111-111111111115',
      userId: devUser.id,
      projectId: null,
      title: 'Personal: Quick snippet',
      tags: ['personal', 'snippet'],
      note: null,
      blocks: [
        {
          id: 'cblk1111-1111-4111-8111-111111111115',
          text: 'Personal library item example.',
          order: 0,
          meta: {},
          media: [],
        },
      ],
    },
  ];

  for (const item of contentItems) {
    const { blocks, ...itemData } = item;
    await prisma.contentItem.upsert({
      where: { id: item.id },
      update: itemData,
      create: itemData,
    });

    for (const block of blocks) {
      const { media, ...blockData } = block;
      await prisma.contentBlock.upsert({
        where: { id: block.id },
        update: blockData,
        create: {
          ...blockData,
          contentItemId: item.id,
        },
      });

      for (const m of media) {
        await prisma.contentBlockMedia.upsert({
          where: { id: m.id },
          update: m,
          create: {
            ...m,
            contentBlockId: block.id,
          },
        });
      }
    }
  }

  // Link content item to publication
  await prisma.publicationContentItem.upsert({
    where: {
      publicationId_contentItemId: {
        publicationId: publications[0].id,
        contentItemId: contentItems[0].id,
      },
    },
    update: {},
    create: {
      publicationId: publications[0].id,
      contentItemId: contentItems[0].id,
      order: 0,
    },
  });

  console.log('✅ Seeding finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
