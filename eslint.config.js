import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
    { ignores: ['dist'] },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
                sourceType: 'module',
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'react': react,
            'jsx-a11y': jsxA11y,
            '@typescript-eslint': tsPlugin,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            ...react.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            ...tsPlugin.configs.recommended.rules,
            'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            'indent': ['error', 4],
            'react/jsx-indent': ['error', 4],
            'react/jsx-indent-props': ['error', 4],
            'no-mixed-spaces-and-tabs': 'error',
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'comma-dangle': ['error', 'always-multiline'],
            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'jsx-quotes': ['error', 'prefer-double'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'computed-property-spacing': ['error', 'never'],
            'space-before-function-paren': ['error', {
                'anonymous': 'always',
                'named': 'never',
                'asyncArrow': 'always',
            }],
            'space-before-blocks': ['error', 'always'],
            'keyword-spacing': ['error', { 'before': true, 'after': true }],
            'arrow-spacing': ['error', { 'before': true, 'after': true }],
            'space-infix-ops': 'error',
            'space-unary-ops': ['error', { 'words': true, 'nonwords': false }],
            'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
            'camelcase': ['error', { 'properties': 'never' }],
            'max-len': ['error', { 'code': 120 }],
        },
    },
];
