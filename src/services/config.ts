import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Service } from 'typedi';
import { readJsonFile, RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import {
  createValidator,
  getConfigSchema,
  getErrorMessages,
} from '@validation';

interface ConfigEnv {
  path: string[];
}

interface ConfigOutput {
  debug: boolean;
}

interface ConfigProfile {
  path: string;
}

interface ConfigPlugin {
  path: string;
  file: boolean;
  disabled: boolean;
  options: Record<string, unknown>;
}

interface ConfigPlugins {
  [name: string]: ConfigPlugin;
}

interface ConfigProject {
  path: string;
}

interface ConfigProjects {
  [name: string]: ConfigProject;
}

interface ConfigData {
  env: ConfigEnv;
  output: ConfigOutput;
  profile: ConfigProfile;
  plugins: ConfigPlugins;
  projects: ConfigProjects;
}

interface ConfigInitOptions {
  profilePath?: string;
  debug?: boolean;
}

const CONFIG_FILE_NAME = '.runiumrc.json';
const CONFIG_FILE_PATH = join(process.cwd(), CONFIG_FILE_NAME);
const PROFILE_DIR_NAME = '.runium';
const HOME_PROFILE_PATH = join(homedir(), PROFILE_DIR_NAME);
const CWD_PROFILE_PATH = join(process.cwd(), PROFILE_DIR_NAME);

/**
 * Validate config data
 * @param data
 */
function validateConfigData(data: unknown): void {
  const schema = getConfigSchema();
  const validate = createValidator(schema);
  const result = validate(data);

  if (!result && validate.errors) {
    const errorMessages = getErrorMessages(validate.errors);

    throw new RuniumError(
      `Invalid "${CONFIG_FILE_PATH}" configuration data`,
      ErrorCode.CONFIG_INVALID_DATA,
      errorMessages
    );
  }
}

@Service()
export class ConfigService {
  private data: ConfigData = {
    profile: { path: HOME_PROFILE_PATH },
    plugins: {},
    projects: {},
    output: { debug: false },
    env: { path: [] },
  };

  /**
   * Initialize the config service
   * @param profilePath
   * @param debug
   */
  async init({ profilePath, debug }: ConfigInitOptions = {}): Promise<void> {
    if (profilePath) {
      this.data.profile.path = resolve(profilePath);
    } else if (existsSync(CWD_PROFILE_PATH)) {
      this.data.profile.path = CWD_PROFILE_PATH;
    }

    this.data.output.debug = debug ?? false;

    if (existsSync(CONFIG_FILE_PATH)) {
      const configData: Partial<ConfigData> =
        await readJsonFile<Partial<ConfigData>>(CONFIG_FILE_PATH);
      if (configData) {
        validateConfigData(configData);

        const data = {
          env: Object.assign({}, this.data.env, configData.env ?? {}),
          output: Object.assign({}, this.data.output, configData.output ?? {}),
          profile: Object.assign(
            {},
            this.data.profile,
            configData.profile ?? {}
          ),
          plugins: Object.assign(
            {},
            this.data.plugins,
            configData.plugins ?? {}
          ),
          projects: Object.assign(
            {},
            this.data.projects,
            configData.projects ?? {}
          ),
        };

        data.env.path = data.env.path.map(envPath => resolve(envPath));
        data.profile.path = resolve(data.profile.path);
        this.data = data;
      }
    }
  }

  /**
   * Get a configuration value
   * @param key
   */
  get<T extends keyof ConfigData>(key: T): ConfigData[T] {
    return this.data[key];
  }
}
