const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  eslintConfigPrettier,
  {
    rules: {
      // Reanimated muta `sharedValue.value` por diseño (API documentada, hilo de UI).
      // La regla immutability de react-hooks v6 (semántica React Compiler) lo marca como
      // error: falso positivo en cualquier app con Reanimated. Se desactiva globalmente.
      'react-hooks/immutability': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'android/**',
      'ios/**',
      'supabase/functions/**', // Deno runtime, imports jsr:/npm: que el ESLint de Node no resuelve
      '.agents/**',
      '.claude/**',
      'scripts/**',
      'nativewind-env.d.ts',
    ],
  },
];
