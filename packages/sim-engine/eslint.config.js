import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      'no-undef': 'off',
      // Sprint Pro League — task 0.A.4: bannir `Math.random` du package
      // sim-engine. Tout consommateur DOIT recevoir un `Rng` seedé en
      // parametre (cf. `src/rng/seeded.ts`). Garde-fou anti-replay-bug.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            "Use the seeded Rng from '@bb/sim-engine/rng/seeded' instead of Math.random — sim engine outputs MUST be replay-deterministic.",
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'crypto',
          message:
            "Use the seeded Rng from '@bb/sim-engine/rng/seeded' instead of crypto for sim-engine outputs (replay determinism).",
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
);
