import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
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
