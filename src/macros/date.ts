import { formatTimestamp } from '@utils/format-timestamp.js';

/**
 * Date
 */
export function dateMacro(): string {
  return formatTimestamp(Date.now());
}

/**
 * Timestamp
 */
export function timestampMacro(): string {
  return Date.now().toString();
}
