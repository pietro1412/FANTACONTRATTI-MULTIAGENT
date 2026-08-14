import '@testing-library/jest-dom'

// Set Vite globals (declared in src/vite-env.d.ts) for test environment
const globals = globalThis as unknown as Record<string, unknown>
globals.__APP_VERSION__ = '0.0.0-test'
globals.__GIT_COMMIT__ = 'test-commit'
globals.__GIT_BRANCH__ = 'test-branch'
globals.__GIT_COMMIT_MESSAGE__ = 'test commit message'

// jsdom doesn't implement window.scrollTo: replace with a no-op to avoid not-implemented noise
window.scrollTo = (() => {}) as typeof window.scrollTo
