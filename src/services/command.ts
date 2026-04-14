import { Command } from 'commander';
import { Container, Service } from 'typedi';
import { isRuniumError, RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { PluginService } from '@services';
import {
  RuniumCommand,
  RuniumCommandConstructor,
} from '@commands/runium-command.js';

const PROGRAM_NAME = 'runium';

@Service()
export class CommandService {
  /**
   * Full path commands
   */
  private fullPathCommands: Map<string, RuniumCommand> = new Map();

  /**
   * Get command full path recursively
   * @param command
   */
  private getCommandFullPath(command: RuniumCommand): string {
    const commandName = command.command?.name();

    if (commandName === PROGRAM_NAME || !command.command.parent) {
      return '';
    }

    // find the parent command instance
    const parentCommand = Array.from(this.fullPathCommands.values()).find(
      cmd => cmd.command === command.command.parent
    );

    if (parentCommand) {
      // recursively get parent's full path
      const parentPath = this.getCommandFullPath(parentCommand);
      return [parentPath, commandName].filter(Boolean).join(' ').trim();
    }

    // fallback: if parent not found in map, check if parent is the program
    const parentName = command.command.parent.name();
    if (parentName === PROGRAM_NAME) {
      return commandName;
    }

    return [parentName, commandName].join(' ').trim();
  }

  /**
   * Register command
   * @param command
   * @param program
   * @param context
   */
  registerCommand(
    command: RuniumCommandConstructor,
    program: Command,
    context: string = 'app'
  ): void {
    const addCommand = (
      CommandConstructor: RuniumCommandConstructor,
      parent: Command
    ) => {
      try {
        if (!(CommandConstructor.prototype instanceof RuniumCommand)) {
          throw new RuniumError(
            `Command "${CommandConstructor.name}" for "${context}" must be a subclass of "RuniumCommand"`,
            ErrorCode.COMMAND_INCORRECT,
            {
              context,
              CommandConstructor,
            }
          );
        }

        const commandInstance: RuniumCommand = new CommandConstructor(parent);

        const commandPath = this.getCommandFullPath(commandInstance);
        this.fullPathCommands.set(commandPath, commandInstance);

        if (commandInstance.subcommands.length > 0) {
          commandInstance.subcommands.forEach(subcommand => {
            addCommand(subcommand, commandInstance.command);
          });
        }
      } catch (error) {
        if (isRuniumError(error)) {
          throw error;
        }
        throw new RuniumError(
          `Failed to register command "${CommandConstructor.name}" for "${context}"`,
          ErrorCode.COMMAND_REGISTRATION_ERROR,
          { original: error }
        );
      }
    };

    addCommand(command, program);
  }

  /**
   * Create run command
   * @param handle
   * @param command
   */
  createRunCommand(
    handle: (...args: unknown[]) => Promise<void>,
    command: RuniumCommand
  ): (...args: unknown[]) => Promise<void> {
    const pluginService = Container.get(PluginService);
    return async (...args: unknown[]): Promise<void> => {
      // run from command action contains command
      // run from plugin context does not contain command
      if (args?.length > 0 && args[args.length - 1] instanceof Command) {
        args.pop();
      }

      const commandPath = this.getCommandFullPath(command);

      await pluginService.runHook('app.beforeCommandRun', {
        command: commandPath,
        args,
      });

      await handle.call(command, ...args);

      await pluginService.runHook('app.afterCommandRun', {
        command: commandPath,
        args,
      });
    };
  }

  /**
   * Check if command exists
   * @param path
   */
  hasCommand(path: string): boolean {
    return this.fullPathCommands.has(path);
  }

  /**
   * Run command
   * @param path
   * @param args
   */
  async runCommand(path: string, ...args: unknown[]): Promise<void> {
    const command = this.fullPathCommands.get(path);
    if (!command) {
      throw new RuniumError(
        `Command "${path}" not found`,
        ErrorCode.COMMAND_NOT_FOUND,
        { path }
      );
    }
    try {
      await command.run(...args);
    } catch (error) {
      if (isRuniumError(error)) {
        throw error;
      }
      throw new RuniumError(
        `Failed to run command "${path}"`,
        ErrorCode.COMMAND_RUN_ERROR,
        { original: error }
      );
    }
  }
}
