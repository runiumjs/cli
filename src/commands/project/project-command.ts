import { Command } from 'commander';
import { Container } from 'typedi';
import { RuniumError } from '@runium/core';
import { RuniumCommand } from '@commands/runium-command.js';
import { ErrorCode } from '@constants';
import {
  ProfileService,
  ProjectService,
  ProfileProject,
  FileService,
} from '@services';

/**
 * Base project command
 */
export abstract class ProjectCommand extends RuniumCommand {
  protected projectService: ProjectService;
  protected profileService: ProfileService;
  protected fileService: FileService;

  constructor(parent: Command) {
    super(parent);
    this.projectService = Container.get(ProjectService);
    this.profileService = Container.get(ProfileService);
    this.fileService = Container.get(FileService);
  }

  /**
   * Ensure project exists
   * @param name
   */
  protected ensureProfileProject(name: string): ProfileProject {
    const project = this.profileService.getProjectByName(name);
    if (!project) {
      throw new RuniumError(
        `Project "${name}" not found`,
        ErrorCode.PROJECT_NOT_FOUND,
        { name }
      );
    }
    return project;
  }
}
