import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // the type-checking tests start a TypeScript program each
    testTimeout: 60_000,
  },
})
