import { RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { PluginCommand } from './plugin-command.js';
/**
 * Plugin add command
 */
export class PluginAddCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('add')
      .description('add plugin')
      .option('-f, --file', 'use file path instead of plugin package name')
      .argument('<plugin>', 'plugin package name or absolute file path');
  }

  /**
   * Handle command
   * @param path
   * @param file
   */
  protected async handle(
    path: string,
    { file: isFile }: { file: boolean }
  ): Promise<void> {
    const pluginPath = this.pluginService.resolvePath(path, isFile);
    const name = await this.pluginService.loadPlugin(pluginPath, {});
    const plugin = this.pluginService.getPluginByName(name);
    if (plugin) {
      await this.profileService.addPlugin({
        name,
        path: isFile ? pluginPath : path,
        file: isFile,
        disabled: false,
        options: plugin.options?.value ?? {},
      });
      this.outputService.success(`Plugin "%s" successfully added`, name);
    } else {
      throw new RuniumError(
        `Failed to add plugin "${path}"`,
        ErrorCode.PLUGIN_NOT_FOUND,
        { name, path }
      );
    }
  }
}
