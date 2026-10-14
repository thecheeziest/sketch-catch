// ESLint 9 flat config. 구형 .eslintrc.js(airbnb/react/import 플러그인 기반)는 해당 플러그인이 설치되어 있지 않아
// 실행되지 않았다. 설치된 typescript-eslint 기준으로 옮기고, 프로젝트 고유 규칙만 유지한다.
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/prisma/migrations/**',
      'scratchpad/**',
      'design*/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['TouchableOpacity'],
              message: '커스텀 TouchableOpacity 컴포넌트를 사용해주세요!',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
