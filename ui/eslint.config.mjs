import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

const isStrict = process.env.ESLINT_STRICT === '1' || process.env.CI === 'true';

export default [
  {
    ignores: ['.nuxt/', '.output/', 'node_modules/', 'coverage/', 'dist/'],
  },
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      'no-undef': isStrict ? 'error' : 'off',

      '@typescript-eslint/no-explicit-any': isStrict ? 'error' : 'warn',
      '@typescript-eslint/no-unused-vars': isStrict
        ? ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        : ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      'vue/require-default-prop': isStrict ? 'error' : 'warn',
      'vue/multi-word-component-names': isStrict ? 'error' : 'warn',
      'vue/no-mutating-props': isStrict ? 'error' : 'warn',
      'vue/no-v-html': isStrict ? 'error' : 'warn',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
  },
  eslintConfigPrettier,
];
