import { dirname } from 'node:path';
import { Command, Option } from 'commander';
import { Container } from 'typedi';
import {
  Project,
  ProjectEvent,
  ProjectState,
  RuniumError,
  TaskState,
} from '@runium/core';
import { ErrorCode } from '@constants';
import { AtomicWriter, ShutdownService } from '@services';
import { ProjectData, ProjectStateCommand } from './project-state-command.js';

/**
 * Project start command
 */
export class ProjectStartCommand extends ProjectStateCommand {
  protected shutdownService: ShutdownService;
  protected fileWriter: AtomicWriter | null = null;

  constructor(parent: Command) {
    super(parent);
    this.shutdownService = Container.get(ShutdownService);
  }

  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('start')
      .description('start project')
      .option('-f, --file', 'use file path instead of project name')
      .option('-o, --output', 'output project state changes')
      .addOption(
        new Option('-w, --working-dir <choice>', 'set working directory')
          .choices(['cwd', 'project'])
          .default('cwd')
      )
      .argument('<name>', 'project name');
  }

  /**
   * Handle command
   * @param name
   * @param file
   * @param workingDir
   * @param output
   */
  protected async handle(
    name: string,
    {
      file,
      workingDir,
      output,
    }: { file: boolean; workingDir?: string; output?: boolean }
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
    if (projectData && this.isProjectProcessStarted(projectData.pid)) {
      throw new RuniumError(
        `Project "${name}" is already started`,
        ErrorCode.PROJECT_ALREADY_STARTED,
        { name }
      );
    }

    if (workingDir === 'project') {
      const projectDir = dirname(path);
      if (projectDir !== process.cwd()) {
        process.chdir(projectDir);
      }
    }

    const project = await this.projectService.initProject(path);
    this.shutdownService.addBlocker((reason?: string) => project.stop(reason));

    await this.fileService.ensureDirExists(dirname(projectDataFilePath));
    this.fileWriter = this.fileService.createAtomicWriter(projectDataFilePath);

    this.addProjectListeners(project, {
      projectPath: path,
      output,
    });

    await this.projectService.runHook('project.beforeStart', {
      project,
      path,
      name: file ? null : name,
    });

    await project.start();
  }

  /**
   * Add project listeners
   * @param project
   * @param options
   */
  protected addProjectListeners(
    project: Project,
    options: { projectPath: string; output?: boolean }
  ): void {
    const { projectPath, output } = options;

    const projectData: ProjectData = {
      id: project.getConfig().id,
      pid: process.pid,
      cwd: process.cwd(),
      path: projectPath,
      state: {
        project: [],
        tasks: {},
      },
    };

    const writeProjectData = () => {
      this.fileWriter!.writeJson(projectData).then();
    };

    // write initial data
    writeProjectData();

    project.on(ProjectEvent.STATE_CHANGE, async (state: ProjectState) => {
      projectData.state.project.push(state);
      writeProjectData();
      if (output) {
        this.outputService.info(
          'Project "%s" %s %s',
          projectData.id,
          state.status,
          state.reason ? `(${state.reason})` : ''
        );
      }
    });

    project.on(
      ProjectEvent.TASK_STATE_CHANGE,
      (taskId: string, state: TaskState) => {
        if (!projectData.state.tasks[taskId]) {
          projectData.state.tasks[taskId] = [];
        }
        projectData.state.tasks[taskId].push(state);
        writeProjectData();
        if (output) {
          const reason = this.getTaskStateReason(state);
          this.outputService.info(
            'Task "%s" %s %s',
            taskId,
            state.status,
            reason ? `(${reason})` : ''
          );
        }
      }
    );

    project.on(ProjectEvent.STATE_CHANGE, (state: ProjectState) => {
      if (state.status === 'stopped' && state.reason === 'action') {
        this.shutdownService.shutdown('project-stop').then();
      }
    });
  }

  /**
   * Get human-readable reason string from task state
   * @param state
   */
  private getTaskStateReason(state: TaskState): string {
    if (state.reason) return state.reason;
    if (state.exitCode) return `code=${state.exitCode}`;
    if (state.error) return `error=${state.error}`;
    return '';
  }
}
