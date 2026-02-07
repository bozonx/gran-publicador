import { Test, type TestingModule } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { LocalNetworkGuard } from '../../src/common/guards/local-network.guard.js';
import { jest } from '@jest/globals';

describe('LocalNetworkGuard (unit)', () => {
  let guard: LocalNetworkGuard;
  let moduleRef: TestingModule;

  const createMockExecutionContext = (ip: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
        }),
      }),
    } as ExecutionContext;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        LocalNetworkGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app') {
                return {
                  systemApiIpRestrictionEnabled: true,
                };
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    guard = moduleRef.get(LocalNetworkGuard);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should allow localhost IPv4', () => {
    const ctx = createMockExecutionContext('127.0.0.1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow localhost IPv6', () => {
    const ctx = createMockExecutionContext('::1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow IPv4 private range 10.0.0.0/8', () => {
    const ctx = createMockExecutionContext('10.1.2.3');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow IPv4 private range 172.16.0.0/12', () => {
    const ctx = createMockExecutionContext('172.16.10.20');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow IPv4 private range 192.168.0.0/16', () => {
    const ctx = createMockExecutionContext('192.168.1.2');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow IPv4-mapped IPv6 when it maps to private IPv4', () => {
    const ctx = createMockExecutionContext('::ffff:192.168.1.2');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow IPv6 link-local fe80::/10', () => {
    const ctx = createMockExecutionContext('fe80::1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow IPv6 ULA fc00::/7', () => {
    const ctx = createMockExecutionContext('fd00::1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny public IPv4', () => {
    const ctx = createMockExecutionContext('8.8.8.8');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should deny public IPv6', () => {
    const ctx = createMockExecutionContext('2001:4860:4860::8888');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should allow when restriction disabled', async () => {
    const localModule = await Test.createTestingModule({
      providers: [
        LocalNetworkGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app') {
                return {
                  systemApiIpRestrictionEnabled: false,
                };
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const localGuard = localModule.get(LocalNetworkGuard);
    const ctx = createMockExecutionContext('8.8.8.8');
    expect(localGuard.canActivate(ctx)).toBe(true);

    await localModule.close();
  });
});
