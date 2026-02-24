import { defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: './',
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['**/*.test.ts'],
          root: './',
          environment: 'node',
        },
      },
    ],
  },
})
