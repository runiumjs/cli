import { RuniumError } from '@runium/core';
import { ErrorCode } from '@constants';
import { ProjectStateCommand } from './project-state-command.js';

/**
 * Project stop command
 */
export class ProjectStopCommand extends ProjectStateCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('stop')
      .description('stop project')
      .option('-f, --file', 'use file path instead of project name')
      .argument('<name>', 'project name');
  }

  /**
   * Handle command
   * @param name
   * @param file
   */
  protected async handle(
    name: string,
    { file }: { file: boolean }
  ): Promise<void> {
    const path = file
      ? this.projectService.resolvePath(name)
      : this.ensureProfileProject(name).path;

    const projectDataFileName = this.getProjectDataFileName(file ? path : name);
    const projectDataFilePath = this.profileService.getPath(
      'projects',
      projectDataFileName
    );

    // check if project is started
    const projectData = await this.readProjectData(projectDataFilePath);
    if (!projectData || !this.isProjectProcessStarted(projectData.pid)) {
      throw new RuniumError(
        `Project "${name}" is not started`,
        ErrorCode.PROJECT_NOT_STARTED,
        { name }
      );
    }

    try {
      process.kill(projectData.pid, 'SIGTERM');
    } catch (ex) {
      throw new RuniumError(
        `Failed to stop project "${name}"`,
        ErrorCode.PROJECT_STOP_ERROR,
        { name, original: ex }
      );
    }
  }
}
