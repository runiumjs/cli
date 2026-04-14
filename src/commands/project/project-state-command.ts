import { convertPathToValidFileName } from '@utils';
import { ProjectCommand } from './project-command.js';
import { ProjectState, TaskState } from '@runium/core';

export interface ProjectData {
  id: string;
  pid: number;
  cwd: string;
  path: string;
  state: {
    project: ProjectState[];
    tasks: Record<string, TaskState[]>;
  };
}

/**
 * Base project state command
 */
export abstract class ProjectStateCommand extends ProjectCommand {
  /**
   * Get project data file name
   * @param name
   */
  protected getProjectDataFileName(name: string): string {
    let fileName = convertPathToValidFileName(name);
    if (!fileName.endsWith('.json')) {
      fileName = fileName + '.json';
    }
    return fileName;
  }

  /**
   * Read project data
   * @param path
   */
  protected async readProjectData(path: string): Promise<ProjectData | null> {
    return this.fileService
      .readJson(path)
      .catch(() => null) as Promise<ProjectData | null>;
  }

  /**
   * Checks if a project process is started
   * @param pid
   */
  protected isProjectProcessStarted(pid: number): boolean {
    try {
      return process.kill(Number(pid), 0);
    } catch (ex) {
      return (ex as { code?: string }).code === 'EPERM';
    }
  }
}
