module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    '@react-native',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'airbnb',
    'airbnb-typescript',
    'airbnb/hooks',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint', 'prettier', 'jest'],
  ignorePatterns: [
    '__tests__/**',
    'jest.config.js',
    'babel.config.js',
    'metro.config.js',
    'prettierrc.js',
    '.eslintrc.js',
    'react-native.config.js',
    'index.js',
  ],
  rules: {
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
    'max-len': ['warn', { code: 120 }],
    '@typescript-eslint/no-use-before-define': ['error', { functions: true, classes: true, variables: false }],
    'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
    'react/require-default-props': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
    'react/prop-types': 'off',
    'react/jsx-props-no-spreading': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    'import/prefer-default-export': 'off',
    'no-shadow': 'off',
    'import/order': [
      'error',
      {
        pathGroups: [
          { pattern: 'react*', group: 'builtin', position: 'before' },
          { pattern: '@src/**', group: 'external', position: 'after' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        alphabetize: { order: 'asc' },
      },
    ],
    '@typescript-eslint/lines-between-class-members': 0,
    '@typescript-eslint/no-throw-literal': 0,
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    '@typescript-eslint/no-shadow': 'off',
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
    'no-async-promise-executor': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      'babel-module': {},
    },
  },
};
