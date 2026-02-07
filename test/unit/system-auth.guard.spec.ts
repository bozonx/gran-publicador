import { Test, type TestingModule } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemAuthGuard } from '../../src/common/guards/system-auth.guard.js';
import { jest } from '@jest/globals';

describe('SystemAuthGuard (unit)', () => {
  let guard: SystemAuthGuard;
  let moduleRef: TestingModule;

  const createMockExecutionContext = (headers: Record<string, any>, ip = '127.0.0.1'): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          ip,
        }),
      }),
    } as ExecutionContext;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        SystemAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app') {
                return {
                  systemApiSecret: 'secret-1',
                };
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    guard = moduleRef.get(SystemAuthGuard);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should allow request with valid system token', () => {
    const ctx = createMockExecutionContext({ 'x-system-token': 'secret-1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow request with valid system token provided as array', () => {
    const ctx = createMockExecutionContext({ 'x-system-token': ['secret-1'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException when token is missing', () => {
    const ctx = createMockExecutionContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is invalid', () => {
    const ctx = createMockExecutionContext({ 'x-system-token': 'wrong' }, '10.0.0.10');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when system secret is not configured', async () => {
    const localModule = await Test.createTestingModule({
      providers: [
        SystemAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app') {
                return {
                  systemApiSecret: undefined,
                };
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const localGuard = localModule.get(SystemAuthGuard);
    const ctx = createMockExecutionContext({ 'x-system-token': 'secret-1' });
    expect(() => localGuard.canActivate(ctx)).toThrow(UnauthorizedException);

    await localModule.close();
  });
});
