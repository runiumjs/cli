import { ProjectCommand } from './project-command.js';

/**
 * Project list command
 */
export class ProjectListCommand extends ProjectCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('list')
      .description('list projects')
      .option('-s, --sort', 'sort by name');
  }

  /**
   * Handle command
   */
  protected async handle({ sort }: { sort: boolean }): Promise<void> {
    const projects = this.profileService.getProjects();
    if (sort) {
      projects.sort((a, b) => a.name.localeCompare(b.name));
    }
    // handle empty list
    if (projects.length !== 0) {
      this.outputService.table(projects, ['name', 'path']);
    } else {
      this.outputService.warn('No projects found');
    }
  }
}
