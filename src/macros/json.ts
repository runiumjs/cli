import { runInNewContext } from 'node:vm';

/**
 * Create JSON from string
 * Safely evaluates string representation of JavaScript objects or primitives
 * @param params
 */
export function jsonMacro(...params: string[]): string {
  // join all parameters with comma
  // because macro parameters are separated by comma
  const value = params.join(',');

  const result = runInNewContext(`(${value})`);
  return JSON.stringify(result);
}
