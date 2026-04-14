/**
 * Get config schema
 */
export function getConfigSchema(): object {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://runium.dev/schemas/config.json',
    title: 'Runium Config',
    type: 'object',
    properties: {
      env: {
        type: 'object',
        properties: {
          path: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
      output: {
        type: 'object',
        properties: {
          debug: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
      profile: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
      plugins: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
            },
            file: {
              type: 'boolean',
            },
            disabled: {
              type: 'boolean',
            },
            options: {
              type: 'object',
            },
          },
          additionalProperties: false,
        },
      },
      projects: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
            },
          },
          additionalProperties: false,
          required: ['path'],
        },
      },
    },
    additionalProperties: false,
  };
}
