import { Test, type TestingModule } from '@nestjs/testing';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';
import { PublicationsService } from '../../src/modules/publications/publications.service.js';
import { ContentItemsService } from '../../src/modules/content-library/content-items.service.js';
import { ChannelsService } from '../../src/modules/channels/channels.service.js';
import { PublicationStatus } from '../../src/generated/prisma/index.js';

describe('DashboardService (unit)', () => {
  let service: DashboardService;

  const mockPrismaService = {};
  const mockProjectsService = {
    findAllForUser: jest.fn() as any,
  };
  const mockPublicationsService = {
    findAllForUser: jest.fn() as any,
  };
  const mockContentItemsService = {
    findAll: jest.fn() as any,
  };
  const mockChannelsService = {
    findAllForUser: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: PublicationsService, useValue: mockPublicationsService },
        { provide: ContentItemsService, useValue: mockContentItemsService },
        { provide: ChannelsService, useValue: mockChannelsService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should aggregate data from all services', async () => {
      const userId = 'u1';
      
      mockProjectsService.findAllForUser.mockResolvedValue([{ id: 'p1', name: 'Proj 1' }]);
      mockContentItemsService.findAll.mockResolvedValue({ items: [{ id: 'c1' }], total: 1 });
      mockChannelsService.findAllForUser.mockResolvedValue({ 
        items: [
          { id: 'ch1', socialMedia: 'TELEGRAM', isActive: true },
          { id: 'ch2', socialMedia: 'TELEGRAM', isActive: true },
          { id: 'ch3', socialMedia: 'INSTAGRAM', isActive: true },
          { id: 'ch4', socialMedia: 'TELEGRAM', isActive: false },
        ] 
      });

      mockPublicationsService.findAllForUser.mockImplementation((_uid, filters: any) => {
        if (filters.status === PublicationStatus.SCHEDULED) {
          return Promise.resolve({ items: [{ id: 'pub1', project: { id: 'p1', name: 'Proj 1' } }], total: 1 });
        }
        if (Array.isArray(filters.status)) { // Problematic statuses
          return Promise.resolve({ items: [], total: 0 });
        }
        if (filters.status === PublicationStatus.PUBLISHED) {
          return Promise.resolve({ items: [], total: 0 });
        }
        return Promise.resolve({ items: [], total: 0 });
      });

      const result = await service.getSummary(userId);

      expect(result.projects).toHaveLength(1);
      expect(result.recentContent).toHaveLength(1);
      expect(result.channelsSummary.totalCount).toBe(3); // 3 active channels
      expect(result.channelsSummary.grouped).toContainEqual({ socialMedia: 'TELEGRAM', count: 2 });
      expect(result.channelsSummary.grouped).toContainEqual({ socialMedia: 'INSTAGRAM', count: 1 });
      
      expect(result.publications.scheduled.total).toBe(1);
      expect(result.publications.scheduled.groupedByProject).toHaveLength(1);
      expect(result.publications.scheduled.groupedByProject[0].project.name).toBe('Proj 1');
    });
  });
});
