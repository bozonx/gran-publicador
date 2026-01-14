import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';

async function run() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const projectsService = app.get(ProjectsService);

  const projectId = '11111111-1111-1111-1111-111111111114';
  const ownerId = '00000000-0000-0000-0000-000000000001';
  const memberId = '00000000-0000-0000-0000-000000000002'; // The USER ID of the member

  console.log('Attempting to remove member...');
  try {
    await projectsService.removeMember(projectId, ownerId, memberId);
    console.log('Success!');
  } catch (e) {
    console.error('Failed:', e);
  }

  await app.close();
}

run();
