import { readFileSync } from 'node:fs';

/**
 * Read file content synchronously
 * @param filePath
 */
export function fileContentMacro(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}
