import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { fsdRule } from './tools/eslint/fsd.mjs'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['postman/mocks/**/*.cjs'],
    // Postman mock handlers execute as CommonJS.
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores([
    'android/**',
    '.next*/**',
    'out/**',
    'node_modules/**',
    'next-env.d.ts',
    'test-results/**',
    'playwright-report/**',
    'coverage/**',
    'postman/skills/**',
    '.postman/**',
  ]),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { architecture: { rules: { fsd: fsdRule } } },
    rules: {
      'architecture/fsd': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name=/^(style|styles|sx)$/]',
          message: 'Use Mantine props or Tailwind className/classNames.',
        },
      ],
    },
  },
])
