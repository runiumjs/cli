import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Option } from 'commander';
import { Inject, Service } from 'typedi';
import {
  isRuniumError,
  MacrosCollection,
  Project,
  ProjectConfig,
  ProjectSchemaExtension,
  RuniumError,
  RuniumTaskConstructor,
  RuniumTriggerConstructor,
  RuniumTriggerParams,
} from '@runium/core';
import { RuniumCommandConstructor } from '@commands/runium-command.js';
import { ErrorCode, RuniumEvent } from '@constants';
import { EmitterService, OutputService } from '@services';
import {
  createValidator,
  getErrorMessages,
  getPluginSchema,
} from '@validation';

const DEFAULT_PLUGIN_FACTORY_TIMEOUT = 10000;
const PLUGIN_FACTORY_TIMEOUT_ENV = 'RUNIUM_PLUGIN_FACTORY_TIMEOUT';

type PluginModule = {
  default: (options?: PluginOptions) => Plugin | Promise<Plugin>;
};

type PluginHookErrorHandler = (error: RuniumError) => void;

type PluginHookName =
  | `app.${keyof PluginAppHooksDefinition}`
  | `project.${keyof PluginProjectHooksDefinition}`;

interface PluginHookOptions<M extends boolean> {
  mutable?: M;
  onError?: PluginHookErrorHandler;
}

export interface PluginProjectDefinition {
  macros?: MacrosCollection;
  tasks?: Record<string, RuniumTaskConstructor>;
  actions?: Record<string, (options: unknown) => void>;
  triggers?: Record<string, RuniumTriggerConstructor<RuniumTriggerParams>>;
  validationSchema?: ProjectSchemaExtension;
}

export type PluginOptions = Record<string, unknown>;

export interface PluginOptionsDefinition {
  value: PluginOptions;
  validate: (options: PluginOptions) => boolean;
}

export interface PluginAppDefinition {
  commands?: RuniumCommandConstructor[];
  commandOptionExtensions?: PluginCommandOptionExtension[];
}

export interface PluginProjectHooksDefinition {
  beforeConfigRead?(path: string): Promise<void>;
  afterConfigRead?(content: string): Promise<string>;
  afterConfigMacrosApply?(content: string): Promise<string>;
  afterConfigParse?<T extends ProjectConfig>(config: T): Promise<T>;
  beforeStart?(params: {
    project: Project;
    path: string;
    name: string | null;
  }): Promise<void>;
}

export interface PluginAppHooksDefinition {
  afterInit?(params: { profilePath: string }): Promise<void>;
  beforeExit?(reason?: string): Promise<void>;
  beforeCommandRun?(params: {
    command: string;
    args: unknown[];
  }): Promise<void>;
  afterCommandRun?(params: { command: string; args: unknown[] }): Promise<void>;
}

export interface PluginHooksDefinition {
  app?: PluginAppHooksDefinition;
  project?: PluginProjectHooksDefinition;
}

export interface PluginCommandOptionExtension {
  command: string;
  options: Option[];
}

export interface Plugin {
  name: string;
  project?: PluginProjectDefinition;
  options?: PluginOptionsDefinition;
  app?: PluginAppDefinition;
  hooks?: PluginHooksDefinition;
}

@Service()
export class PluginService {
  /**
   * Loaded plugins
   */
  private plugins: Map<string, Plugin> = new Map();

  /**
   * Cached factory timeout
   */
  private factoryTimeout: number | null = null;

  /**
   * Validate plugin schema
   */
  private validator: ReturnType<typeof createValidator> =
    createValidator(getPluginSchema());

  constructor(
    @Inject() private outputService: OutputService,
    @Inject() private emitterService: EmitterService
  ) {}

  /**
   * Get plugin factory timeout from env
   */
  private getFactoryTimeout(): number {
    if (this.factoryTimeout !== null) {
      return this.factoryTimeout;
    }

    const raw = process.env[PLUGIN_FACTORY_TIMEOUT_ENV];
    if (!raw) {
      this.factoryTimeout = DEFAULT_PLUGIN_FACTORY_TIMEOUT;
      return this.factoryTimeout;
    }

    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value <= 0) {
      this.outputService.warn(
        `Invalid ${PLUGIN_FACTORY_TIMEOUT_ENV} value "${raw}", using default ${DEFAULT_PLUGIN_FACTORY_TIMEOUT}ms`
      );
      this.factoryTimeout = DEFAULT_PLUGIN_FACTORY_TIMEOUT;
      return this.factoryTimeout;
    }

