import { PluginCommand } from './plugin-command.js';

/**
 * Plugin enable command
 */
export class PluginEnableCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('enable')
      .description('enable plugin')
      .option('-a, --all', 'enable all plugins')
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
      this.outputService.warn('No plugins specified to enable');
      return;
    }
    if (all) {
      names = this.profileService.getPlugins().map(p => p.name);
    }

    for (const name of names) {
      const plugin = this.ensureProfilePlugin(name);
      if (!plugin.disabled) {
        this.outputService.info(`Plugin "%s" is already enabled`, name);
        continue;
      }
      await this.profileService.updatePlugin(name, { disabled: false });
      const pluginPath = this.pluginService.resolvePath(
        plugin.path,
        plugin.file
      );
      await this.pluginService.loadPlugin(pluginPath, plugin.options);
      this.outputService.success(`Plugin "%s" successfully enabled`, name);
    }
  }
}
