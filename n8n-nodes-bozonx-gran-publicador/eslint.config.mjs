import { config } from '@n8n/node-cli/eslint';

export default [
    ...config,
    {
        rules: {
            // This node uses @telegraf/entity for Telegram entity conversion.
            // It's intended for self-hosted n8n instances, not n8n Cloud.
            '@n8n/community-nodes/no-restricted-imports': 'off',
        },
    },
];
