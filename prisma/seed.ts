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

const adapter = new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting comprehensive seeding...');

    // 1. CLEAR OLD DATA
    console.log('  Cleaning up old data...');
    await prisma.apiToken.deleteMany({});
    await prisma.post.deleteMany({});
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
        },
        {
            id: '00000000-0000-0000-0000-000000000002',
            telegramId: 111111111n,
            telegramUsername: 'anna_editor',
            fullName: 'Анна Редактор',
            isAdmin: false,
        },
        {
            id: '00000000-0000-0000-0000-000000000003',
            telegramId: 987654321n,
            telegramUsername: 'viewer_user',
            fullName: 'Виктор Зритель',
            isAdmin: false,
        },
        {
            id: '00000000-0000-0000-0000-000000000004',
            telegramId: 222222222n,
            telegramUsername: 'alex_admin',
            fullName: 'Алексей Админ',
            isAdmin: true,
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
        },
        {
            id: '11111111-1111-1111-1111-111111111112',
            name: 'Хроники Путешествий 🌍',
            description: 'Фото-истории со всего мира. Советы по бюджетным поездкам и обзоры элитных курортов.',
            ownerId: devUser.id,
        },
        {
            id: '11111111-1111-1111-1111-111111111113',
            name: 'Финансы и Крипто 💰',
            description: 'Анализ рынка и инвестиционные стратегии. Не является финансовой рекомендацией.',
            ownerId: adminUser.id,
        },
        {
            id: '11111111-1111-1111-1111-111111111114',
            name: 'Здоровый Образ Жизни 🥗',
            description: null, // Test null description
            ownerId: devUser.id,
        },
        {
            id: '11111111-1111-1111-1111-111111111115',
            name: 'UI Stress Test Project 🧪 with a very very long name to check if it fits in the sidebar or header correctly without breaking layout',
            description: 'A project designed specifically to break the UI with long strings and edge cases.',
            ownerId: devUser.id,
        },
        {
            id: '88888888-8888-8888-8888-888888888888',
            name: 'Pagination Test Project 📑',
            description: 'Project specifically for testing pagination with many posts.',
            ownerId: devUser.id,
        },
        {
            id: '11111111-1111-1111-1111-111111111116',
            name: 'Stale Test Project 🕸️',
            description: 'Project for testing stale channel warnings.',
            ownerId: devUser.id,
        },
        {
            id: '11111111-1111-1111-1111-111111111117',
            name: 'Problematic Project ⚠️',
            description: 'Project with various problems regarding activity and channels.',
            ownerId: devUser.id,
        }
    ];

    for (const p of projectData) {
        await prisma.project.upsert({
            where: { id: p.id },
            update: p,
            create: p,
        });
    }

    // 4. PROJECT MEMBERSHIPS
    const memberships = [
        { projectId: projectData[0].id, userId: devUser.id, role: ProjectRole.OWNER },
        { projectId: projectData[0].id, userId: editorUser.id, role: ProjectRole.EDITOR },
        { projectId: projectData[0].id, userId: viewerUser.id, role: ProjectRole.VIEWER },
        { projectId: projectData[1].id, userId: devUser.id, role: ProjectRole.OWNER },
        { projectId: projectData[2].id, userId: adminUser.id, role: ProjectRole.OWNER },
        { projectId: projectData[2].id, userId: devUser.id, role: ProjectRole.ADMIN },
        { projectId: projectData[3].id, userId: devUser.id, role: ProjectRole.OWNER },
        { projectId: '11111111-1111-1111-1111-111111111115', userId: devUser.id, role: ProjectRole.OWNER },
        { projectId: '88888888-8888-8888-8888-888888888888', userId: devUser.id, role: ProjectRole.OWNER },
        { projectId: '11111111-1111-1111-1111-111111111116', userId: devUser.id, role: ProjectRole.OWNER },
        { projectId: '11111111-1111-1111-1111-111111111117', userId: devUser.id, role: ProjectRole.OWNER },
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
        { id: '22222222-2222-2222-2222-222222222221', projectId: projectData[0].id, socialMedia: SocialMedia.TELEGRAM, name: 'Основной Техно-канал', channelIdentifier: '@tech_main', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },
        { id: '22222222-2222-2222-2222-222222222222', projectId: projectData[0].id, socialMedia: SocialMedia.YOUTUBE, name: 'Техно-Туториалы YT', channelIdentifier: 'UC_TechTuts', language: 'en-US', isActive: true, credentials: '{"token":"valid"}' },
        { id: '22222222-2222-2222-2222-222222222223', projectId: projectData[1].id, socialMedia: SocialMedia.VK, name: 'Wanderlust VK', channelIdentifier: 'wander_vk_page', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },
        { id: '22222222-2222-2222-2222-222222222224', projectId: projectData[1].id, socialMedia: SocialMedia.TELEGRAM, name: 'Путешествия Ежедневно', channelIdentifier: '@travel_daily', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },

        { id: '22222222-2222-2222-2222-222222222226', projectId: projectData[0].id, socialMedia: SocialMedia.TIKTOK, name: 'Tech Shorts', channelIdentifier: '@tech_shorts', language: 'en-US', isActive: true, credentials: '{"token":"valid"}' },
        { id: '22222222-2222-2222-2222-222222222227', projectId: '11111111-1111-1111-1111-111111111115', socialMedia: SocialMedia.TELEGRAM, name: 'Stress Test Channel with Long Name', channelIdentifier: '@stress_test_long_id', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },
        { id: '99999999-9999-9999-9999-999999999999', projectId: '88888888-8888-8888-8888-888888888888', socialMedia: SocialMedia.TELEGRAM, name: 'Pagination Channel', channelIdentifier: '@pag_test', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },
        { id: '22222222-2222-2222-2222-222222222228', projectId: '11111111-1111-1111-1111-111111111116', socialMedia: SocialMedia.TELEGRAM, name: 'Stale Channel', channelIdentifier: '@stale_channel', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },
        // Problematic Project Channels
        { id: '22222222-2222-2222-2222-222222222230', projectId: '11111111-1111-1111-1111-111111111117', socialMedia: SocialMedia.TELEGRAM, name: 'No Credentials Channel', channelIdentifier: '@no_creds', language: 'ru-RU', isActive: true, credentials: '{}' },
        { id: '22222222-2222-2222-2222-222222222231', projectId: '11111111-1111-1111-1111-111111111117', socialMedia: SocialMedia.TELEGRAM, name: 'Inactive Channel', channelIdentifier: '@inactive_ch', language: 'ru-RU', isActive: false, credentials: '{"token":"valid"}' },
        { id: '22222222-2222-2222-2222-222222222232', projectId: '11111111-1111-1111-1111-111111111117', socialMedia: SocialMedia.TELEGRAM, name: 'Failed Posts Channel', channelIdentifier: '@failed_posts', language: 'ru-RU', isActive: true, credentials: '{"token":"valid"}' },
    ];

    for (const c of channelData) {
        await prisma.channel.upsert({
            where: { id: c.id },
            update: c,
            create: c,
        });
    }

    // 6. PUBLICATIONS (Master Content)
    const translationGroup1 = '55555555-5555-5555-5555-555555555551';

    const publications = [
        {
            id: '44444444-4444-4444-4444-444444444441',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'Знакомство с Nuxt 4',
            description: 'Краткий обзор новых возможностей Nuxt 4 для разработчиков.',
            content: '<h1>Освоение Nuxt 4</h1><p>Nuxt 4 приносит удивительные новые функции для создания современных веб-приложений. Давайте изучим новую архитектуру приложений...</p>',
            authorComment: 'Это важный пост для нашего сообщества.',
            tags: 'nuxt,vue,frontend',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.ARTICLE,
            postDate: new Date(2025, 0, 1),
            language: 'ru-RU',
            translationGroupId: translationGroup1,
        },
        {
            id: '44444444-4444-4444-4444-444444444445',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'Introduction to Nuxt 4',
            content: '<h1>Mastering Nuxt 4</h1><p>Nuxt 4 brings amazing new features for building modern web applications. Let\'s explore the new app architecture...</p>',
            tags: 'nuxt,vue,frontend',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.ARTICLE,
            language: 'en-US',
            translationGroupId: translationGroup1,
        },
        {
            id: '44444444-4444-4444-4444-444444444442',
            projectId: projectData[1].id,
            createdBy: devUser.id,
            title: 'Топ-5 скрытых жемчужин Киото',
            content: '<p>Киото — это больше, чем просто Кинкаку-дзи. Ознакомьтесь с этими 5 секретными местами, которые обычно пропускают туристы...</p>',
            tags: 'киото,япония,гид',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        {
            id: '44444444-4444-4444-4444-444444444443',
            projectId: projectData[2].id,
            createdBy: adminUser.id,
            title: 'Прогноз цен на Биткоин 2025',
            content: '<p>Анализ исторических данных, чтобы понять, куда BTC может направиться в следующем году...</p>',
            tags: 'крипто,биткоин,финансы',
            status: PublicationStatus.SCHEDULED,
            postType: PostType.NEWS,
            language: 'ru-RU',
        },
        {
            id: '44444444-4444-4444-4444-444444444444',
            projectId: projectData[3].id,
            createdBy: devUser.id,
            title: 'Тест пустой публикации',
            content: '', // Test empty content
            status: PublicationStatus.DRAFT,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        {
            id: '44444444-4444-4444-4444-444444444446',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'Быстрый Привет!',
            content: 'Просто хотел поздороваться со всеми нашими подписчиками! Сегодня без больших постов.',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        {
            id: '44444444-4444-4444-4444-444444444450',
            projectId: '11111111-1111-1111-1111-111111111115',
            createdBy: devUser.id,
            title: 'Очень длинный заголовок публикации, который должен проверить, как интерфейс справляется с переносом строк. Если он не переносится, то все сломается и выйдет за пределы контейнера. Поэтому мы пишем здесь очень много текста.',
            content: '<p>Контент для проверки длинного заголовка.</p>',
            tags: 'test,long-title',
            status: PublicationStatus.DRAFT,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        {
            id: '44444444-4444-4444-4444-444444444451',
            projectId: '11111111-1111-1111-1111-111111111115',
            createdBy: devUser.id,
            title: 'Публикация с огромным количеством тегов',
            content: '<p>Здесь очень много тегов.</p>',
            tags: 'tag1,tag2,tag3,very-long-tag-name-example,another-tag,frontend,backend,testing,ui-ux,design,development,database,prisma,nestjs,vue,nuxt,javascript,typescript,css,html,responsive,mobile-first,accessibility,performance,security,optimization,deployment,ci-cd,git,github,gitlab,bitbucket,jira,trello,notion,slack,discord,telegram,whatsapp,viber,signal,facebook,instagram,twitter,linkedin,youtube,tiktok,snapchat,pinterest,reddit,quora,medium,dev-to,hashnode,stackoverflow,google,bing,yahoo,yandex,duckduckgo,brave,firefox,chrome,edge,safari,opera,vivaldi,ie,netscape,mosaic,lynx,w3c,whatwg,ietf,iso,ansi,ieee,acm,ieee-cs,bcs,cs,it,ict,iot,ai,ml,dl,ds,big-data,cloud,serverless,microservices,monolith,soa,rest,graphql,grpc,soap,xml,json,yaml,toml,ini,csv,tsv,xls,xlsx,doc,docx,ppt,pptx,pdf,txt,md,rst,tex,latex,bib,bibtex',
            status: PublicationStatus.READY,
            postType: PostType.ARTICLE,
            language: 'ru-RU',
        },
        {
            id: '44444444-4444-4444-4444-444444444452',
            projectId: '11111111-1111-1111-1111-111111111115',
            createdBy: devUser.id,
            title: 'Комбо: Супер длинный заголовок и миллион тегов в одной публикации для максимального стресс-теста интерфейса на прочность',
            content: '<p>Удачи интерфейсу.</p>',
            tags: 'stress,test,crash,burn,ui,layout,overflow,hidden,scroll,wrap,break-word,whitespace,nowrap,text-overflow,ellipsis,line-clamp,flex,grid,block,inline,inline-block,position,absolute,relative,fixed,sticky,z-index,opacity,visibility,display,float,clear,margin,padding,border,width,height,min-width,min-height,max-width,max-height,box-sizing,border-box,content-box,transform,transition,animation,keyframes,media-query,hover,focus,active,visited,link,disabled,checked,selected,required,optional,read-only,read-write,valid,invalid,in-range,out-of-range,placeholder-shown,default,checked,indeterminate,blank,empty,target,lang,not,nth-child,nth-last-child,nth-of-type,nth-last-of-type,first-child,last-child,first-of-type,last-of-type,only-child,only-of-type,root,empty',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        // --- STATUS TESTING DATA ---
        // 1. Scheduled Publication (Tech Project)
        {
            id: '44444444-4444-4444-4444-444444444470',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'Анонс: Будущее ИИ (Запланировано)',
            content: '<p>Этот пост должен выйти завтра.</p>',
            status: PublicationStatus.SCHEDULED,
            postType: PostType.NEWS,
            scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
            language: 'ru-RU',
        },
        // 2. Failed Publication (Tech Project)
        {
            id: '44444444-4444-4444-4444-444444444471',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'Ошибка отправки (Failed)',
            content: '<p>Этот пост не удалось опубликовать.</p>',
            status: PublicationStatus.FAILED,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        // 3. Partial Publication (Travel Project)
        {
            id: '44444444-4444-4444-4444-444444444472',
            projectId: projectData[1].id,
            createdBy: devUser.id,
            title: 'Частичный успех (Partial)',
            content: '<p>Опубликовано в VK, но сломалось в Telegram.</p>',
            status: PublicationStatus.PARTIAL,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        // 4. Draft Publication (Travel Project)
        {
            id: '44444444-4444-4444-4444-444444444473',
            projectId: projectData[1].id,
            createdBy: devUser.id,
            title: 'Черновик путеводителя (Draft)',
            content: '<p>Еще не готово...</p>',
            status: PublicationStatus.DRAFT,
            postType: PostType.ARTICLE,
            language: 'ru-RU',
        },
        // 5. Processing Publication (Tech Project)
        {
            id: '44444444-4444-4444-4444-444444444474',
            projectId: projectData[0].id,
            createdBy: devUser.id,
            title: 'В процессе отправки (Processing)',
            content: '<p>Отправляется прямо сейчас...</p>',
            status: PublicationStatus.PROCESSING,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        // Stale Publication (published 10 days ago)
        {
            id: '44444444-4444-4444-4444-444444444460',
            projectId: '11111111-1111-1111-1111-111111111116',
            createdBy: devUser.id,
            title: 'Very Old Post',
            content: '<p>This post is old.</p>',
            status: PublicationStatus.PUBLISHED,
            postType: PostType.POST,
            language: 'ru-RU',
        },
        // Expired Publication
        {
            id: '44444444-4444-4444-4444-444444444480',
            projectId: '11111111-1111-1111-1111-111111111117',
            createdBy: devUser.id,
            title: 'Просроченная публикация (Expired)',
            content: '<p>Эта публикация просрочена.</p>',
            status: PublicationStatus.EXPIRED,
            postType: PostType.POST,
            language: 'ru-RU',
        },
         // Failed Publication for Problematic Project
        {
            id: '44444444-4444-4444-4444-444444444481',
            projectId: '11111111-1111-1111-1111-111111111117',
            createdBy: devUser.id,
            title: 'Неудачная публикация в проблемном проекте',
            content: '<p>Ошибка.</p>',
            status: PublicationStatus.FAILED,
            postType: PostType.POST,
            language: 'ru-RU',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago to trigger "No Recent Activity"
        }
    ];

    for (const pub of publications) {
        await prisma.publication.upsert({
            where: { id: pub.id },
            update: pub,
            create: pub,
        });
    }

    // 7. POSTS (Executions)
    const posts = [
        // Published posts
        {
            id: '33333333-3333-3333-3333-333333333331',
            publicationId: publications[0].id,
            channelId: channelData[0].id,
            socialMedia: 'TELEGRAM',
            tags: null, // Using publication tags
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
        {
            id: '33333333-3333-3333-3333-333333333337',
            publicationId: publications[1].id,
            channelId: channelData[1].id,
            socialMedia: 'YOUTUBE',
            tags: 'nuxt,vue,javascript', // Overriding publication tags for this channel
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 3500000),
        },
        {
            id: '33333333-3333-3333-3333-333333333332',
            publicationId: publications[2].id,
            channelId: channelData[3].id,
            socialMedia: 'TELEGRAM',
            tags: null,
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 7200000), // 2 hours ago
        },
        // Scheduled post

        // Failed post
        {
            id: '33333333-3333-3333-3333-333333333334',
            publicationId: publications[0].id,
            channelId: channelData[1].id,
            socialMedia: 'YOUTUBE',
            tags: null,
            status: PostStatus.FAILED,
            errorMessage: 'Video size too large or invalid format',
        },
        // Post previously known as independent
        {
            id: '33333333-3333-3333-3333-333333333335',
            publicationId: publications[5].id,
            channelId: channelData[0].id,
            socialMedia: 'TELEGRAM',
            tags: null,
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 1800000),
        },
        {
            id: '33333333-3333-3333-3333-333333333336',
            publicationId: publications[4].id,
            channelId: channelData[0].id,
            socialMedia: 'TELEGRAM',
            tags: null,
            status: PostStatus.PENDING,
        },
        {
            id: '33333333-3333-3333-3333-333333333352',
            publicationId: '44444444-4444-4444-4444-444444444452',
            channelId: '22222222-2222-2222-2222-222222222227',
            socialMedia: 'TELEGRAM',
            tags: null,
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 3600),
        },
        // --- STATUS TESTING POSTS ---
        // For Scheduled Pub (44...70)
        {
            id: '33333333-3333-3333-3333-333333333370',
            publicationId: '44444444-4444-4444-4444-444444444470',
            channelId: channelData[0].id, // Telegram
            socialMedia: 'TELEGRAM',
            status: PostStatus.PENDING,
            scheduledAt: new Date(Date.now() + 86400000),
        },
        {
            id: '33333333-3333-3333-3333-333333333371',
            publicationId: '44444444-4444-4444-4444-444444444470',
            channelId: channelData[1].id, // YouTube
            socialMedia: 'YOUTUBE',
            status: PostStatus.PENDING,
            scheduledAt: new Date(Date.now() + 86400000),
        },
        // For Failed Pub (44...71)
        {
            id: '33333333-3333-3333-3333-333333333372',
            publicationId: '44444444-4444-4444-4444-444444444471',
            channelId: channelData[0].id, // Telegram
            socialMedia: 'TELEGRAM',
            status: PostStatus.FAILED,
            errorMessage: 'Chat not found or bot kicked',
        },
        // For Partial Pub (44...72)
        {
            id: '33333333-3333-3333-3333-333333333373',
            publicationId: '44444444-4444-4444-4444-444444444472',
            channelId: channelData[2].id, // VK (Index 2 in array)
            socialMedia: 'VK',
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(),
        },
        {
            id: '33333333-3333-3333-3333-333333333374',
            publicationId: '44444444-4444-4444-4444-444444444472',
            channelId: channelData[3].id, // Telegram (Index 3 in array)
            socialMedia: 'TELEGRAM',
            status: PostStatus.FAILED,
            errorMessage: 'Connection timeout while uploading media',
        },
        // For Processing Pub (44...74)
        {
            id: '33333333-3333-3333-3333-333333333375',
            publicationId: '44444444-4444-4444-4444-444444444474',
            channelId: channelData[0].id, // Telegram
            socialMedia: 'TELEGRAM',
            status: PostStatus.PENDING, // Or could be considered PENDING/PROCESSING depending on system logic
        },
        // Stale Post
        {
            id: '33333333-3333-3333-3333-333333333360',
            publicationId: '44444444-4444-4444-4444-444444444460',
            channelId: '22222222-2222-2222-2222-222222222228',
            socialMedia: 'TELEGRAM',
            status: PostStatus.PUBLISHED,
            publishedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago to trigger "Stale"
        },
        // Failed post for 'Failed Posts Channel'
        {
            id: '33333333-3333-3333-3333-333333333380',
            publicationId: '44444444-4444-4444-4444-444444444481',
            channelId: '22222222-2222-2222-2222-222222222232', // Failed Posts Channel
            socialMedia: 'TELEGRAM',
            status: PostStatus.FAILED,
            errorMessage: 'API token is invalid or expired',
        }
    ];

    for (const post of posts) {
        await prisma.post.upsert({
            where: { id: post.id },
            update: post,
            create: post,
        });
    }

    // 8. PAGINATION DATA GENERATION
    console.log('  Generating 30 publications for pagination test...');
    const pagProjectId = '88888888-8888-8888-8888-888888888888';
    const pagChannelId = '99999999-9999-9999-9999-999999999999';

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
                content: `<p>Content for pagination post ${i}</p>`,
                status: PublicationStatus.PUBLISHED,
                postType: PostType.POST,
                language: 'ru-RU',
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
                publishedAt: new Date(Date.now() - (1000 * 60 * 60 * i)), // varied times
            },
            update: {}
        });
    }

    console.log('✅ Seeding complete! Database is now full-fledged.');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
