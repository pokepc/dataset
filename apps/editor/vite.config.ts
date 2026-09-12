import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  server: {
    watch: {
      ignored: ['**/data/**', '**/data-next/**'],
    },
  },
  ssr: {
    external: ['@pokepc/dataset'],
  },
  resolve: {
    tsconfigPaths: true,
  },
})
