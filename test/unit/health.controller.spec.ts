import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/modules/health/health.controller.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('HealthController (unit)', () => {
  let controller: HealthController;
  let moduleRef: TestingModule;
  let prismaService: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
    prismaService = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /api/v1/health returns ok', async () => {
    jest.spyOn(prismaService, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await controller.check();
    expect(res).toEqual({ status: 'ok', database: 'connected' });
  });

  it('GET /api/v1/health handles db error', async () => {
    jest.spyOn(prismaService, '$queryRaw').mockRejectedValueOnce(new Error('DB Error'));
    const res = await controller.check();
    expect(res).toEqual({
      status: 'ok',
      database: 'disconnected',
      error: 'DB Error',
    });
  });
});
