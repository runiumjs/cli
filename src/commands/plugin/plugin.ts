import { RuniumCommand } from '@commands/runium-command.js';
import { PluginAddCommand } from './plugin-add.js';
import { PluginDisableCommand } from './plugin-disable.js';
import { PluginEnableCommand } from './plugin-enable.js';
import { PluginListCommand } from './plugin-list.js';
import { PluginRemoveCommand } from './plugin-remove.js';
import { PluginGetOptionsCommand } from './plugin-get-options.js';
import { PluginSetOptionsCommand } from './plugin-set-options.js';

/**
 * Plugin group command
 */
export class PluginCommand extends RuniumCommand {
  /**
   * Subcommands
   */
  subcommands = [
    PluginListCommand,
    PluginAddCommand,
    PluginRemoveCommand,
    PluginDisableCommand,
    PluginEnableCommand,
    PluginGetOptionsCommand,
    PluginSetOptionsCommand,
  ];

  /**
   * Config command
   */
  protected config(): void {
    this.command.name('plugin').description('manage plugins');
  }

  /**
   * Handle command
   */
  protected async handle(): Promise<void> {
    this.command.help();
  }
}
