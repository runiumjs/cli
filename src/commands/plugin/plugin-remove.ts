import { PluginCommand } from './plugin-command.js';

/**
 * Plugin remove command
 */
export class PluginRemoveCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('remove')
      .description('remove plugin')
      .option('-a, --all', 'remove all plugins')
      .argument('[name...]', 'plugin names');
  }

  /**
   * Handle command
   * @param names
   * @param all
   */
  protected async handle(
    names: string[],
    { all }: { all: boolean }
  ): Promise<void> {
    if (names.length === 0 && !all) {
      this.outputService.warn('No plugins specified to remove');
      return;
    }
    if (all) {
      names = this.profileService.getPlugins().map(p => p.name);
    }

    for (const name of names) {
      this.ensureProfilePlugin(name);
      await this.profileService.removePlugin(name);
      await this.pluginService.unloadPlugin(name);
      this.outputService.success(`Plugin "%s" successfully removed`, name);
    }
  }
}
