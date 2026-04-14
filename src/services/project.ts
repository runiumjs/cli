import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Inject, Service } from 'typedi';
import { applyMacros, Project, ProjectConfig, RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { macros } from '@macros';
import { PluginProjectDefinition, PluginService } from '@services';

@Service()
export class ProjectService {
  constructor(@Inject() private pluginService: PluginService) {}

  /**
   * Init project
   * @param path
   */
  async initProject(path: string): Promise<Project> {
    await this.pluginService.runHook('project.beforeConfigRead', path);

    let content = await this.readFile(path);
    content = await this.pluginService.runHook(
      'project.afterConfigRead',
      content,
      { mutable: true }
    );
    content = this.applyMacros(content);
    content = await this.pluginService.runHook(
      'project.afterConfigMacrosApply',
      content,
      { mutable: true }
    );

    let projectData = this.parseProjectContent(content, path);
    projectData = await this.pluginService.runHook(
      'project.afterConfigParse',
      projectData,
      { mutable: true }
    );

    const project = new Project(projectData);
    return this.extendProjectWithPlugins(project);
  }

  /**
   * Resolve path
   * @param path
   */
  resolvePath(path: string): string {
    return resolve(path);
  }

  /**
   * Run hook
   * @param args
   */
  runHook(
    ...args: Parameters<PluginService['runHook']>
  ): ReturnType<PluginService['runHook']> {
    return this.pluginService.runHook(...args);
  }

  /**
   * Read project file
   * @param path
   */
  private async readFile(path: string): Promise<string> {
    if (!existsSync(path)) {
      throw new RuniumError(
        `Project file "${path}" does not exist`,
        ErrorCode.PROJECT_FILE_NOT_FOUND,
        { path }
      );
    }
    try {
      return readFile(path, { encoding: 'utf-8' });
    } catch (error) {
      throw new RuniumError(
        `Failed to read project file "${path}"`,
        ErrorCode.PROJECT_FILE_CAN_NOT_READ,
        { path, original: error }
      );
    }
  }

  /**
   * Apply macros to text
   * @param text
   */
  private applyMacros(text: string): string {
    const plugins = this.pluginService.getAllPlugins();
    const pluginMacros = plugins.reduce(
      (acc, plugin) => ({ ...acc, ...(plugin.project?.macros || {}) }),
      {}
    );
    return applyMacros(text, { ...pluginMacros, ...macros });
  }

  /**
   * Parse project content
   * @param content
   * @param path
   */
  private parseProjectContent(content: string, path: string): ProjectConfig {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new RuniumError(
        `Failed to parse project "${path}"`,
        ErrorCode.PROJECT_JSON_PARSE_ERROR,
        { path, original: error }
      );
    }
  }

  /**
   * Extends the project with plugins
   * @param project
   */
  private extendProjectWithPlugins(project: Project): Project {
    const plugins = this.pluginService.getAllPlugins();

    plugins.forEach(plugin => {
      const { tasks, actions, triggers, validationSchema } = (plugin.project ||
        {}) as PluginProjectDefinition;
      Object.entries(actions || {}).forEach(([type, processor]) => {
        project.registerAction(type, processor);
      });
      Object.entries(tasks || {}).forEach(([type, processor]) => {
        project.registerTask(type, processor);
      });
      Object.entries(triggers || {}).forEach(([type, processor]) => {
        project.registerTrigger(type, processor);
      });
      if (validationSchema) {
        project.extendValidationSchema(validationSchema);
      }
    });

    return project;
  }
}
