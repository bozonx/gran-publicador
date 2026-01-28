
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Use the URL from command line or default logic matching the environment
const connectionString = process.env.DATABASE_URL || "postgresql://gran:gran_password@localhost:5432/gran_db?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });



async function main() {
  console.log('Starting migration of news queries from JSON preferences to ProjectNewsQuery table...');
  
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      preferences: true,
    },
  });

  console.log(`Found ${projects.length} projects to check.`);
  let migratedCount = 0;

  for (const project of projects) {
    const prefs = project.preferences as any;
    
    // Check if newsQueries exists and has items
    if (prefs?.newsQueries && Array.isArray(prefs.newsQueries) && prefs.newsQueries.length > 0) {
      console.log(`Migrating ${prefs.newsQueries.length} queries for project ${project.id}...`);
      
      let order = 0;
      for (const query of prefs.newsQueries) {
        // Destructure known fields that go into columns vs settings
        // Note: 'id' in JSON was client-side UUID. We can ignore it and let DB create new UUID,
        // or keep it if we really wanted to (but schema has @default(uuid())).
        // Let's create fresh records.
        const { 
          name, 
          isDefault, 
          // Extract fields we might want to put into settings explicitly to clean up
          q, mode, lang, sourceTags, newsTags, minScore, since, note,
          // Rest of fields
          ...others 
        } = query;
        
        // Construct clean settings object
        const settings = {
          q, 
          mode: mode || 'hybrid', 
          lang, 
          sourceTags, 
          newsTags, 
          minScore: minScore ?? 0.5, 
          since, 
          note,
          ...others
        };

        try {
          await prisma.projectNewsQuery.create({
            data: {
              projectId: project.id,
              name: name || 'News Search',
              isDefault: !!isDefault,
              order: order++,
              isNotificationEnabled: false, // Default off
              settings: settings,
            },
          });
          migratedCount++;
        } catch (e) {
          console.error(`Failed to migrate query "${name}" for project ${project.id}:`, e);
        }
      }
    }
  }
  
  console.log(`Migration completed. Total queries migrated: ${migratedCount}`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
