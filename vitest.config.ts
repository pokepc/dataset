import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  envDir: './',
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['**/*.test.ts'],
          // Agent worktrees under .claude/worktrees/ are full checkouts, so without this
          // the whole suite is collected twice and every count doubles.
          exclude: [...configDefaults.exclude, '.claude/**'],
          root: './',
          environment: 'node',
        },
      },
    ],
  },
})
