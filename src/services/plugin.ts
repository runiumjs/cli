import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { ErrorCode } from '@constants';
import { OutputService } from '@services';
import {
  createValidator,
  getErrorMessages,
  getPluginSchema,
} from '@validation';

type PluginModule = { default: (options?: PluginOptions) => Plugin };

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
   * Validate plugin schema
   * @private
   */
  private validator: ReturnType<typeof createValidator> =
    createValidator(getPluginSchema());

  constructor(@Inject() private outputService: OutputService) {}

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
  async loadPlugin(path: string, options?: PluginOptions): Promise<string> {
    if (!path || !existsSync(path)) {
      throw new RuniumError(
        `Plugin file "${path}" does not exist`,
        ErrorCode.PLUGIN_FILE_NOT_FOUND,
        { path }
      );
    }

    try {
      const pluginModule = (await import(path)) as PluginModule;
      const { default: getPlugin } = pluginModule;
      if (!getPlugin || typeof getPlugin !== 'function') {
        throw new RuniumError(
          'Plugin module must have a default function',
          ErrorCode.PLUGIN_INCORRECT_MODULE,
          { path }
        );
      }
      const plugin = getPlugin(options);

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
      const resolvedPath = isFile ? resolve(path) : import.meta.resolve(path);
      return resolvedPath.replace('file://', '');
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
