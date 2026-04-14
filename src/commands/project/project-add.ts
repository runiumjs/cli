import { ID_REGEX, RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { ProjectCommand } from './project-command.js';

/**
 * Project add command
 */
export class ProjectAddCommand extends ProjectCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('add')
      .description('add project')
      .argument('<path>', 'project file path')
      .argument('[name]', 'project name (default: project config id)');
  }

  /**
   * Handle command
   * @param path
   * @param name
   */
  protected async handle(path: string, name?: string): Promise<void> {
    const projectPath = this.projectService.resolvePath(path);
    const project = await this.projectService.initProject(projectPath);
    if (project) {
      const projectName = name ?? project.getConfig().id;

      this.validateProjectName(projectName);

      await this.profileService.addProject({
        name: projectName,
        path: projectPath,
      });
      this.outputService.success(
        `Project "%s" successfully added`,
        projectName
      );
    } else {
      throw new RuniumError(
        `Failed to add project "${projectPath}"`,
        ErrorCode.PROJECT_NOT_FOUND,
        { path: projectPath }
      );
    }
  }

  /**
   * Validate project name
   * @param name - project name to validate
   * @throws RuniumError if name contains invalid characters
   */
  private validateProjectName(name: string): void {
    if (!ID_REGEX.test(name)) {
      throw new RuniumError(
        `Invalid project name "${name}". Only letters, digits, underscores (_), and hyphens (-) are allowed.`,
        ErrorCode.INVALID_ARGUMENT,
        { name }
      );
    }
  }
}
