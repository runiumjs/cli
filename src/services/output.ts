import { Console } from 'node:console';
import { setInterval, clearInterval } from 'node:timers';
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

export enum OutputStyle {
  // Styles
  RESET = '\x1b[0m',
  BOLD = '\x1b[1m',
  UNDERSCORE = '\x1b[4m',
  REVERSE = '\x1b[7m',

  // Foreground
  FG_BLACK = '\x1b[30m',
  FG_RED = '\x1b[31m',
  FG_GREEN = '\x1b[32m',
  FG_YELLOW = '\x1b[33m',
  FG_BLUE = '\x1b[34m',
  FG_MAGENTA = '\x1b[35m',
  FG_CYAN = '\x1b[36m',
  FG_WHITE = '\x1b[37m',

  // Background
  BG_BLACK = '\x1b[40m',
  BG_RED = '\x1b[41m',
  BG_GREEN = '\x1b[42m',
  BG_YELLOW = '\x1b[43m',
  BG_BLUE = '\x1b[44m',
  BG_MAGENTA = '\x1b[45m',
  BG_CYAN = '\x1b[46m',
  BG_WHITE = '\x1b[47m',
}

type OutputStyleKey = keyof typeof OutputStyle;

const DIVIDER_CHAR = '─';
const DIVIDER_LENGTH = 40;

const BOX_PADDING = 2;

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL = 100;

const PROGRESS_LENGTH = 40;
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

  /**
   * Get text output
   * @param message
   * @param args
   */
  getText(message: string, ...args: unknown[]): string {
    this.log(message, ...args);
    return (this.transform.read() || '').toString();
  }
}

const dumper = new ConsoleDumper();

@Service()
export class OutputService {
  private outputLevel: OutputLevel = OutputLevel.INFO;

  private readonly isColorEnabled: boolean;
  private readonly style: Record<OutputStyleKey, string>;

  constructor() {
    const isTermDumb = process.env.TERM === 'dumb';
    const isNoColor =
      !!process.env.NO_COLOR || process.env.RUNIUM_OUTPUT_NO_COLOR === 'true';
    this.isColorEnabled = !isTermDumb && !isNoColor;

    this.style = {} as Record<OutputStyleKey, string>;
    if (this.isColorEnabled) {
      for (const key in OutputStyle) {
        this.style[key as OutputStyleKey] = OutputStyle[key as OutputStyleKey];
      }
    } else {
      for (const key in OutputStyle) {
        this.style[key as OutputStyleKey] = '';
      }
    }
  }

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
   * Get output style
   */
  getStyle(): Record<keyof typeof OutputStyle, string> {
    return this.style;
  }

