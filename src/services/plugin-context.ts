import { delimiter } from 'node:path';
import { Inject, Service } from 'typedi';
import { Argument, Option } from 'commander';
import {
  RuniumError,
  isRuniumError,
  RuniumTask,
  RuniumTrigger,
  applyMacros,
  TaskEvent,
  TaskStatus,
  ProjectEvent,
  ProjectStatus,
} from '@runium/core';
import { RuniumCommand } from '@commands/runium-command.js';
import {
  CommandService,
  EmitterService,
  FileService,
  OutputLevel,
  OutputService,
  ProfileService,
  ShutdownService,
} from '@services';
import { getVersion, convertPathToValidFileName } from '@utils';
import { createValidator } from '@validation';
import { ErrorCode, RuniumEvent } from '@constants';

global.runium = null;

@Service()
export class PluginContextService {
  constructor(
    @Inject() private commandService: CommandService,
    @Inject() private emitterService: EmitterService,
    @Inject() private outputService: OutputService,
    @Inject() private shutdownService: ShutdownService,
    @Inject() private fileService: FileService,
    @Inject() private profileService: ProfileService
  ) {}

  /**
   * Create a wrapper for a file service method that processes path parts
   * @param methodName
   */
  private createStorageWrapper<T extends keyof FileService>(
    methodName: T
  ): FileService[T] {
    return ((...args: unknown[]) => {
      const [pathParts, ...rest] = args;
      const resolvedPath = this.resolveProfilePath(
        pathParts as string | string[]
      );
      const method = this.fileService[methodName] as (
        ...args: unknown[]
      ) => unknown;
      return method(resolvedPath, ...rest);
    }) as FileService[T];
  }

  /**
   * Resolve path parts using profileService
   * @param pathParts
   */
  private resolveProfilePath(pathParts: string | string[]): string {
    const parts = Array.isArray(pathParts)
      ? pathParts
      : pathParts.split(delimiter);
    if (parts.length === 0 || parts.every(part => part.trim() === '')) {
      throw new RuniumError('Invalid path', ErrorCode.INVALID_PATH, {
        path: pathParts,
      });
    }
    return this.profileService.getPath(...parts);
  }

  /**
   * Initialize the plugin context service
   */
  async init(): Promise<void> {
    const command = this.commandService;
    const output = this.outputService;
    const shutdown = this.shutdownService;
    const emitter = this.emitterService;

    const runium: Record<string, unknown> = {};

    // define a lazy property on the runium object
    const defineLazy = <T>(key: string, factory: () => T): void => {
      let cached: T;
      let initialized = false;
      Object.defineProperty(runium, key, {
        get(): T {
          if (!initialized) {
            cached = factory();
            initialized = true;
          }
          return cached;
        },
        enumerable: true,
        configurable: true,
      });
    };

    defineLazy('class', () => ({
      RuniumCommand,
      CommandArgument: Argument,
      CommandOption: Option,
      RuniumError,
      RuniumTask,
      RuniumTrigger,
    }));

    defineLazy('enum', () => ({
      OutputLevel: Object.keys(OutputLevel)
        .filter(key => isNaN(Number(key)))
        .reduce(
          (acc, key) => {
            acc[key] = OutputLevel[key as keyof typeof OutputLevel];
            return acc;
          },
          {} as Record<string, number>
        ),
      OutputStyle: output.getStyle(),
      ProjectEvent,
      ProjectStatus,
      RuniumEvent,
      TaskEvent,
      TaskStatus,
    }));

    defineLazy('utils', () => ({
      applyMacros,
      isRuniumError,
      pathToId: convertPathToValidFileName,
    }));

    defineLazy('output', () => ({
      getLevel: output.getLevel.bind(output),
      setLevel: output.setLevel.bind(output),
      trace: output.trace.bind(output),
      debug: output.debug.bind(output),
      info: output.info.bind(output),
      success: output.success.bind(output),
      warn: output.warn.bind(output),
      error: output.error.bind(output),
      log: output.log.bind(output),
      table: output.table.bind(output),
      tree: output.tree.bind(output),
      newLine: output.newLine.bind(output),
      divider: output.divider.bind(output),
      box: output.box.bind(output),
      spinner: output.spinner.bind(output),
      progress: output.progress.bind(output),
      clear: output.clear.bind(output),
      writeStdout: output.writeStdout.bind(output),
      writeStderr: output.writeStderr.bind(output),
    }));

    defineLazy('shutdown', () => ({
      addBlocker: shutdown.addBlocker.bind(shutdown),
      removeBlocker: shutdown.removeBlocker.bind(shutdown),
    }));

    defineLazy('command', () => ({
      has: command.hasCommand.bind(command),
      run: command.runCommand.bind(command),
    }));

    defineLazy('storage', () => ({
      read: this.createStorageWrapper('read'),
      write: this.createStorageWrapper('write'),
      readJson: this.createStorageWrapper('readJson'),
      writeJson: this.createStorageWrapper('writeJson'),
      isExists: this.createStorageWrapper('isExists'),
      ensureDirExists: this.createStorageWrapper('ensureDirExists'),
      remove: this.createStorageWrapper('remove'),
      createAtomicWriter: this.createStorageWrapper('createAtomicWriter'),
      getPath: this.resolveProfilePath.bind(this),
    }));

    defineLazy('validation', () => ({
      createValidator,
    }));

    defineLazy('emitter', () => ({
      emit: emitter.emit.bind(emitter),
      on: emitter.on.bind(emitter),
      once: emitter.once.bind(emitter),
      onAny: emitter.onAny.bind(emitter),
      off: emitter.off.bind(emitter),
      offAny: emitter.offAny.bind(emitter),
    }));

    defineLazy('version', () => getVersion());

    global.runium = Object.freeze(runium as object);
  }
}
