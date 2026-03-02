import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { SourcesController } from '../../src/modules/sources/sources.controller.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('SourcesController (unit)', () => {
  let controller: SourcesController;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'news') {
        return {
          serviceUrl: 'http://news-service',
          apiToken: 'token',
        };
      }
      return null;
    }),
  };

  beforeAll(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterAll(() => {
    setGlobalDispatcher(originalDispatcher);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SourcesController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<SourcesController>(SourcesController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should fetch sources from news service', async () => {
      const client = mockAgent.get('http://news-service');
      client.intercept({
        path: '/api/v1/sources?q=test',
        method: 'GET',
      }).reply(200, [{ id: 's1' }]);

      const result = await controller.findAll({ q: 'test' });
      expect(result).toEqual([{ id: 's1' }]);
    });

    it('should throw error if news service returns 400+', async () => {
      const client = mockAgent.get('http://news-service');
      client.intercept({
        path: '/api/v1/sources',
        method: 'GET',
      }).reply(400, 'Error details');

      await expect(controller.findAll({})).rejects.toThrow('News microservice error: 400');
    });
  });

  describe('findTags', () => {
    it('should fetch tags', async () => {
      const client = mockAgent.get('http://news-service');
      client.intercept({
        path: '/api/v1/source-tags',
        method: 'GET',
      }).reply(200, ['t1']);

      const result = await controller.findTags({});
      expect(result).toEqual(['t1']);
    });
  });
});
