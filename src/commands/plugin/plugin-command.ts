import { Command } from 'commander';
import { Container } from 'typedi';
import { RuniumError } from '@runium/core';
import { RuniumCommand } from '@commands/runium-command.js';
import { ErrorCode } from '@constants';
import { PluginService, ProfileService, ProfilePlugin } from '@services';

/**
 * Base plugin command
 */
export abstract class PluginCommand extends RuniumCommand {
  protected pluginService: PluginService;
  protected profileService: ProfileService;

  constructor(parent: Command) {
    super(parent);
    this.pluginService = Container.get(PluginService);
    this.profileService = Container.get(ProfileService);
  }

  /**
   * Ensure plugin exists
   * @param name
   */
  protected ensureProfilePlugin(name: string): ProfilePlugin {
    const plugin = this.profileService.getPluginByName(name);
    if (!plugin) {
      throw new RuniumError(
        `Plugin "${name}" not found`,
        ErrorCode.PLUGIN_NOT_FOUND,
        { name }
      );
    }
    return plugin;
  }
}
