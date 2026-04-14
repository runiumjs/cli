import { Option } from 'commander';
import { PluginCommand } from './plugin-command.js';

/**
 * Plugin list command
 */
export class PluginListCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('list')
      .addOption(
        new Option('-d, --disabled', 'show only disabled plugins').conflicts(
          'enabled'
        )
      )
      .addOption(
        new Option('-e, --enabled', 'show only enabled plugins').conflicts(
          'disabled'
        )
      )
      .option('-s, --sort', 'sort by name')
      .description('list plugins');
  }

  /**
   * Handle command
   */
  protected async handle({
    disabled,
    enabled,
    sort,
  }: {
    disabled: boolean;
    enabled: boolean;
    sort: boolean;
  }): Promise<void> {
    let plugins = this.profileService.getPlugins();
    if (disabled) {
      plugins = plugins.filter(p => p.disabled === true);
    }
    if (enabled) {
      plugins = plugins.filter(p => p.disabled === false);
    }
    if (sort) {
      plugins.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (plugins.length !== 0) {
      this.outputService.table(plugins, [
        'name',
        'path',
        ...(disabled || enabled ? [] : ['disabled']),
      ]);
    } else {
      this.outputService.warn('No plugins found');
    }
  }
}
