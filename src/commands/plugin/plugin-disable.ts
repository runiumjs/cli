import { PluginCommand } from './plugin-command.js';

/**
 * Plugin disable command
 */
export class PluginDisableCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('disable')
      .description('disable plugin')
      .option('-a, --all', 'disable all plugins')
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
      this.outputService.warn('No plugins specified to disable');
      return;
    }
    if (all) {
      names = this.profileService.getPlugins().map(p => p.name);
    }

    for (const name of names) {
      const plugin = this.ensureProfilePlugin(name);
      if (plugin.disabled) {
        this.outputService.info(`Plugin "%s" is already disabled`, name);
        continue;
      }
      await this.profileService.updatePlugin(name, { disabled: true });
      await this.pluginService.unloadPlugin(name);
      this.outputService.success(`Plugin "%s" successfully disabled`, name);
    }
  }
}
