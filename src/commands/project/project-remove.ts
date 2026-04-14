import { ProjectCommand } from './project-command.js';

/**
 * Project remove command
 */
export class ProjectRemoveCommand extends ProjectCommand {
  /**
   * Config command
   */
  protected config(): void {
    this.command
      .name('remove')
      .description('remove project')
      .option('-a, --all', 'remove all projects')
      .argument('[name...]', 'project names');
  }

  /**
   * Handle command
   * @param names
   * @param all
   */
  protected async handle(
    names: string[],
    { all }: { all: boolean }
  ): Promise<void> {
    if (names.length === 0 && !all) {
      this.outputService.warn('No projects specified to remove');
      return;
    }
    if (all) {
      names = this.profileService.getProjects().map(p => p.name);
    }

    for (const name of names) {
      this.ensureProfileProject(name);
      await this.profileService.removeProject(name);
      this.outputService.success(`Project "%s" successfully removed`, name);
    }
  }
}
