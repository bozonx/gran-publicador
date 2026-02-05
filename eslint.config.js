import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import jest from 'eslint-plugin-jest';
import tseslint from 'typescript-eslint';

export default defineConfig(
    // Ignore patterns
    {
        ignores: ['dist/', 'node_modules/', 'coverage/', '.eslintrc.cjs'],
    },
    // Base ESLint recommended rules
    eslint.configs.recommended,

    // TypeScript ESLint (typed linting)
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.strictTypeChecked,

    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                sourceType: 'module',
                ecmaVersion: 'latest',
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            prettier,
        },
        rules: {
            // Prettier integration
            'prettier/prettier': 'error',

            // Project conventions
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/require-await': 'warn',
            '@typescript-eslint/prefer-as-const': 'error',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/no-import-type-side-effects': 'error',

            // NestJS-ish convention
            '@typescript-eslint/explicit-member-accessibility': [
                'warn',
                {
                    accessibility: 'explicit',
                    overrides: {
                        accessors: 'explicit',
                        constructors: 'no-public',
                        methods: 'explicit',
                        properties: 'explicit',
                        parameterProperties: 'explicit',
                    },
                },
            ],

            // General rules
            'no-console': 'warn',
            'no-debugger': 'error',
            'no-undef': 'off',
            'no-redeclare': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            'no-unused-vars': 'off',
        },
    },

    // Jest (tests only)
    {
        files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
        plugins: {
            jest,
        },
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
        rules: {
            'jest/no-disabled-tests': 'warn',
            'jest/no-focused-tests': 'error',
            'jest/no-identical-title': 'error',
            'jest/prefer-to-have-length': 'warn',
            'jest/valid-expect': 'error',
            'jest/expect-expect': 'error',
            'jest/no-done-callback': 'error',
            'jest/valid-describe-callback': 'error',

            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/explicit-member-accessibility': 'off',
            'no-console': 'off',
        },
    },

    // Prettier config (must be last to override other configs)
    prettierConfig,
);
