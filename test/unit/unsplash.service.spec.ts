import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { UnsplashService } from '../../src/modules/content-library/unsplash.service.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('UnsplashService (unit)', () => {
  let service: UnsplashService;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'UNSPLASH_ACCESS_KEY') return 'test-key';
      if (key === 'http') return { retryMaxAttempts: 1 };
      if (key === 'unsplash') return { requestTimeoutSecs: 10 };
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
      providers: [
        UnsplashService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UnsplashService>(UnsplashService);
    jest.clearAllMocks();
  });

  describe('searchPhotos', () => {
    it('should return photos from unsplash API', async () => {
      const client = mockAgent.get('https://api.unsplash.com');
      client.intercept({
        path: /^\/search\/photos/,
        method: 'GET',
      }).reply(200, {
        results: [{ id: '1', urls: { regular: 'url1' }, user: { name: 'User 1' } }],
        total: 100,
        total_pages: 5,
      });

      const result = await service.searchPhotos({ query: 'nature' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(100);
    });

    it('should return empty result if API returns 400+', async () => {
      const client = mockAgent.get('https://api.unsplash.com');
      client.intercept({
        path: /^\/search\/photos/,
        method: 'GET',
      }).reply(401, { error: 'Unauthorized' }); // Using JSON Object

      const result = await service.searchPhotos({ query: 'nature' });
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getPhoto', () => {
    it('should fetch single photo', async () => {
      const client = mockAgent.get('https://api.unsplash.com');
      client.intercept({
        path: '/photos/p1',
        method: 'GET',
      }).reply(200, { id: 'p1', urls: { full: 'full-url' } });

      const result = await service.getPhoto('p1');
      expect(result?.id).toBe('p1');
    });
  });
});
