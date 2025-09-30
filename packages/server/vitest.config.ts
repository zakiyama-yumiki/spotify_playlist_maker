import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',        // パーサ系なら node で十分
    globals: true,              // describe/it/expect をグローバルで利用
    include: ['src/**/*.test.ts'],
    reporters: ['default'],     // 必要に応じて 'junit' などを追加
    coverage: {
      reporter: ['text', 'lcov'],
      enabled: process.env.COVERAGE === 'true',
    },
  },
});
