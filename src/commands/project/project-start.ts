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
import { ErrorCode, RuniumEvent } from '@constants';
import { AtomicWriter, EmitterService, ShutdownService } from '@services';
import { ProjectData, ProjectStateCommand } from './project-state-command.js';

/**
 * Project start command
 */
export class ProjectStartCommand extends ProjectStateCommand {
  protected shutdownService: ShutdownService;
  protected emitterService: EmitterService;
  protected fileWriter: AtomicWriter | null = null;

  constructor(parent: Command) {
    super(parent);
    this.shutdownService = Container.get(ShutdownService);
    this.emitterService = Container.get(EmitterService);
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

    this.proxyProjectEvents(project);

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
   * Proxy project events to emitter
   * @param project
   */
  private proxyProjectEvents(project: Project): void {
    project.on(ProjectEvent.STATE_CHANGE, state => {
      this.emitterService.emit(RuniumEvent.PROJECT_STATE_CHANGE, {
        id: project.getConfig().id,
        state,
      });
    });
    project.on(ProjectEvent.TASK_STATE_CHANGE, (taskId, state) => {
      this.emitterService.emit(RuniumEvent.PROJECT_TASK_STATE_CHANGE, {
        id: taskId,
        state,
      });
    });
    project.on(ProjectEvent.TASK_STDOUT, (taskId, data) => {
      this.emitterService.emit(RuniumEvent.PROJECT_TASK_STDOUT, {
        id: taskId,
        data,
      });
    });
    project.on(ProjectEvent.TASK_STDERR, (taskId, data) => {
      this.emitterService.emit(RuniumEvent.PROJECT_TASK_STDERR, {
        id: taskId,
        data,
      });
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
