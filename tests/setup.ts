import '@testing-library/jest-dom'

// Mock Vite globals defined in vite.config.ts
declare global {
  const __APP_VERSION__: string
  const __GIT_COMMIT__: string
  const __GIT_BRANCH__: string
  const __GIT_COMMIT_MESSAGE__: string
}

const globals = globalThis as unknown as Record<string, unknown>
globals.__APP_VERSION__ = '0.0.0-test'
globals.__GIT_COMMIT__ = 'test-commit'
globals.__GIT_BRANCH__ = 'test-branch'
globals.__GIT_COMMIT_MESSAGE__ = 'test commit message'
