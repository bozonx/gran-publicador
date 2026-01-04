import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ApiTokenGuard } from '../../src/common/guards/api-token.guard.js';
import { ApiTokensService } from '../../src/modules/api-tokens/api-tokens.service.js';
import { jest } from '@jest/globals';

describe('ApiTokenGuard (unit)', () => {
  let guard: ApiTokenGuard;
  let moduleRef: TestingModule;

  const mockApiTokensService = {
    validateToken: jest.fn() as any,
    updateLastUsed: (jest.fn() as any).mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ApiTokenGuard,
        {
          provide: ApiTokensService,
          useValue: mockApiTokensService,
        },
      ],
    }).compile();

    guard = moduleRef.get<ApiTokenGuard>(ApiTokenGuard);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow request with valid API key in X-API-Key header', async () => {
      const validToken = 'test-token';
      mockApiTokensService.validateToken.mockResolvedValue({
        userId: 'user-1',
        scopeProjectIds: [] as string[],
        tokenId: 'token-1',
      });

      const context = createMockExecutionContext({
        'x-api-key': validToken,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockApiTokensService.validateToken).toHaveBeenCalledWith(validToken);
    });

    it('should allow request with valid Bearer token', async () => {
      const validToken = 'test-token';
      mockApiTokensService.validateToken.mockResolvedValue({
        userId: 'user-1',
        scopeProjectIds: [] as string[],
        tokenId: 'token-1',
      });

      const context = createMockExecutionContext({
        authorization: `Bearer ${validToken}`,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockApiTokensService.validateToken).toHaveBeenCalledWith(validToken);
    });

    it('should throw UnauthorizedException when API token is missing', async () => {
      const context = createMockExecutionContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when API token is invalid', async () => {
      mockApiTokensService.validateToken.mockResolvedValue(null);
      const context = createMockExecutionContext({ 'x-api-key': 'invalid' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
