import { Command } from 'commander';
import { Container } from 'typedi';
import { CommandService, OutputService } from '@services';

export type RuniumCommandConstructor = new (program: Command) => RuniumCommand;

/**
 * Base runium command
 */
export abstract class RuniumCommand {
  /**
   * Output service
   */
  protected outputService: OutputService;

  /**
   * Current command
   */
  command: Command;

  /**
   * Subcommands
   */
  subcommands: RuniumCommandConstructor[] = [];

  /**
   * Run command
   */
  run: (...args: unknown[]) => Promise<void>;

  constructor(parent: Command) {
    const commandService = Container.get(CommandService);
    this.run = commandService.createRunCommand(this.handle, this);

    this.outputService = Container.get(OutputService);
    this.command = new Command();
    this.config();
    this.command.action(this.run.bind(this));

    parent.addCommand(this.command);
  }

  /**
   * Config command
   */
  protected abstract config(): void;

  /**
   * Handle command
   */
  protected abstract handle(...args: unknown[]): Promise<void>;
}
