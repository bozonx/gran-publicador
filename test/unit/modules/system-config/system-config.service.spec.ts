import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';

// Define mocks before imports
jest.unstable_mockModule('node:fs', () => ({
  default: {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    copyFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.unstable_mockModule('node:path', () => ({
  default: {
    resolve: jest.fn(),
    join: jest.fn(),
    dirname: jest.fn(),
  },
  resolve: jest.fn(),
  join: jest.fn(),
  dirname: jest.fn(),
}));

jest.unstable_mockModule('../../../../src/config/database.config.js', () => ({
  getDataDir: jest.fn(),
  getDatabaseUrl: jest.fn(),
}));

// Dynamic imports
const fs = await import('node:fs');
const path = await import('node:path');
const { getDataDir } = await import('../../../../src/config/database.config.js');
const { SystemConfigService } =
  await import('../../../../src/modules/system-config/system-config.service.js');

describe('SystemConfigService', () => {
  let service: any; // Type as any to avoid complex type mocking issues for now
  const mockDataDir = '/mock/data/dir';
  const mockCwd = '/mock/cwd';

  // Helper to cast mocks
  const mockFs = fs as unknown as {
    existsSync: jest.Mock;
    readFileSync: jest.Mock;
    writeFileSync: jest.Mock;
    copyFileSync: jest.Mock;
  };
  const mockPath = path as unknown as {
    resolve: jest.Mock;
    join: jest.Mock;
    dirname: jest.Mock;
  };
  const mockGetDataDir = getDataDir as unknown as jest.Mock;

  beforeEach(async () => {
    jest.resetAllMocks();

    // Setup basic mocks
    mockGetDataDir.mockReturnValue(mockDataDir);
    mockPath.resolve.mockImplementation((...args: any[]) => args.join('/'));
    mockPath.join.mockImplementation((...args: any[]) => args.join('/'));
    mockPath.dirname.mockImplementation((p: any) => p.substring(0, p.lastIndexOf('/')));

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemConfigService],
    }).compile();

    service = module.get(SystemConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('should ensure config exists and reload it', async () => {
      // We can't easily spy on private/protected methods or same-class methods in JS without prototype manipulation or explicit spying if they call each other via 'this'.
      // SystemConfigService calls ensureConfigExists and reloadConfig in onModuleInit.
      // Since we integration test the service, we check if the underlying FS effects happen.

      mockFs.existsSync.mockReturnValue(true); // Config exists
      mockFs.readFileSync.mockReturnValue('key: val');

      await service.onModuleInit();

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('ensureConfigExists', () => {
    it('should copy default config if main config does not exist', () => {
      // Setup paths (not used in expectation, but kept as comment if needed)
      // const configPath = `${mockCwd}/${mockDataDir}/app-config.yaml`;

      // Mock fs.existsSync
      mockFs.existsSync.mockImplementation(((path: string) => {
        if (path.includes('app-config.yaml') && !path.includes('default')) return false;
        return true;
      }) as any);

      service.ensureConfigExists();

      // Verify copyFileSync was called
      expect(mockFs.copyFileSync).toHaveBeenCalled();
    });

    it('should not copy if config already exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      service.ensureConfigExists();
      expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('reloadConfig', () => {
    it('should load and parse config with env substitution', () => {
      const rawYaml = `
telegramAdminId: "\${TELEGRAM_ADMIN_ID}"
jwtSecret: \${JWT_SECRET:-defaultSecret}
plainKey: value
      `;

      process.env.TELEGRAM_ADMIN_ID = '123456789';
      delete process.env.JWT_SECRET;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(rawYaml);

      service.reloadConfig();
      const config = service.getConfig();

      expect(config.telegramAdminId).toBe('123456789');
      expect(config.jwtSecret).toBe('defaultSecret');
      expect(config.plainKey).toBe('value');
    });
  });

  describe('updateConfig', () => {
    it('should write new yaml content to file and reload', () => {
      const newYaml = 'newKey: newValue';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(newYaml);

      service.updateConfig(newYaml);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('app-config.yaml'),
        newYaml,
        'utf8',
      );
      expect(service.getConfig().newKey).toBe('newValue');
    });

    it('should throw error for invalid yaml', () => {
      const invalidYaml = 'key: : value';
      expect(() => service.updateConfig(invalidYaml)).toThrow();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
