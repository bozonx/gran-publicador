import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { NewsQueriesService } from '../../src/modules/news-queries/news-queries.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';

describe('NewsQueriesService (unit)', () => {
  let service: NewsQueriesService;
  let prisma: PrismaService;
  let permissions: PermissionsService;

  const mockPrismaService = {
    projectNewsQuery: {
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
    },
    project: {
      findMany: jest.fn() as any,
    },
    $transaction: jest.fn((args: any) => (Array.isArray(args) ? Promise.all(args) : args)) as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsQueriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    }).compile();

    service = module.get<NewsQueriesService>(NewsQueriesService);
    prisma = module.get<PrismaService>(PrismaService);
    permissions = module.get<PermissionsService>(PermissionsService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return mapped queries', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      const mockQueries = [
        { id: 'q1', name: 'Query 1', settings: { key: 'val' } },
      ];

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.projectNewsQuery.findMany.mockResolvedValue(mockQueries);

      const result = await service.findAll(projectId, userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'q1',
        name: 'Query 1',
        key: 'val',
        settings: undefined,
      });
      expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith(projectId, userId);
    });
  });

  describe('findAllDefault', () => {
    it('should return default queries for user projects', async () => {
      const userId = 'u1';
      mockPrismaService.project.findMany.mockResolvedValue([{ id: 'p1' }]);
      mockPrismaService.projectNewsQuery.findMany.mockResolvedValue([
        { id: 'q1', name: 'Q1', project: { name: 'P1' }, settings: {} },
      ]);

      const result = await service.findAllDefault(userId);

      expect(result).toHaveLength(1);
      expect(result[0].projectName).toBe('P1');
      expect(mockPrismaService.projectNewsQuery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: { in: ['p1'] },
            isNotificationEnabled: true,
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create query with incremented order', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      const dto = { name: 'New Query', key1: 'val1', isNotificationEnabled: true };

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.projectNewsQuery.findFirst.mockResolvedValue({ order: 5 });
      mockPrismaService.projectNewsQuery.create.mockResolvedValue({
        id: 'q2',
        name: 'New Query',
        order: 6,
        settings: { key1: 'val1' },
      });

      const result = await service.create(projectId, userId, dto as any);

      expect(result.order).toBe(6);
      expect(mockPrismaService.projectNewsQuery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order: 6,
            settings: { key1: 'val1' },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should merge settings and update query', async () => {
      const queryId = 'q1';
      const projectId = 'p1';
      const userId = 'u1';
      const existingQuery = {
        id: queryId,
        projectId,
        settings: { old: 'oldValue', stay: 'here' },
      };
      const dto = { name: 'Updated', old: 'newValue' };

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.projectNewsQuery.findUnique.mockResolvedValue(existingQuery);
      mockPrismaService.projectNewsQuery.update.mockResolvedValue({
        ...existingQuery,
        name: 'Updated',
        settings: { old: 'newValue', stay: 'here' },
      });

      const result = await service.update(queryId, projectId, userId, dto as any);

      expect(result.old).toBe('newValue');
      expect(result.stay).toBe('here');
      expect(mockPrismaService.projectNewsQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            settings: { old: 'newValue', stay: 'here' },
          }),
        }),
      );
    });

    it('should handle optimistic locking', async () => {
      const queryId = 'q1';
      const projectId = 'p1';
      mockPrismaService.projectNewsQuery.findUnique.mockResolvedValue({ id: queryId, projectId });
      mockPrismaService.projectNewsQuery.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update(queryId, projectId, 'u1', { version: 1 } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove query if it belongs to project', async () => {
      const queryId = 'q1';
      const projectId = 'p1';
      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.projectNewsQuery.findUnique.mockResolvedValue({ id: queryId, projectId });

      const result = await service.remove(queryId, projectId, 'u1');

      expect(result.success).toBe(true);
      expect(mockPrismaService.projectNewsQuery.delete).toHaveBeenCalledWith({ where: { id: queryId } });
    });

    it('should throw NotFoundException if query belongs to another project', async () => {
      mockPrismaService.projectNewsQuery.findUnique.mockResolvedValue({ id: 'q1', projectId: 'other' });
      await expect(service.remove('q1', 'p1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('should update orders in transaction', async () => {
      const projectId = 'p1';
      const ids = ['q1', 'q2', 'q3'];

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);
      mockPrismaService.projectNewsQuery.count.mockResolvedValue(3);

      await service.reorder(projectId, 'u1', { ids });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.projectNewsQuery.update).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundException if some IDS are missing', async () => {
      mockPrismaService.projectNewsQuery.count.mockResolvedValue(2);
      await expect(service.reorder('p1', 'u1', { ids: ['q1', 'q2', 'q3'] })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
