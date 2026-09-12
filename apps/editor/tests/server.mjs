import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const runtime = process.argv[2]
if (!['development', 'production'].includes(runtime)) throw new Error('Invalid editor test runtime')
const root = resolve(import.meta.dirname, '../../..')
const fixture = resolve(root, '.local/editor-e2e', runtime)
rmSync(fixture, { recursive: true, force: true })
mkdirSync(fixture, { recursive: true })
cpSync(resolve(root, 'data'), resolve(fixture, 'data'), { recursive: true })

const development = runtime === 'development'
const port = development ? '3103' : '3104'
const child = spawn(
  'pnpm',
  development
    ? ['exec', 'react-router', 'dev', '--port', port, '--host', '127.0.0.1', '--strictPort']
    : ['start'],
  {
    cwd: resolve(root, 'apps/editor'),
    stdio: 'inherit',
    env: {
      ...process.env,
      POKEPC_DATASET_DIR: resolve(fixture, 'data'),
      POKEPC_DISABLE_MEMORY_CACHE: '1',
      HOST: '127.0.0.1',
      PORT: port,
    },
  },
)
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 1))
