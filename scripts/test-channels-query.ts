import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getDatabaseUrl } from '../src/config/database.config.js';

const url = getDatabaseUrl();
const pool = new pg.Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const userId = '00000000-0000-0000-0000-000000000001';
  
  const userProjects = await prisma.project.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: { id: true, name: true },
  });
  console.log('User projects:', userProjects);

  const projectIds = userProjects.map(p => p.id);
  
  const channels = await prisma.channel.findMany({
    where: {
      projectId: { in: projectIds },
      archivedAt: null,
      project: { archivedAt: null }
    },
    include: { project: true }
  });
  console.log('User channels count:', channels.length);
  console.log('Sample channels:', channels.map(c => ({ id: c.id, projectId: c.projectId, name: c.name, projectName: c.project.name })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
