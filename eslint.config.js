import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import prettierPlugin from 'eslint-plugin-prettier';
import tanstackQuery from '@tanstack/eslint-plugin-query';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        // typed rule(no-unsafe-argument, no-floating-promises 등)에 필요한 타입 정보 제공
        projectService: {
          // tsconfig에 포함되지 않는 루트 설정 파일들은 기본 프로젝트로 린트
          // (vite.config.ts는 tsconfig.node.json에 포함되므로 제외)
          allowDefaultProject: ['vitest.config.ts', 'tailwind.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      prettier: prettierPlugin,
      '@tanstack/query': tanstackQuery,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'prettier/prettier': [
        'error',
        {
          // .prettierrc 설정을 따르기 위함
          usePrettierrc: true,
        },
      ],
      // .eslintrc에서 no-unused-vars를 TS 버전으로 위임
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      // react-hooks v7의 컴파일러 계열 진단은 기존 페이지 초기화 패턴 전반을 error로 잡으므로
      // 전면 리팩터링 전까지 warn으로 유지
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react/react-in-jsx-scope': 'off',
      '@tanstack/query/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },
]);
