import { ID_REGEX } from '@runium/core';

/**
 * Get plugin schema with function validation
 */
export function getPluginSchema(): object {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://runium.dev/schemas/plugin.json',
    title: 'Runium Plugin',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        pattern: ID_REGEX.source,
      },
      options: {
        type: 'object',
        description: 'Plugin configuration options',
        properties: {
          value: {
            type: 'object',
            description: 'Plugin options values',
            additionalProperties: true,
          },
          validate: {
            instanceof: 'Function',
            description: 'Function to validate plugin options',
          },
        },
        required: ['value', 'validate'],
        additionalProperties: false,
      },
      project: {
        type: 'object',
        description: 'Project-level plugin definitions',
        properties: {
          macros: {
            type: 'object',
            description: 'Macro definitions for config file expansion',
            additionalProperties: {
              instanceof: 'Function',
            },
          },
          tasks: {
            type: 'object',
            description: 'Task constructor definitions',
            additionalProperties: {
              instanceof: 'Function',
            },
          },
          actions: {
            type: 'object',
            description: 'Action function definitions',
            additionalProperties: {
              instanceof: 'Function',
            },
          },
          triggers: {
            type: 'object',
            description: 'Trigger constructor definitions',
            additionalProperties: {
              instanceof: 'Function',
            },
          },
          validationSchema: {
            type: 'object',
            description: 'JSON Schema extension for project config validation',
            additionalProperties: true,
          },
        },
        additionalProperties: false,
      },
      app: {
        type: 'object',
        description: 'Application-level plugin definitions',
        properties: {
          commands: {
            type: 'array',
            description: 'Command constructor definitions',
            items: {
              instanceof: 'Function',
            },
          },
        },
        additionalProperties: false,
      },
      hooks: {
        type: 'object',
        description: 'Lifecycle hooks for app and project events',
        properties: {
          app: {
            type: 'object',
            description: 'Application lifecycle hooks',
            properties: {
              afterInit: {
                instanceof: 'Function',
                description: 'Hook called after app initialization',
              },
              beforeExit: {
                instanceof: 'Function',
                description: 'Hook called before app exit',
              },
              beforeCommandRun: {
                instanceof: 'Function',
                description: 'Hook called before command execution',
              },
              afterCommandRun: {
                instanceof: 'Function',
                description: 'Hook called after command execution',
              },
            },
            additionalProperties: false,
          },
          project: {
            type: 'object',
            description: 'Project lifecycle hooks',
            properties: {
              beforeConfigRead: {
                instanceof: 'Function',
                description: 'Hook called before reading config file',
              },
              afterConfigRead: {
                instanceof: 'Function',
                description: 'Hook called after reading config file content',
              },
              afterConfigMacrosApply: {
                instanceof: 'Function',
                description: 'Hook called after applying macros to config',
              },
              afterConfigParse: {
                instanceof: 'Function',
                description: 'Hook called after parsing config',
              },
              beforeStart: {
                instanceof: 'Function',
                description: 'Hook called before project starts',
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
    required: ['name'],
    additionalProperties: false,
  };
}
