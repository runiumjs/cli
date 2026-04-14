/**
 * Encode string to base64
 * @param value
 */
export function base64encodeMacro(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

/**
 * Decode base64 string
 * @param value
 */
export function base64decodeMacro(value: string): string {
  return Buffer.from(value, 'base64').toString('utf-8');
}
