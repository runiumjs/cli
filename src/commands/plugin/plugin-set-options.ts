import { runInNewContext } from 'node:vm';
import { RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { deepMerge } from '@utils';
import { PluginCommand } from './plugin-command.js';

/**
 * Plugin set options command
 */
export class PluginSetOptionsCommand extends PluginCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('set-options')
      .description('set plugin options')
      .argument('<name>', 'plugin name')
      .argument('<value>', 'options value as an object literal string');
  }

  /**
   * Handle command
   * @param name
   * @param optionsStr
   */
  protected async handle(name: string, optionsStr: string): Promise<void> {
    const profilePlugin = this.ensureProfilePlugin(name);

    const pluginName = await this.pluginService.loadPlugin(
      profilePlugin.path,
      profilePlugin.options
    );
    const plugin = await this.pluginService.getPluginByName(pluginName);

    if (plugin?.options) {
      let parsed: Record<string, unknown> | null = {};
      try {
        parsed = runInNewContext(`(${optionsStr})`) as Record<string, unknown>;
      } catch (_) {
        parsed = null;
      }

      let result = false;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const merged = deepMerge(profilePlugin.options ?? {}, parsed);

        const isValid = plugin.options?.validate(merged) ?? false;
        if (isValid) {
          await this.profileService.updatePlugin(profilePlugin.name, {
            options: merged,
          });
          result = true;
        }
      }

      if (result) {
        this.outputService.info(
          'Plugin "%s" options successfully updated',
          profilePlugin.name
        );
      } else {
        throw new RuniumError(
          `Failed to set plugin "${profilePlugin.name}" options`,
          ErrorCode.PLUGIN_INVALID_OPTIONS,
          { name, value: optionsStr }
        );
      }
    } else {
      this.outputService.info(
        'Plugin "%s" does not support options',
        profilePlugin.name
      );
    }
  }
}
