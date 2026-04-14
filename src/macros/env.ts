/**
 * Get environment variable
 * @param name
 * @param defaultValue
 */
export function envMacro(name: string, defaultValue?: string): string {
  return process.env[name] ?? defaultValue ?? '';
}
