import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run all tests in a single process
    pool: 'forks',
    // Set a longer timeout for integration tests that hit the DB
    testTimeout: 20000,
    // Ensure that the test environment has access to environment variables
    env: process.env,
    // Optional: configure reporters, coverage, etc.
    reporters: ['verbose'],
    // Vitest will automatically look for test files in specific directories,
    // but you can also specify them explicitly.
    include: ['src/lib/tests/**/*.test.js'],
    setupFiles: ['src/lib/tests/setup.js'],
  },
});
