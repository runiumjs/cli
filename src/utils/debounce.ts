import { setTimeout, clearTimeout } from 'node:timers';

const DEFAULT_DEBOUNCE_WAIT = 100;

/**
 * Create a debounced function
 * @param func
 * @param wait
 */
export function debounce(func: unknown, wait: number = DEFAULT_DEBOUNCE_WAIT) {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: unknown[]) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      (func as (...args: unknown[]) => unknown).apply(this, args);
      timeoutId = null;
    }, wait);
  };
}
