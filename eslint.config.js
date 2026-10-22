// [Neuro-Weaver] ESLint: correctness signal only, not a formatter.
// `npm run lint`. See CONTRIBUTING.md → "Tests and checks".
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
    { ignores: ['dist/**', 'node_modules/**', 'public/**', 'wasm/**'] },
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser },
        },
        plugins: { jsdoc },
        rules: {
            ...js.configs.recommended.rules,
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
            // JSDoc is the type system here (jsconfig.json), so a malformed or
            // misnamed tag is a type error tsc may silently ignore. These rules
            // check what is written; none of them demand JSDoc be written.
            'jsdoc/check-param-names': 'error',
            'jsdoc/check-tag-names': ['error', { definedTags: ['satisfies'] }],
            'jsdoc/check-types': 'off',
            'jsdoc/no-undefined-types': 'off', // tsc owns type resolution
            'jsdoc/valid-types': 'error',
        },
    },
];
