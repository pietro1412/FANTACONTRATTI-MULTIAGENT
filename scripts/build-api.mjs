import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['api/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'api/index.mjs',
  external: [
    '@prisma/client',
    'bcryptjs',
    'jsonwebtoken',
  ],
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
    `.trim(),
  },
})

console.log('API bundled successfully!')
