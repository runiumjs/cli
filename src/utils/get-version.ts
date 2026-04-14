import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let version: string | null = null;

export function getVersion(): string {
  if (!version) {
    const packageJsonPath = resolve(import.meta.dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version;
  }
  return version as string;
}
