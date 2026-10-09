import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The `@/` alias is mandatory, not a convenience: the ported MCP modules
    // and their tests import each other through it.
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        // `NODE_ENV` is load-bearing: `validateEnv`'s two production
        // refinements would otherwise fire against a bare test environment.
        // `LOG_LEVEL` silences the module-level logger the global error
        // handler uses — several tests assert on deliberate 4xx paths, and
        // their stack traces are expected output, not failures.
        env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
        restoreMocks: true,
    },
});
