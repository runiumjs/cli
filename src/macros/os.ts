import { platform, userInfo } from 'node:os';

/**
 * Get current operating system platform
 */
export function platformMacro(): string {
  return platform();
}

/**
 * Get current username
 */
export function usernameMacro(): string {
  return userInfo().username;
}
