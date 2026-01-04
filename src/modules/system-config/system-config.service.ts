import * as fs from 'node:fs';
import * as path from 'node:path';

import { BadRequestException, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import * as yaml from 'js-yaml';

import { getDataDir } from '../../config/database.config.js';

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private readonly configFileName = 'app-config.yaml';
  private readonly defaultConfigFileName = 'app-config-default.yaml';
  private currentConfig: Record<string, any> = {};

  public onModuleInit() {
    this.ensureConfigExists();
    this.reloadConfig();
  }

  /**
   * Ensures that the configuration file exists in DATA_DIR.
   * If not, copies the default configuration from the root directory.
   */
  public ensureConfigExists() {
    try {
      const dataDir = getDataDir();
      const configPath = path.join(path.resolve(process.cwd(), dataDir), this.configFileName);
      const defaultPath = path.resolve(process.cwd(), this.defaultConfigFileName);

      if (!fs.existsSync(configPath)) {
        this.logger.log(
          `Configuration file not found at ${configPath}. Copying from ${defaultPath}`,
        );

        if (!fs.existsSync(path.dirname(configPath))) {
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }

        fs.copyFileSync(defaultPath, configPath);
        this.logger.log('Default configuration file created.');
      }
    } catch (error) {
      this.logger.error('Failed to ensure config exists:', error);
    }
  }

  /**
   * Reads the YAML config file, replaces environment variables, and parses it.
   */
  public reloadConfig() {
    try {
      const dataDir = getDataDir();
      const configPath = path.join(path.resolve(process.cwd(), dataDir), this.configFileName);

      if (!fs.existsSync(configPath)) {
        this.logger.warn('Config file does not exist, cannot reload.');
        return;
      }

      const rawContent = fs.readFileSync(configPath, 'utf8');
      const substitutedContent = this.substituteEnvVars(rawContent);
      this.currentConfig = (yaml.load(substitutedContent) as Record<string, any>) || {};
      this.logger.log('Configuration reloaded successfully.');
    } catch (error) {
      this.logger.error('Failed to reload configuration:', error);
    }
  }

  /**
   * Replaces ${VAR_NAME} or ${VAR_NAME:-default} with environment variables.
   */
  private substituteEnvVars(content: string): string {
    return content.replace(/\${(\w+)(?::-([^}]*))?}/g, (_, varName, defaultValue) => {
      return process.env[varName] ?? defaultValue ?? '';
    });
  }

  /**
   * Returns the parsed configuration object.
   */
  public getConfig() {
    return this.currentConfig;
  }

  /**
   * Returns the raw YAML content of the configuration file.
   */
  public getRawConfig(): string {
    const dataDir = getDataDir();
    const configPath = path.join(path.resolve(process.cwd(), dataDir), this.configFileName);
    return fs.readFileSync(configPath, 'utf8');
  }

  /**
   * Updates the configuration file with new YAML content.
   * Validates the YAML before saving.
   */
  public updateConfig(newYamlContent: string) {
    try {
      // Validate YAML syntax
      const parsed = yaml.load(newYamlContent);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new BadRequestException('Config must be a YAML object');
      }

      const dataDir = getDataDir();
      const configPath = path.join(path.resolve(process.cwd(), dataDir), this.configFileName);

      fs.writeFileSync(configPath, newYamlContent, 'utf8');
      this.reloadConfig();
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      throw error;
    }
  }
}
