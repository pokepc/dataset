import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { formatJsonCompact } from '../lib/json-format'

interface CliOptions {
  targetDir: string
  write: boolean
  check: boolean
  verbose: boolean
  includeHidden: boolean
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const targetDir = path.resolve(options.targetDir)

  const stat = await safeStat(targetDir)
  if (!stat) {
    console.error(`Path does not exist: ${targetDir}`)
    process.exit(1)
  }

  if (!stat.isDirectory()) {
    console.error(`Path is not a directory: ${targetDir}`)
    process.exit(1)
  }

  const jsonFiles = await collectJsonFiles(targetDir, options.includeHidden)

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in: ${targetDir}`)
    return
  }

  let changedCount = 0
  let unchangedCount = 0
  let errorCount = 0

  for (const filePath of jsonFiles) {
    try {
      const original = await fs.readFile(filePath, 'utf8')
      const parsed = JSON.parse(original)

      const formatted =
        formatJsonCompact(parsed, {
          indent: 2,
          maxInlineLength: 120,
          maxInlineItems: 8,
          inlineArrayObjects: true,
          inlinePrimitiveArrays: true,
          trailingComma: false,
        }) + '\n'

      const normalizedOriginal = normalizeFinalNewline(original)
      const hasChanged = normalizedOriginal !== formatted

      if (!hasChanged) {
        unchangedCount += 1
        if (options.verbose) {
          console.log(`unchanged ${filePath}`)
        }
        continue
      }

      changedCount += 1

      if (options.check) {
        console.log(filePath)
        continue
      }

      if (options.write) {
        await fs.writeFile(filePath, formatted, 'utf8')
        if (options.verbose) {
          console.log(`formatted ${filePath}`)
        }
        continue
      }

      console.log(`--- ${filePath} ---`)
      process.stdout.write(formatted)
    } catch (error) {
      errorCount += 1
      const message = error instanceof Error ? error.message : String(error)
      console.error(`error in ${filePath}: ${message}`)
    }
  }

  if (options.check) {
    if (changedCount > 0) {
      console.error(
        `${changedCount} file(s) need formatting, ${unchangedCount} already formatted, ${errorCount} error(s).`,
      )
      process.exit(1)
    }

    console.log(`All files are formatted. ${unchangedCount} checked, ${errorCount} error(s).`)
    return
  }

  console.log(`Done. ${changedCount} changed, ${unchangedCount} unchanged, ${errorCount} error(s).`)

  if (errorCount > 0) {
    process.exit(1)
  }
}

function parseArgs(argv: string[]): CliOptions {
  let targetDir = '.'
  let write = false
  let check = false
  let verbose = false
  let includeHidden = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    switch (arg) {
      case '--write':
        write = true
        break
      case '--check':
        check = true
        break
      case '--verbose':
      case '-v':
        verbose = true
        break
      case '--include-hidden':
        includeHidden = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`)
          printHelp()
          process.exit(1)
        }

        targetDir = arg
        break
    }
  }

  if (write && check) {
    console.error(`Use either --write or --check, not both.`)
    process.exit(1)
  }

  return {
    targetDir,
    write,
    check,
    verbose,
    includeHidden,
  }
}

function printHelp(): void {
  console.log(
    `
Usage:
  bun run format-json-dir.ts [dir] [--write] [--check] [--verbose] [--include-hidden]

Examples:
  bun run format-json-dir.ts ./data --write
  bun run format-json-dir.ts . --check
  bun run format-json-dir.ts ./src --write --verbose
`.trim(),
  )
}

async function collectJsonFiles(dirPath: string, includeHidden: boolean): Promise<string[]> {
  const results: string[] = []
  await walk(dirPath, results, includeHidden)
  return results
}

async function walk(currentPath: string, results: string[], includeHidden: boolean): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue
    }

    const fullPath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      await walk(fullPath, results, includeHidden)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (entry.name.toLowerCase().endsWith('.json')) {
      results.push(fullPath)
    }
  }
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath)
  } catch {
    return null
  }
}

function normalizeFinalNewline(input: string): string {
  return input.endsWith('\n') ? input : `${input}\n`
}

await main()