  /**
   * Log a trace message
   * @param message
   * @param args
   */
  trace(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.TRACE) {
      this.writeStdout(dumper.getText(message, ...args));
    }
  }

  /**
   * Log a debug message
   * @param message
   * @param args
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.DEBUG) {
      this.writeStdout(dumper.getText(message, ...args));
    }
  }

  /**
   * Log an info message
   * @param message
   * @param args
   */
  info(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.INFO) {
      this.writeStdout(
        `${this.style.FG_BLUE}ℹ ${dumper.getText(message, ...args)}${this.style.RESET}`
      );
    }
  }

  /**
   * Log a success message
   * @param message
   * @param args
   */
  success(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.INFO) {
      this.writeStdout(
        `${this.style.FG_GREEN}✔ ${dumper.getText(message, ...args)}${this.style.RESET}`
      );
    }
  }

  /**
   * Log a warning message
   * @param message
   * @param args
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.WARN) {
      this.writeStderr(
        `${this.style.FG_YELLOW}⚠ ${dumper.getText(message, ...args)}${this.style.RESET}`
      );
    }
  }

  /**
   * Log an error message
   * @param message
   * @param args
   */
  error(message: string, ...args: unknown[]): void {
    if (this.outputLevel <= OutputLevel.ERROR) {
      this.writeStderr(
        `${this.style.FG_RED}✖ ${dumper.getText(message, ...args)}${this.style.RESET}`
      );
    }
  }

  /**
   * Log a message without level
   * @param message
   * @param args
   */
  log(message: string, ...args: unknown[]): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      this.writeStdout(
        `${dumper.getText(message, ...args)}${this.style.RESET}`
      );
    }
  }

  /**
   * Output a table
   * @param data
   * @param columns
   * @param options
   */
  table(
    data: unknown[],
    columns?: string[],
    { order = true }: { order?: boolean } = {}
  ): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      const patchedData = order
        ? data.map((item, index) => ({
            ...(item as object),
            '#': index + 1,
          }))
        : data;
      const patchedOutput = dumper.getPatchedTable(
        patchedData,
        columns ? [...(order ? ['#'] : []), ...(columns || [])] : undefined
      );
      this.writeStdout(patchedOutput);
    }
  }

  /**
   * Output a tree
   * @param data
   * @param root
   * @param prefix
   * @param isLast
   */
  tree(data: unknown, root = 'root', prefix = '', isLast = true): void {
    const connector = isLast ? '└── ' : '├── ';

    const isObject = data !== null && typeof data === 'object';
    const label = `${this.style.BOLD}${root}${this.style.RESET}`;

    if (!isObject) {
      this.writeStdout(`${prefix}${connector}${label}: ${data}\n`);
      return;
    }

    this.writeStdout(`${prefix}${connector}${label}\n`);

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const dataRecord = data as Record<string, unknown>;
    const keys = Object.keys(dataRecord);
    keys.forEach((key, index) => {
      this.tree(dataRecord[key], key, childPrefix, index === keys.length - 1);
    });
  }

  /**
   * Output a blank line
   */
  newLine(): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      this.writeStdout('\n');
    }
  }

  /**
   * Output a divider line
   * @param char
   * @param length
   * @param color
   */
  divider(char = DIVIDER_CHAR, length = DIVIDER_LENGTH, color = ''): void {
    if (this.outputLevel < OutputLevel.SILENT) {
      this.writeStdout(
        `${color}${char.repeat(length > 0 ? length : DIVIDER_LENGTH)}${this.style.RESET}\n`
      );
    }
  }

  /**
   * Output a box
   * @param text
   * @param color
   */
  box(text: string, color: string = ''): void {
    const width = text.length + BOX_PADDING * 2;
    const line = DIVIDER_CHAR.repeat(width);
    this.writeStdout(`${color}┌${line}┐\n`);
    this.writeStdout(
      `${color}│${' '.repeat(BOX_PADDING)}${text}${color}${' '.repeat(BOX_PADDING)}│\n`
    );
    this.writeStdout(`${color}└${line}┘${this.style.RESET}\n`);
  }

  /**
   * Show spinner
   * @param status
   * @param text
   * @param completeText
   */
  spinner(status = () => true, text = '', completeText = ''): () => void {
    const frames = SPINNER_FRAMES;

    const clear = (intervalId: NodeJS.Timeout) => {
      clearInterval(intervalId);
      this.writeStdout('\r' + ' '.repeat(text.length + 4) + '\r');
      if (completeText) {
        this.success(completeText);
      }
    };

    let x = 0;
    const id = setInterval(() => {
      this.writeStdout(
        `\r${this.style.FG_CYAN}${frames[x++ % frames.length]}${this.style.RESET} ${text}`
      );
      if (!status()) {
        clear(id);
      }
    }, SPINNER_INTERVAL);

    return () => clear(id);
  }

  /**
   * Output a progress bar
   * @param current
   * @param total
   * @param completeText
   */
  progress(current: number, total: number, completeText: string = '') {
    const percent = Math.min(current / total, 1);
    const filled = Math.round(percent * PROGRESS_LENGTH);
    const bar = '█'.repeat(filled) + '░'.repeat(PROGRESS_LENGTH - filled);
    const label = `${Math.round(percent * 100)}%`;
    this.writeStdout(
      `\r${this.style.FG_CYAN}[${bar}]${this.style.RESET} ${label}  `
    );
    if (current >= total) {
      this.writeStdout('\r' + ' '.repeat(PROGRESS_LENGTH + 8) + '\r');
      if (completeText) {
        this.success(completeText);
      }
    }
  }

  /**
   * Clear output
   */
  clear(): void {
    // eslint-disable-next-line no-console
    console.clear();
  }

  /**
   * Write to stdout
   * @param message
   */
  writeStdout(message: string): void {
    process.stdout.write(message);
  }

  /**
   * Write to stderr
   * @param message
   */
  writeStderr(message: string): void {
    process.stderr.write(message);
  }
}
