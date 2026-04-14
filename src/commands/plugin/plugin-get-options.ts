import { PluginCommand } from './plugin-command.js';

/**
 * Plugin get options command
 */
export class PluginGetOptionsCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('get-options')
      .description('get plugin options')
      .argument('<name>', 'plugin name')
      .option('-r, --raw', 'output raw JSON');
  }

  /**
   * Handle command
   * @param name
   * @param options
   */
  protected async handle(
    name: string,
    options: { raw?: boolean }
  ): Promise<void> {
    const profilePlugin = this.ensureProfilePlugin(name);

    const pluginName = await this.pluginService.loadPlugin(
      profilePlugin.path,
      profilePlugin.options
    );
    const plugin = await this.pluginService.getPluginByName(pluginName);

    if (plugin?.options) {
      if (options.raw) {
        this.outputService.info(JSON.stringify(profilePlugin.options, null, 2));
      } else {
        this.outputService.table(
          this.getFlattenedOptions(profilePlugin.options || {}),
          ['key', 'value', 'type']
        );
      }
    } else {
      this.outputService.info(
        'Plugin "%s" does not support options',
        profilePlugin.name
      );
    }
  }

  /**
   * Get flattened plugin options { key, value }
   * @param obj
   * @param prefix
   */
  protected getFlattenedOptions(
    obj: Record<string, unknown>,
    prefix = ''
  ): Array<{ key: string; value: unknown; type: string }> {
    const result: Array<{ key: string; value: unknown; type: string }> = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        result.push(
          ...this.getFlattenedOptions(value as Record<string, unknown>, fullKey)
        );
      } else {
        result.push({ key: fullKey, value, type: typeof value });
      }
    }

    return result;
  }
}
