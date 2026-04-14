import Ajv, { ValidateFunction } from 'ajv/dist/2020.js';

const classes = { Function: Function };

export type Validator<T = unknown> = ValidateFunction<T>;

/**
 * Create validator
 * @param schema
 */
export function createValidator<T = unknown>(schema: object): Validator<T> {
  const ajv = new Ajv({
    allowUnionTypes: true,
    allErrors: true,
    verbose: true,
  });

  ajv.addKeyword({
    keyword: 'instanceof',
    schemaType: 'string',
    validate: (schema: string, data: unknown) => {
      return data instanceof classes[schema as keyof typeof classes];
    },
  });

  return ajv.compile<T>(schema);
}
