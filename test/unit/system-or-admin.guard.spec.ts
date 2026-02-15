import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SystemOrAdminGuard } from '../../src/modules/system/system-or-admin.guard.js';

describe('SystemOrAdminGuard (unit)', () => {
  const localNetworkGuard = {
    canActivate: jest.fn(),
  };

  const systemAuthGuard = {
    canActivate: jest.fn(),
  };

  const jwtAuthGuard = {
    canActivate: jest.fn(),
  };

  const usersService = {
    findById: jest.fn(),
  };

  let guard: SystemOrAdminGuard;

  const createContext = (request: Record<string, unknown>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    guard = new SystemOrAdminGuard(
      localNetworkGuard as any,
      systemAuthGuard as any,
      jwtAuthGuard as any,
      usersService as any,
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows system token flow when local network and token are valid', async () => {
    const context = createContext({
      headers: {
        'x-system-token': 'secret',
      },
    });

    localNetworkGuard.canActivate.mockReturnValue(true);
    systemAuthGuard.canActivate.mockReturnValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(localNetworkGuard.canActivate).toHaveBeenCalledWith(context);
    expect(systemAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('denies system token flow when local network check fails', async () => {
    const context = createContext({
      headers: {
        'x-system-token': 'secret',
      },
    });

    localNetworkGuard.canActivate.mockReturnValue(false);

    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(systemAuthGuard.canActivate).not.toHaveBeenCalled();
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('denies when JWT guard rejects request', async () => {
    const context = createContext({
      headers: {},
    });

    jwtAuthGuard.canActivate.mockReturnValue(false);

    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when user id is missing after JWT auth', async () => {
    const context = createContext({
      headers: {},
    });

    jwtAuthGuard.canActivate.mockReturnValue(true);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when authenticated user is not admin', async () => {
    const context = createContext({
      headers: {},
      user: {
        sub: 'user-1',
      },
    });

    jwtAuthGuard.canActivate.mockReturnValue(true);
    (usersService.findById as any).mockResolvedValue({ id: 'user-1', isAdmin: false });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows JWT flow when authenticated user is admin', async () => {
    const context = createContext({
      headers: {},
      user: {
        sub: 'admin-1',
      },
    });

    jwtAuthGuard.canActivate.mockReturnValue(true);
    (usersService.findById as any).mockResolvedValue({ id: 'admin-1', isAdmin: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
