import { createApp } from './app'

// Production serverless entrypoint (bundled by scripts/build-api.mjs → api/index.mjs).
// All middleware, security hardening and routes live in createApp() (src/api/app.ts),
// shared with the local dev entry (index.ts). Do NOT add routes here: anything
// added only in this file (or only in index.ts) reintroduces dev/prod divergence.
const app = createApp()

export default app
