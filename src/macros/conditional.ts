/**
 * Equal
 * @param value1
 * @param value2
 * @param trueValue
 * @param falseValue
 */
export function eqMacro(
  value1: string,
  value2: string,
  trueValue?: string,
  falseValue?: string
): string {
  return value1 === value2 ? (trueValue ?? '') : (falseValue ?? '');
}

/**
 * Not equal
 * @param value1
 * @param value2
 * @param trueValue
 * @param falseValue
 */
export function neMacro(
  value1: string,
  value2: string,
  trueValue?: string,
  falseValue?: string
): string {
  return value1 !== value2 ? (trueValue ?? '') : (falseValue ?? '');
}
