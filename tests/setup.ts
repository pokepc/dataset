import './block-external-network.ts'

// CLI tests spawn Node from temporary directories, so use an absolute file URL.
const preload = `--import=${new URL('./block-external-network.ts', import.meta.url).href}`
if (!process.env.NODE_OPTIONS?.includes(preload)) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, preload].filter(Boolean).join(' ')
}
