import { Command, Option } from 'commander';
import { Container, Service } from 'typedi';
import { isRuniumError, RuniumError } from '@runium/core';
import { ErrorCode, RuniumEvent } from '@constants';
import { EmitterService, PluginService } from '@services';
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

  private commandOptionAttributes: Map<string, Set<string>> = new Map();

  private commandOptionOwners: Map<string, Map<string, string>> = new Map();

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
      return commandName as string;
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

  registerCommandOptions(
    path: string,
    options: Option[],
    context: string
  ): void {
    const command = this.fullPathCommands.get(path);
    if (!command) {
      throw new RuniumError(
        `Failed to extend command "${path}" for "${context}": command not found`,
        ErrorCode.COMMAND_NOT_FOUND,
        { path, context }
      );
    }

    const registeredOptions = [...command.command.options];
    const owners =
      this.commandOptionOwners.get(path) ?? new Map<string, string>();

    for (const option of options) {
      if (!(option instanceof Option)) {
        throw new RuniumError(
          `Failed to extend command "${path}" for "${context}": option must be an instance of "CommandOption"`,
          ErrorCode.COMMAND_INCORRECT,
          { path, context, option }
        );
      }

      const conflictingOption = registeredOptions.find(registered => {
        const registeredFlags = [registered.short, registered.long].filter(
          Boolean
        );
        return [option.short, option.long]
          .filter(Boolean)
          .some(flag => registeredFlags.includes(flag));
      });

      if (conflictingOption) {
        const conflictingFlag = [option.short, option.long].find(flag =>
          [conflictingOption.short, conflictingOption.long].includes(flag)
        );
        throw new RuniumError(
          `Failed to extend command "${path}" for "${context}": option flag "${conflictingFlag}" is already registered by "${owners.get(conflictingFlag!) ?? 'app'}"`,
          ErrorCode.COMMAND_REGISTRATION_ERROR,
          { path, context, flag: conflictingFlag }
        );
      }

      const attribute = option.attributeName();
      const conflictingAttribute = registeredOptions.find(
        registered => registered.attributeName() === attribute
      );
      if (conflictingAttribute) {
        throw new RuniumError(
          `Failed to extend command "${path}" for "${context}": option attribute "${attribute}" is already registered`,
          ErrorCode.COMMAND_REGISTRATION_ERROR,
          { path, context, attribute }
        );
      }

      registeredOptions.push(option);
    }

    const attributes =
      this.commandOptionAttributes.get(path) ?? new Set<string>();
    for (const option of options) {
      command.command.addOption(option);
      attributes.add(option.attributeName());
      for (const flag of [option.short, option.long].filter(Boolean)) {
        owners.set(flag!, context);
      }
    }
    this.commandOptionAttributes.set(path, attributes);
    this.commandOptionOwners.set(path, owners);
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

      const optionAttributes = this.commandOptionAttributes.get(commandPath);
      const parsedOptions = args[args.length - 1];
      if (
        optionAttributes &&
        parsedOptions &&
        typeof parsedOptions === 'object' &&
        !Array.isArray(parsedOptions)
      ) {
        for (const attribute of optionAttributes) {
          delete (parsedOptions as Record<string, unknown>)[attribute];
        }
      }

      await handle.call(command, ...args);

      await pluginService.runHook('app.afterCommandRun', {
        command: commandPath,
        args,
      });

      const emitter = Container.get(EmitterService);
      await emitter.emit(RuniumEvent.APP_COMMAND_RUN, {
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
