import '@testing-library/jest-dom'

// Set Vite globals (declared in src/vite-env.d.ts) for test environment
const globals = globalThis as unknown as Record<string, unknown>
globals.__APP_VERSION__ = '0.0.0-test'
globals.__GIT_COMMIT__ = 'test-commit'
globals.__GIT_BRANCH__ = 'test-branch'
globals.__GIT_COMMIT_MESSAGE__ = 'test commit message'
