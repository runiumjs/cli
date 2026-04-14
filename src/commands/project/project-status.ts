import { SILENT_EXIT_CODE } from '@runium/core';
import { formatTimestamp } from '@utils';
import { ProjectStateCommand } from './project-state-command.js';

interface StateRecord {
  name: string;
  status: string;
  time: string;
  timestamp: number;
  reason?: string;
  exitCode?: number;
}

/**
 * Project status command
 */
export class ProjectStatusCommand extends ProjectStateCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('status')
      .description('get project status')
      .option('-f, --file', 'use file path instead of project name')
      .option('-t, --tasks', 'show tasks status')
      .option('-a, --all', 'show status change history')
      .argument('<name>', 'project name');
  }

  /**
   * Handle command
   * @param name
   * @param file
   * @param tasks
   * @param all
   */
  protected async handle(
    name: string,
    { file, tasks, all }: { file: boolean; tasks: boolean; all: boolean }
  ): Promise<void> {
    const path = file
      ? this.projectService.resolvePath(name)
      : this.ensureProfileProject(name).path;

    const projectDataFileName = this.getProjectDataFileName(file ? path : name);
    const projectDataFilePath = this.profileService.getPath(
      'projects',
      projectDataFileName
    );

    const projectData = await this.readProjectData(projectDataFilePath);
    if (projectData) {
      let { project: projectState = [] } = projectData.state;
      if (!all) {
        projectState =
          projectState.length > 0
            ? [projectState[projectState.length - 1]]
            : [];
      }

      if (tasks) {
        const projectMappedState = projectState.map(state => {
          return {
            name: 'project',
            status: state.status,
            time: formatTimestamp(state.timestamp),
            timestamp: state.timestamp,
            reason: state.reason || '',
          };
        });

        const { tasks: tasksState = [] } = projectData.state;

        const tasksMappedState: StateRecord[] = [];
        Object.entries(tasksState).forEach(([key, value]) => {
          if (!all) {
            value = value.length > 0 ? [value[value.length - 1]] : [];
          }
          value.forEach(task => {
            const exitCode =
              task.exitCode && task.exitCode !== SILENT_EXIT_CODE
                ? task.exitCode
                : '';
            tasksMappedState.push({
              name: key,
              status: task.status,
              time: formatTimestamp(task.timestamp),
              timestamp: task.timestamp,
              reason: [task.reason, exitCode].filter(Boolean).join(' '),
            });
          });
        });

        const mappedState: StateRecord[] = [
          ...projectMappedState,
          ...tasksMappedState,
        ];
        mappedState.sort((a, b) => a.timestamp - b.timestamp);

        this.outputService.table(mappedState, [
          'time',
          'name',
          'status',
          'reason',
        ]);
      } else {
        const mappedState = projectState.map(state => {
          return {
            status: state.status,
            time: formatTimestamp(state.timestamp),
          };
        });

        this.outputService.table(mappedState, ['time', 'status']);
      }
    } else {
      this.outputService.info(`No project status for "${name}"`);
    }
  }
}
