import { randomUUID } from 'node:crypto';

/**
 * UUID v4
 */
export function uuidMacro(): string {
  return randomUUID();
}
