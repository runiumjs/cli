import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Service } from 'typedi';
import { RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { ConfigService, FileService } from '@services';

export interface ProfilePlugin {
  name: string;
  path: string;
  file?: boolean;
  disabled?: boolean;
  options?: Record<string, unknown>;
}

export interface ProfileProject {
  name: string;
  path: string;
}

const PLUGINS_FILE_NAME = 'plugins.json';
const PROJECTS_FILE_NAME = 'projects.json';

@Service()
export class ProfileService {
  private path: string = process.cwd();

  private plugins: ProfilePlugin[] = [];

  private projects: ProfileProject[] = [];

  constructor(
    @Inject() private configService: ConfigService,
    @Inject() private fileService: FileService
  ) {}

  /**
   * Initialize the profile service
   */
  async init(): Promise<void> {
    this.path = this.configService.get('profile').path;
    if (!existsSync(this.path)) {
      await mkdir(this.path, { recursive: true });
    }

    await this.readPlugins();
    await this.patchPlugins();
    await this.readProjects();
    await this.patchProjects();
  }

  /**
   * Get plugins
   */
  getPlugins(): ProfilePlugin[] {
    return this.plugins;
  }

  /**
   * Get plugin by name
   * @param name
   */
  getPluginByName(name: string): ProfilePlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  /**
   * Add plugin
   * @param plugin
   */
  async addPlugin(plugin: ProfilePlugin): Promise<void> {
    this.plugins = this.plugins
      .filter(p => p.name !== plugin.name)
      .concat(plugin);
    await this.writePlugins();
  }

  /**
   * Update plugin
   * @param name
   */
  async removePlugin(name: string): Promise<void> {
    this.plugins = this.plugins.filter(plugin => plugin.name !== name);
    await this.writePlugins();
  }

  /**
   * Update plugin
   * @param name
   * @param data
   */
  async updatePlugin(
    name: string,
    data: Partial<Omit<ProfilePlugin, 'name'>>
  ): Promise<void> {
    const index = this.plugins.findIndex(plugin => plugin.name === name);
    if (index !== -1) {
      this.plugins[index] = {
        ...this.plugins[index],
        ...data,
      };
      await this.writePlugins();
    }
  }

  /**
   * Get projects
   */
  getProjects(): ProfileProject[] {
    return this.projects;
  }

  /**
   * Get project by name
   * @param name
   */
  getProjectByName(name: string): ProfileProject | undefined {
    return this.projects.find(p => p.name === name);
  }

  /**
   * Add project
   * @param project
   */
  async addProject(project: ProfileProject): Promise<void> {
    this.projects = this.projects
      .filter(p => p.name !== project.name)
      .concat(project);
    await this.writeProjects();
  }

  /**
   * Remove project
   * @param name
   */
  async removeProject(name: string): Promise<void> {
    this.projects = this.projects.filter(p => p.name !== name);
    await this.writeProjects();
  }

  /**
   * Get path for a file
   * @param parts
   */
  getPath(...parts: string[]): string {
    return join(this.path, ...parts);
  }

  /**
   * Read plugins from file
   */
  private async readPlugins(): Promise<void> {
    this.plugins =
      ((await this.fileService
        .readJson(this.getPath(PLUGINS_FILE_NAME))
        .catch(() => [])) as ProfilePlugin[]) || this.plugins;
  }

  /**
   * Write plugins to file
   */
  private async writePlugins(): Promise<void> {
    await this.fileService.writeJson(
      this.getPath(PLUGINS_FILE_NAME),
      this.plugins
    );
  }

  /**
   * Patch plugins
   */
  private async patchPlugins(): Promise<void> {
    const pluginsConfig = { ...this.configService.get('plugins') };
    for (const plugin of this.plugins) {
      const config = pluginsConfig[plugin.name];
      if (config) {
        Object.assign(plugin, config);
        delete pluginsConfig[plugin.name];
      }
    }
    // add remaining plugins
    for (const name in pluginsConfig) {
      if (pluginsConfig[name].path) {
        this.plugins.push({ name, ...pluginsConfig[name] });
      } else {
        throw new RuniumError(
          'Plugin path is not specified',
          ErrorCode.PLUGIN_PATH_NOT_SPECIFIED,
          { name, data: pluginsConfig[name] }
        );
      }
    }
  }

  /**
   * Read projects from file
   */
  private async readProjects(): Promise<void> {
    this.projects =
      ((await this.fileService
        .readJson(this.getPath(PROJECTS_FILE_NAME))
        .catch(() => [])) as ProfileProject[]) || this.projects;
  }

  /**
   * Write projects to file
   */
  private async writeProjects(): Promise<void> {
    await this.fileService.writeJson(
      this.getPath(PROJECTS_FILE_NAME),
      this.projects
    );
  }

  private async patchProjects(): Promise<void> {
    const projectsConfig = { ...this.configService.get('projects') };
    for (const project of this.projects) {
      const config = projectsConfig[project.name];
      if (config) {
        Object.assign(project, config);
        delete projectsConfig[project.name];
      }
    }
    // add remaining projects
    for (const name in projectsConfig) {
      if (projectsConfig[name].path) {
        this.projects.push({ name, ...projectsConfig[name] });
      } else {
        throw new RuniumError(
          'Project path is not specified',
          ErrorCode.PROJECT_PATH_NOT_SPECIFIED,
          { name, data: projectsConfig[name] }
        );
      }
    }
  }
}
