import { Console } from 'node:console';
import { Transform } from 'node:stream';
import { inspect } from 'node:util';

import { Service } from 'typedi';

export enum OutputLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5,
}

/**
 * Console dumper
 * wrapper around node console with a transform stream
 */
class ConsoleDumper extends Console {
  private readonly transform: Transform;

  constructor() {
    inspect.defaultOptions.depth = 5;

    const transform = new Transform({
      transform: (chunk, _, cb) => cb(null, chunk),
    });
    super({
      stdout: transform,
      stderr: transform,
      colorMode: false,
    });
    this.transform = transform;
  }

  /**
   * Get a table output with index column removed
   * @param data
   * @param columns
   */
  getPatchedTable(data: unknown[], columns?: string[]): string {
    this.table(data, columns);

    const original = (this.transform.read() || '').toString();

    // Tables should all start with roughly:
    // ┌─────────┬──────
    // │ (index) │
    // ├─────────┼
    const columnWidth = original.indexOf('┬') + 1;

    return original
      .split('\n')
      .map((line: string) => line.charAt(0) + line.slice(columnWidth))
      .join('\n')
      .replace(/'([^']*)'/g, '$1  ');
  }
}

const dumper = new ConsoleDumper();

@Service()
export class OutputService {
  private outputLevel: OutputLevel = OutputLevel.INFO;

  /**
   * Set output level
   * @param level
   */
  setLevel(level: OutputLevel): void {
    this.outputLevel = level;
  }

  /**
   * Get output level
   */
  getLevel(): OutputLevel {
    return this.outputLevel;
  }

  /**
   * Log a trace message
   * @param message
   * @param args
   */
  trace(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.TRACE) {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  }

  /**
   * Log a debug message
   * @param message
   * @param args
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.DEBUG) {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  }

  /**
   * Log an info message
   * @param message
   * @param args
   */
  info(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  }

  /**
   * Log a success message
   * @param message
   * @param args
   */
  success(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.INFO) {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  }

  /**
   * Log a warning message
   * @param message
   * @param args
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.WARN) {
      // eslint-disable-next-line no-console
      console.warn(message, ...args);
    }
  }

  /**
   * Log an error message
   * @param message
   * @param args
   */
  error(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.ERROR) {
      // eslint-disable-next-line no-console
      console.error(message, ...args);
    }
  }

  /**
   * Log a message without level
   * @param message
   * @param args
   */
  log(message: string, ...args: unknown[]): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  }

  /**
   * Output a table
   * @param data
   * @param columns
   */
  table(data: unknown[], columns?: string[]): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      const patchedData = data.map((item, index) => ({
        ...(item as object),
        '#': index + 1,
      }));
      const patchedOutput = dumper.getPatchedTable(
        patchedData,
        columns ? ['#', ...columns] : undefined
      );
      // eslint-disable-next-line no-console
      console.log(patchedOutput);
    }
  }

  /**
   * Output a blank line
   */
  newLine(): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      // eslint-disable-next-line no-console
      console.log('');
    }
  }

  /**
   * Clear output
   */
  clear(): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      // eslint-disable-next-line no-console
      console.clear();
    }
  }
}
