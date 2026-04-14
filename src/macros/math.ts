/**
 * Generate random integer number
 * @param min
 * @param max
 */
export function randomMacro(min?: string, max?: string): string {
  const minNum = Number(min);
  const maxNum = Number(max);

  const minValue = Number.isNaN(minNum) || min === undefined ? 0 : minNum;
  const maxValue =
    Number.isNaN(maxNum) || max === undefined
      ? Number.MAX_SAFE_INTEGER
      : maxNum;

  return String(Math.floor(Math.random() * (maxValue - minValue) + minValue));
}

/**
 * Get minimum value
 * @param params
 */
export function minMacro(...params: string[]): string {
  const validNumbers: number[] = [];

  params.forEach(param => {
    const num = Number(param);
    if (!Number.isNaN(num)) {
      validNumbers.push(num);
    }
  });

  if (validNumbers.length === 0) {
    return '0';
  }

  return String(Math.min(...validNumbers));
}

/**
 * Get maximum value
 * @param params
 */
export function maxMacro(...params: string[]): string {
  const validNumbers: number[] = [];

  params.forEach(param => {
    const num = Number(param);
    if (!Number.isNaN(num)) {
      validNumbers.push(num);
    }
  });

  if (validNumbers.length === 0) {
    return '0';
  }

  return String(Math.max(...validNumbers));
}
