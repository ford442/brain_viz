// [Neuro-Weaver] ESLint: correctness signal only, not a formatter.
// `npm run lint`. See CONTRIBUTING.md → "Tests and checks".
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

const GRID_MSG = 'Grid size is runtime: use DEFAULT_VOXEL_DIM / voxelCountFor() / the renderer voxelDim (src/voxel-dim.js).';
const DIM_NAME = '/^(voxelDim|VOXEL_DIM|dim|gridDim|gridSize|GRID_SIZE)$/';
const BARE_GRID_SIZE = [
    "BinaryExpression[operator='**'][left.value=32][right.value=3]",
    "BinaryExpression[operator='*'][left.operator='*'][left.left.value=32][left.right.value=32][right.value=32]",
    "Literal[raw='32768']",
    `Property[key.name=${DIM_NAME}][value.value=32]`,
    `VariableDeclarator[id.name=${DIM_NAME}][init.value=32]`,
    `AssignmentPattern[left.name=${DIM_NAME}][right.value=32]`,
    `AssignmentExpression[left.property.name=${DIM_NAME}][right.value=32]`,
].map((selector) => ({ selector, message: GRID_MSG }));

// No typescript-eslint: its type-aware rules (no-misused-promises,
// no-floating-promises) need TypeScript's JS compiler API, which the
// Go-native typescript@7 does not ship (and typescript-eslint pins
// typescript <6.1). `if (device.lost)`-style Promise misuse is caught by tsc
// itself instead (TS2801, strict mode is on — see jsconfig.json).
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
            // [Field Resolution] Grid size is runtime (src/voxel-dim.js); backs up
            // the grep in tests/test_voxel_dim.js. CLAUDE.md §3c.
            'no-restricted-syntax': ['error', ...BARE_GRID_SIZE],
        },
    },
    {
        // The one place the default grid size is allowed to be spelled out.
        files: ['src/voxel-dim.js'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        // Routine handlers run on the routine clock: it pauses with the routine
        // and scales with playbackSpeed. Use player.after(sec, fn[, {cleanup}]).
        files: ['src/routine-handlers/**/*.js', 'src/routine-handlers.js'],
        rules: {
            'no-restricted-globals': ['error',
                { name: 'setTimeout', message: 'Use player.after(seconds, fn) — the routine clock — not wall-clock timers.' },
                { name: 'setInterval', message: 'Use player.after(seconds, fn) — the routine clock — not wall-clock timers.' },
            ],
        },
    },
];
