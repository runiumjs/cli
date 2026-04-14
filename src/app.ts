import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { Container } from 'typedi';
import { RuniumError } from '@runium/core';
import * as commands from '@commands';
import {
  CommandService,
  ConfigService,
  ProfileService,
  PluginService,
  ShutdownService,
  OutputService,
  OutputLevel,
  PluginContextService,
} from '@services';
import { getVersion, parseRootOptions } from '@utils';

const RUNIUM_DESCRIPTION = `╔═══════════════════════╗
║ ╔═╗ ╦ ╦ ╔╗╔ ╦ ╦ ╦ ╔╦╗ ║
║ ╠╦╝ ║ ║ ║║║ ║ ║ ║ ║║║ ║
║ ╩╚═ ╚═╝ ╝╚╝ ╩ ╚═╝ ╩ ╩ ║
╚═══════════════════════╝
One Tool to Run Them All!`;

export class RuniumCliApp {
  private readonly program: Command;

  private commandService: CommandService;
  private configService: ConfigService;
  private profileService: ProfileService;
  private pluginService: PluginService;
  private shutdownService: ShutdownService;
  private outputService: OutputService;
  private pluginContextService: PluginContextService;

  constructor() {
    this.program = new Command('runium');
    this.configService = Container.get(ConfigService);
    this.profileService = Container.get(ProfileService);
    this.pluginService = Container.get(PluginService);
    this.shutdownService = Container.get(ShutdownService);
    this.outputService = Container.get(OutputService);
    this.pluginContextService = Container.get(PluginContextService);
    this.commandService = Container.get(CommandService);
  }

  /**
   * Start the application
   */
  async start(): Promise<Command> {
    const { debug, profile } = parseRootOptions();

    await this.configService
      .init({ profilePath: profile, debug })
      .catch(error => {
        this.initOutput();
        throw error;
      });

    this.initOutput();

    await this.shutdownService.init();
    await this.profileService.init();
    await this.pluginContextService.init();

    this.initEnv();

    await this.loadPlugins();
    await this.initProgram();
    await this.initPlugins();

    return this.program.parseAsync();
  }

  /**
   * Load plugins
   */
  private async loadPlugins(): Promise<void> {
    const plugins = this.profileService.getPlugins();
    for (const plugin of plugins) {
      if (plugin.disabled !== true) {
        try {
          const pluginPath = this.pluginService.resolvePath(
            plugin.path,
            plugin.file
          );
          await this.pluginService.loadPlugin(pluginPath, plugin.options);
        } catch (error) {
          this.outputService.error(`Failed to load plugin "${plugin.name}"`);
          const { code, message, payload } = error as RuniumError;
          this.outputService.debug('Error details:', {
            message,
            code,
            payload,
          });
        }
      }
    }
  }

  /**
   * Initialize the program
   */
  private async initProgram(): Promise<void> {
    const program = this.program;

    program.option('-D, --debug', 'enable debug mode');
    program.option('-E, --env [paths...]', 'load env files');
    program.option('-P, --profile <path>', 'set profile path');
    program.version(`runium ${getVersion()}`);
    program.description(RUNIUM_DESCRIPTION);

    program.on('option:debug', () => {
      this.setDebugMode();
    });

    program.on('option:env', path => {
      this.loadEnvFiles([path]);
    });

    Object.values(commands).forEach(CommandConstructor => {
      this.commandService.registerCommand(CommandConstructor, program);
    });
  }

  /**
   * Initialize the output
   */
  private initOutput(): void {
    const output = this.configService.get('output');
    if (output.debug) {
      this.setDebugMode();
    }
  }

  /**
   * Set debug mode
   */
  private setDebugMode(): void {
    if (this.outputService.getLevel() !== OutputLevel.DEBUG) {
      this.outputService.setLevel(OutputLevel.DEBUG);
      this.outputService.debug('Debug mode enabled');
    }
  }

  /**
   * Initialize the environment
   */
  private initEnv(): void {
    const env = this.configService.get('env');
    if (env.path.length > 0) {
      this.loadEnvFiles(env.path);
    }
  }

  /**
   * Set environment variables
   * @param path
   */
  private loadEnvFiles(path: string[]): void {
    for (const p of path) {
      const envPath = resolve((p && p.trim()) || '.env');
      if (existsSync(envPath)) {
        this.outputService.debug(`Loading env file "${envPath}"`);
        process.loadEnvFile(envPath);
      } else {
        this.outputService.error(`Env file "${envPath}" not found`);
      }
    }
  }

  /**
   * Initialize plugins
   */
  private async initPlugins(): Promise<void> {
    const plugins = this.pluginService.getAllPlugins();
    for (const plugin of plugins) {
      const commands = plugin.app?.commands;
      if (commands) {
        for (const command of commands) {
          this.commandService.registerCommand(
            command,
            this.program,
            plugin.name
          );
        }
      }
    }
    await this.pluginService.runHook('app.afterInit', {
      profilePath: this.configService.get('profile').path,
    });
  }
}
