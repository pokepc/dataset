import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'lib/*': ['src/lib/*.ts', '!src/lib/*.test.ts', '!src/lib/*.d.ts'],
    'lib-next/*': ['src/lib-next/*.ts', '!src/lib-next/*.test.ts', '!src/lib-next/*.d.ts'],
  },
  outDir: 'build',
  clean: true,
  format: ['esm'],
  target: 'es2024',
  sourcemap: true,
  deps: {
    neverBundle: ['yolodb', 'zod'],
  },
  dts: {
    resolver: 'tsc',
    sourcemap: true,
  },
})
