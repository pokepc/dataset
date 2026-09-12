import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app'),
    },
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'app/lib/data-migrations.ts',
        'app/lib/games-logic.ts',
        'app/lib/games-logic.server.ts',
        'app/lib/pokemon-logic.ts',
        'app/lib/pokemon-logic.server.ts',
      ],
    },
  },
})
