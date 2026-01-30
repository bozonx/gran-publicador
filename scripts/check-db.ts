import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getDatabaseUrl } from '../src/config/database.config.js';

const url = getDatabaseUrl();
const pool = new pg.Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const users = await prisma.user.findMany();
  console.log('Users:', users.map(u => ({ id: u.id, telegramId: u.telegramId.toString(), username: u.telegramUsername })));

  const projects = await prisma.project.findMany({
    include: {
      _count: { select: { channels: true, members: true } },
      members: { select: { userId: true, role: { select: { name: true } } } }
    }
  });
  console.log('Projects:', projects.map(p => ({
    id: p.id,
    name: p.name,
    ownerId: p.ownerId,
    channelsCount: p._count.channels,
    memberCount: p._count.members,
    members: p.members
  })));

  const channels = await prisma.channel.findMany();
  console.log('Channels:', channels.map(c => ({ id: c.id, projectId: c.projectId, name: c.name, archivedAt: c.archivedAt })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
