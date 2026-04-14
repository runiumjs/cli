import { RuniumCommand } from '@commands/runium-command.js';
import { ProjectAddCommand } from './project-add.js';
import { ProjectListCommand } from './project-list.js';
import { ProjectRemoveCommand } from './project-remove.js';
import { ProjectStartCommand } from './project-start.js';
import { ProjectStopCommand } from './project-stop.js';
import { ProjectStatusCommand } from './project-status.js';
import { ProjectValidateCommand } from './project-validate.js';

/**
 * Project group command
 */
export class ProjectCommand extends RuniumCommand {
  /**
   * Subcommands
   */
  subcommands = [
    ProjectListCommand,
    ProjectAddCommand,
    ProjectRemoveCommand,
    ProjectStartCommand,
    ProjectStopCommand,
    ProjectStatusCommand,
    ProjectValidateCommand,
  ];

  /**
   * Config command
   */
  protected config(): void {
    this.command.name('project').description('manage projects');
  }

  /**
   * Handle command
   */
  protected async handle(): Promise<void> {
    this.command.help();
  }
}
