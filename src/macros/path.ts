import { resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';

/**
 * Resolve path
 * @param path
 */
export function pathMacro(...path: string[]): string {
  return resolve(...path);
}

/**
 * Tmpdir path
 */
export function tmpDirMacro(): string {
  return tmpdir();
}

/**
 * Home directory path
 */
export function homeDirMacro(): string {
  return homedir();
}
