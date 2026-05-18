/**
 * Weak key
 * Replaces all occurrences of "$weak(somevalue)" : with an empty string
 * @param value
 */
export function weakKeyGlobalMacro(value: string): string {
  return value.replace(/"\$weak\([^)]*\)"\s*:/g, '');
}
