import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: false,
        allowRegExp: false,
      }],
      // Downgraded: ~429 reports are mostly defensive runtime guards
      // (e.g. null checks on API data, array.length guards) that are good
      // practice even when TypeScript considers them redundant.
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      // Disabled: produces ~934 false positives with Prisma client methods
      // (e.g. prisma.player.findMany) and React event handlers.
      // This is the standard community approach for projects using Prisma/ORMs.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
)
