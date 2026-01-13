import { PrismaClient, ProjectRole, SocialMedia, PostType, PostStatus, PublicationStatus } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { config } from 'dotenv';
import path from 'path';
import { getDatabaseUrl } from '../src/config/database.config.js';

// Manual env loading
const nodeEnv = process.env.NODE_ENV || 'development';
config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
config();

// getDatabaseUrl() will throw if DATA_DIR is not set
const url = getDatabaseUrl();
console.log('Using DB URL:', url);

const adapter = new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting comprehensive seeding...');

    // 1. CLEAR OLD DATA
    console.log('  Cleaning up old data...');
    // Delete in order to respect FK constraints
    await prisma.apiToken.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.publicationMedia.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.publication.deleteMany({});
    await prisma.channel.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({});

    // 2. CREATE TEST USERS
    const devTelegramId = BigInt(process.env.TELEGRAM_ADMIN_ID || process.env.VITE_DEV_TELEGRAM_ID || '123456789');

    const users = [
        {
            id: '00000000-0000-0000-0000-000000000001',
            telegramId: devTelegramId,
            telegramUsername: 'dev_user',
            fullName: 'Разработчик (Dev)',
            isAdmin: true,
            preferences: {},
        },
        {
            id: '00000000-0000-0000-0000-000000000002',
            telegramId: 111111111n,
            telegramUsername: 'anna_editor',
            fullName: 'Анна Редактор',
            isAdmin: false,
            preferences: {},
        },
        {
            id: '00000000-0000-0000-0000-000000000003',
            telegramId: 987654321n,
            telegramUsername: 'viewer_user',
            fullName: 'Виктор Зритель',
            isAdmin: false,
            preferences: {},
        },
        {
            id: '00000000-0000-0000-0000-000000000004',
            telegramId: 222222222n,
            telegramUsername: 'alex_admin',
            fullName: 'Алексей Админ',
            isAdmin: true,
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
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Технологии Будущего 🚀',
            description: 'Продвинутые туториалы по Node.js, Rust и AI агентам. Целевая аудитория: Профессиональные разработчики.',
            ownerId: devUser.id,
            preferences: {},
        },
        {
            id: '11111111-1111-1111-1111-111111111112',
            name: 'Хроники Путешествий 🌍',
            description: 'Фото-истории со всего мира. Советы по бюджетным поездкам и обзоры элитных курортов.',
            ownerId: devUser.id,
            preferences: {},
        },
        {
            id: '11111111-1111-1111-1111-111111111113',
            name: 'Финансы и Крипто 💰',
            description: 'Анализ рынка и инвестиционные стратегии. Не является финансовой рекомендацией.',
            ownerId: adminUser.id,
            preferences: {},
        },
        {
            id: '11111111-1111-1111-1111-111111111114',
            name: 'Здоровый Образ Жизни 🥗',
            description: null,
            ownerId: devUser.id,
            preferences: {},
        },
        {
            id: '11111111-1111-1111-1111-111111111115',
            name: 'UI Stress Test Project 🧪',
            description: 'A project designed specifically to break the UI with long strings and edge cases.',
            ownerId: devUser.id,
            preferences: {},
        },
        {
            id: '88888888-8888-8888-8888-888888888888',
            name: 'Pagination Test Project 📑',
            description: 'Project specifically for testing pagination with many posts.',
            ownerId: devUser.id,
            preferences: {},
        },
        {
            id: '11111111-1111-1111-1111-111111111116',
            name: 'Stale Test Project 🕸️',
            description: 'Project for testing stale channel warnings.',
            ownerId: devUser.id,
            preferences: {},
        },
        {
            id: '11111111-1111-1111-1111-111111111117',
            name: 'Problematic Project ⚠️',
            description: 'Project with various problems regarding activity and channels.',
            ownerId: devUser.id,
            preferences: {},
        }
    ];

    for (const p of projectData) {
        await prisma.project.upsert({
            where: { id: p.id },
            update: p,
            create: p,
        });
    }

    // 4. PROJECT MEMBERSHIPS (Owners are handled via ownerId, only adding collaborators here)
    const memberships = [
        { projectId: projectData[0].id, userId: editorUser.id, role: ProjectRole.EDITOR },
        { projectId: projectData[0].id, userId: viewerUser.id, role: ProjectRole.VIEWER },
        { projectId: projectData[2].id, userId: devUser.id, role: ProjectRole.ADMIN },
    ];

    for (const m of memberships) {
        await prisma.projectMember.upsert({
            where: { projectId_userId: { projectId: m.projectId, userId: m.userId } },
            update: { role: m.role },
            create: m,
        });
    }

    // 5. CHANNELS
    const channelData = [
        { id: '22222222-2222-2222-2222-222222222221', projectId: projectData[0].id, socialMedia: SocialMedia.TELEGRAM, name: 'Основной Техно-канал', channelIdentifier: '@tech_main', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222222', projectId: projectData[0].id, socialMedia: SocialMedia.YOUTUBE, name: 'Техно-Туториалы YT', channelIdentifier: 'UC_TechTuts', language: 'en-US', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222223', projectId: projectData[1].id, socialMedia: SocialMedia.VK, name: 'Wanderlust VK', channelIdentifier: 'wander_vk_page', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222224', projectId: projectData[1].id, socialMedia: SocialMedia.TELEGRAM, name: 'Путешествия Ежедневно', channelIdentifier: '@travel_daily', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222226', projectId: projectData[0].id, socialMedia: SocialMedia.TIKTOK, name: 'Tech Shorts', channelIdentifier: '@tech_shorts', language: 'en-US', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222227', projectId: projectData[4].id, socialMedia: SocialMedia.TELEGRAM, name: 'Stress Test Channel', channelIdentifier: '@stress_test', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '99999999-9999-9999-9999-999999999999', projectId: projectData[5].id, socialMedia: SocialMedia.TELEGRAM, name: 'Pagination Channel', channelIdentifier: '@pag_test', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222228', projectId: projectData[6].id, socialMedia: SocialMedia.TELEGRAM, name: 'Stale Channel', channelIdentifier: '@stale_channel', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222230', projectId: projectData[7].id, socialMedia: SocialMedia.TELEGRAM, name: 'No Credentials Channel', channelIdentifier: '@no_creds', language: 'ru-RU', isActive: true, credentials: {}, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222231', projectId: projectData[7].id, socialMedia: SocialMedia.TELEGRAM, name: 'Inactive Channel', channelIdentifier: '@inactive_ch', language: 'ru-RU', isActive: false, credentials: { token: 'valid' }, preferences: {} },
        { id: '22222222-2222-2222-2222-222222222232', projectId: projectData[7].id, socialMedia: SocialMedia.TELEGRAM, name: 'Failed Posts Channel', channelIdentifier: '@failed_posts', language: 'ru-RU', isActive: true, credentials: { token: 'valid' }, preferences: {} },
    ];

    for (const c of channelData) {
        await prisma.channel.upsert({
            where: { id: c.id },
            update: c,
            create: c,
        });
    }

    // 6. PUBLICATIONS
    const translationGroup1 = '55555555-5555-5555-5555-555555555551';
    const publications = [
        {
            id: '44444444-4444-4444-4444-444444444441',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'Знакомство с Nuxt 4',
            description: 'Краткий обзор новых возможностей Nuxt 4.',
            content: '<h1>Освоение Nuxt 4</h1>',
            authorComment: 'Важный пост.',
            tags: 'nuxt,vue,frontend',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.ARTICLE,
            postDate: new Date(2025, 0, 1),
            language: 'ru-RU',
            translationGroupId: translationGroup1,
            meta: {},
            sourceTexts: [],
        },
        {
            id: '44444444-4444-4444-4444-444444444445',
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
            sourceTexts: [],
        },
        {
            id: '44444444-4444-4444-4444-444444444442',
            projectId: projectData[1].id,
            createdBy: devUser.id,
            title: 'Топ-5 Киото',
            content: '<p>Киото — это круто.</p>',
            tags: 'киото,япония',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.POST,
            language: 'ru-RU',
            meta: {},
            sourceTexts: [],
        },
        {
            id: '44444444-4444-4444-4444-444444444443',
            projectId: projectData[2].id,
            createdBy: adminUser.id,
            title: 'Биткоин 2025',
            content: '<p>Анализ BTC...</p>',
            tags: 'крипто,биткоин',
            status: PublicationStatus.SCHEDULED,
            postType: PostType.NEWS,
            language: 'ru-RU',
            meta: {},
            sourceTexts: [],
        },
        {
            id: '44444444-4444-4444-4444-444444444460',
            projectId: projectData[6].id,
            createdBy: devUser.id,
            title: 'Old Post',
            content: 'Old content',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.POST,
            language: 'ru-RU',
            meta: {},
            sourceTexts: [],
        },
        {
            id: '44444444-4444-4444-4444-444444444481',
            projectId: projectData[7].id,
            createdBy: devUser.id,
            title: 'Failed in Prob Project',
            content: 'Failed',
            status: PublicationStatus.FAILED,
            postType: PostType.POST,
            language: 'ru-RU',
            meta: {},
            sourceTexts: [],
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }
    ];

    for (const pub of publications) {
        await prisma.publication.upsert({
            where: { id: pub.id },
            update: pub,
            create: pub,
        });
    }

    // 7. POSTS
    const posts = [
        {
            id: '33333333-3333-3333-3333-333333333331',
            publicationId: publications[0].id,
            channelId: channelData[0].id,
            socialMedia: 'TELEGRAM',
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 3600000),
            meta: {},
        },
        {
            id: '33333333-3333-3333-3333-333333333360',
            publicationId: publications[4].id,
            channelId: channelData[7].id,
            socialMedia: 'TELEGRAM',
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            meta: {},
        },
        {
            id: '33333333-3333-3333-3333-333333333380',
            publicationId: publications[5].id,
            channelId: channelData[10].id,
            socialMedia: 'TELEGRAM',
            status: PostStatus.FAILED,
            errorMessage: 'API error',
            meta: {},
        }
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
        const pubId = `77777777-7777-7777-7777-${i.toString().padStart(12, '0')}`;
        const postId = `66666666-6666-6666-6666-${i.toString().padStart(12, '0')}`;
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
                sourceTexts: [],
            },
            update: {}
        });
        await prisma.post.upsert({
            where: { id: postId },
            create: {
                id: postId,
                publicationId: pubId,
                channelId: pagChannelId,
                socialMedia: 'TELEGRAM',
                status: PostStatus.PUBLISHED,
                publishedAt: new Date(Date.now() - (1000 * 60 * 60 * i)),
                meta: {},
            },
            update: {}
        });
    }

    // 9. MEDIA & PUBLICATION MEDIA
    console.log('  Generating media data...');
    const mediaSamples = [
        {
            id: '99999999-9999-9999-9999-000000000001',
            type: 'IMAGE' as const,
            storageType: 'FS' as const,
            storagePath: 'samples/image1.jpg',
            filename: 'image1.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 1024 * 100,
            meta: {},
        },
        {
            id: '99999999-9999-9999-9999-000000000002',
            type: 'VIDEO' as const,
            storageType: 'FS' as const,
            storagePath: 'samples/video1.mp4',
            filename: 'video1.mp4',
            mimeType: 'video/mp4',
            sizeBytes: 1024 * 1024 * 5,
            meta: {},
        }
    ];

    for (const m of mediaSamples) {
        await prisma.media.upsert({
            where: { id: m.id },
            update: m,
            create: m,
        });
    }

    await prisma.publicationMedia.upsert({
        where: { id: '99999999-9999-9999-9999-100000000001' },
        update: {},
        create: {
            id: '99999999-9999-9999-9999-100000000001',
            publicationId: publications[0].id,
            mediaId: mediaSamples[0].id,
            order: 0,
        }
    });

    // 10. API TOKENS
    console.log('  Generating API tokens...');
    await prisma.apiToken.upsert({
        where: { hashedToken: 'mock-hashed-dev-token' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-00000000000a',
            userId: devUser.id,
            name: 'Dev Local Token',
            hashedToken: 'mock-hashed-dev-token',
            encryptedToken: 'mock-encrypted-dev-token',
            scopeProjectIds: [projectData[0].id],
        }
    });

    console.log('✅ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
