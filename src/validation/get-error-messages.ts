import { ErrorObject } from 'ajv';
import { AggregateAjvError, Options } from '@segment/ajv-human-errors';
import { AjvError } from '@segment/ajv-human-errors/dist/cjs/aggregate-ajv-error';

interface GetErrorMessagesOptions extends Options {
  filter?: (error: AjvError) => boolean;
}

/**
 * Get error messages
 * @param errors
 * @param options
 */
export function getErrorMessages(
  errors: ErrorObject[],
  options: GetErrorMessagesOptions = {
    filter: () => true,
  }
): string[] {
  const humanErrors = new AggregateAjvError(errors, {
    fieldLabels: 'jsonPath',
    includeData: true,
    includeOriginalError: true,
  });

  const filter = options?.filter ?? (_ => true);
  const messages = [];
  for (const error of humanErrors) {
    if (filter(error)) {
      messages.push(error.message);
    }
  }

  return messages;
}