    this.factoryTimeout = value;
    return this.factoryTimeout;
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   * @param name
   */
  getPluginByName(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Load plugin
   * @param path
   * @param options
   */
  async loadPlugin(
    path: string,
    options?: PluginOptions
  ): Promise<string | null> {
    if (!path || !existsSync(path)) {
      throw new RuniumError(
        `Plugin file "${path}" does not exist`,
        ErrorCode.PLUGIN_FILE_NOT_FOUND,
        { path }
      );
    }

    try {
      const pluginModule = (await import(
        pathToFileURL(path).href
      )) as PluginModule;
      const { default: getPlugin } = pluginModule;
      if (!getPlugin || typeof getPlugin !== 'function') {
        throw new RuniumError(
          'Plugin module must have a default function',
          ErrorCode.PLUGIN_INCORRECT_MODULE,
          { path }
        );
      }

      const timeout = this.getFactoryTimeout();
      const timeoutError = new RuniumError(
        `Plugin factory "${path}" timed out after ${timeout}ms`,
        ErrorCode.PLUGIN_FACTORY_TIMEOUT,
        { path, timeout }
      );

      let plugin: Plugin;
      try {
        plugin = await Promise.race([
          Promise.resolve(getPlugin(options)),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(timeoutError), timeout).unref()
          ),
        ]);
      } catch (error) {
        if (
          isRuniumError(error) &&
          (error as RuniumError).code === ErrorCode.PLUGIN_FACTORY_TIMEOUT
        ) {
          this.outputService.warn((error as Error).message);
          return null;
        }
        throw error;
      }

      this.validate(plugin);

      this.plugins.set(plugin.name, plugin);

      return plugin.name;
    } catch (error) {
      if (isRuniumError(error)) {
        throw error;
      }
      throw new RuniumError(
        `Failed to load plugin "${path}"`,
        ErrorCode.PLUGIN_LOAD_ERROR,
        { path, original: error }
      );
    }
  }

  /**
   * Unload plugin
   * @param name
   */
  async unloadPlugin(name: string): Promise<boolean> {
    return this.plugins.delete(name);
  }

  /**
   * Resolve path
   * @param path
   * @param isFile
   */
  resolvePath(path: string, isFile: boolean = false): string {
    try {
      return isFile ? resolve(path) : fileURLToPath(import.meta.resolve(path));
    } catch (error) {
      throw new RuniumError(
        `Failed to resolve plugin path "${path}"`,
        ErrorCode.PLUGIN_PATH_RESOLVE_ERROR,
        { path, original: error }
      );
    }
  }

  /**
   * Run plugin hook
   * @param name
   * @param params
   * @param options
   */
  async runHook<T, M extends boolean>(
    name: PluginHookName,
    params: T,
    { mutable, onError }: PluginHookOptions<M> = {}
  ): Promise<M extends true ? T : void> {
    const plugins = this.getAllPlugins();

    const [group, hookName] = name.split('.') as [
      keyof PluginHooksDefinition,
      keyof PluginHooksDefinition[keyof PluginHooksDefinition],
    ];

    for (const plugin of plugins) {
      const hook = plugin.hooks?.[group]?.[hookName] as
        | ((params: T) => Promise<T>)
        | undefined;
      if (hook) {
        try {
          if (!mutable) {
            await hook(params);
          } else {
            params = (await hook(params)) ?? params;
          }
        } catch (ex) {
          const error = new RuniumError(
            `Failed to run "${plugin.name}.${name}" hook`,
            ErrorCode.PLUGIN_HOOK_ERROR,
            { plugin: plugin.name, hook: name, original: ex }
          );
          if (onError) {
            onError(error);
          } else {
            this.outputService.error('Error: %s', error.message);
            this.outputService.debug('Error details:', {
              code: error.code,
              payload: error.payload,
            });
          }
        }
      }
    }

    await this.emitterService.emit(RuniumEvent.APP_PLUGINS_HOOK_RUN, {
      name,
      params,
    });
    return (mutable ? params : undefined) as M extends true ? T : void;
  }

  /**
   * Validate plugin
   * @param plugin
   */
  private validate(plugin: Plugin): void {
    const result = this.validator(plugin || {});
    if (!result && this.validator.errors) {
      const errorMessages = getErrorMessages(this.validator.errors);
      throw new RuniumError(
        'Incorrect plugin format',
        ErrorCode.PLUGIN_INVALID,
        { errors: errorMessages }
      );
    }
  }
}
