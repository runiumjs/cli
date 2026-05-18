/**
 * Spread object/array value
 * @param params
 */
export function spreadMacro(...params: string[]): string {
  const trimmedValue = params.join(',').trim();
  if (
    (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) ||
    (trimmedValue.startsWith('{') && trimmedValue.endsWith('}'))
  ) {
    return trimmedValue.slice(1, -1);
  }
  return trimmedValue;
}
