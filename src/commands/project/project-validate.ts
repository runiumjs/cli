import * as ajv from 'ajv';
import { ProjectCommand } from './project-command.js';
import { getErrorMessages } from '@validation';

interface ValidationError {
  code: string;
  payload: { errors: ajv.ErrorObject[] };
}

/**
 * Project validate command
 */
export class ProjectValidateCommand extends ProjectCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('validate')
      .description('validate project')
      .option('-f, --file', 'use file path instead of project name')
      .option('-o, --output', 'output project content')
      .argument('<name>', 'project name');
  }

  /**
   * Handle command
   * @param name
   * @param file
   * @param output
   */
  protected async handle(
    name: string,
    { file, output }: { file: boolean; output: boolean }
  ): Promise<void> {
    const path = file
      ? this.projectService.resolvePath(name)
      : this.ensureProfileProject(name).path;
    const projectInstance = await this.projectService.initProject(path);
    try {
      if (output) {
        this.outputService.log(
          JSON.stringify(projectInstance.getConfig(), null, 2)
        );
        return;
      }
      await projectInstance.validate();
      this.outputService.success(`Project "%s" is valid`, name);
    } catch (error) {
      const errorMessages = getErrorMessages(
        (error as ValidationError).payload.errors,
        {
          filter: error => error.original?.keyword !== 'oneOf',
        }
      );

      this.outputService.error(
        `Project "%s" validation failed:\n\n%s`,
        name,
        errorMessages.join('\n')
      );
    }
  }
}
