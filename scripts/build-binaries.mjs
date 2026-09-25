#!/usr/bin/env node
// Compile `atc` into single binaries with Bun (the core's script, adapted). This is the ONLY place
// the runtime choice lives: swapping Bun for Node SEA means editing this file, not src/.
//
//   node scripts/build-binaries.mjs --host   # current platform only
//   node scripts/build-binaries.mjs --all    # all six targets (cross-compile)
//
// Run `npm run embed:ui` first (the npm scripts do): the admin SPA is a generated module.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY = join(ROOT, 'src/bin.ts')
const OUT_DIR = join(ROOT, 'dist/bin')

// Bun target → the triple the release assets and the updater use.
export const TARGETS = {
  'bun-darwin-arm64': 'aarch64-apple-darwin',
  'bun-darwin-x64': 'x86_64-apple-darwin',
  'bun-windows-x64': 'x86_64-pc-windows-msvc',
  'bun-windows-arm64': 'aarch64-pc-windows-msvc',
  'bun-linux-x64': 'x86_64-unknown-linux-gnu',
  'bun-linux-arm64': 'aarch64-unknown-linux-gnu',
}

function hostTarget() {
  const { platform, arch } = process
  if (arch !== 'arm64' && arch !== 'x64') throw new Error(`unsupported host ${platform}/${arch}`)
  if (platform === 'darwin') return `bun-darwin-${arch}`
  if (platform === 'win32') return `bun-windows-${arch}`
  if (platform === 'linux') return `bun-linux-${arch}`
  throw new Error(`unsupported host ${platform}/${arch}`)
}

if (!existsSync(join(ROOT, 'src/admin/static-assets.generated.ts'))) {
  console.error('src/admin/static-assets.generated.ts is missing; run `npm run embed:ui` first')
  process.exit(1)
}

const GIT_SHA = (process.env.ATC_GIT_SHA ?? process.env.GITHUB_SHA ?? gitSha() ?? '').trim().slice(0, 12)
const BUILD_DATE = new Date().toISOString().slice(0, 10)

function gitSha() {
  const res = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  return res.status === 0 ? res.stdout : undefined
}

const all = process.argv.includes('--all')
const targets = all ? Object.keys(TARGETS) : [hostTarget()]
mkdirSync(OUT_DIR, { recursive: true })

for (const target of targets) {
  const triple = TARGETS[target]
  const outfile = join(OUT_DIR, `atc-${triple}${target.includes('windows') ? '.exe' : ''}`)
  const args = [
    'build',
    '--compile',
    `--target=${target}`,
    // `--production` is what makes Bun emit the production JSX runtime (`jsx`, not `jsxDEV`) to
    // match React's production build; `--compile` alone does not. It also minifies identifiers, so
    // `--keep-names` keeps function and class names for stack traces; the source map maps to src/.
    // The terminal UI's Ink pulls `react-devtools-core` only when DEV=true; it is a devDependency so
    // the bundler can resolve it (an --external import is hoisted and fails at start).
    '--production',
    '--keep-names',
    '--sourcemap',
    '--define',
    `__ATC_GIT_SHA__=${JSON.stringify(GIT_SHA)}`,
    '--define',
    `__ATC_BUILD_DATE__=${JSON.stringify(BUILD_DATE)}`,
    ENTRY,
    '--outfile',
    outfile,
  ]
  console.log(`bun ${args.join(' ')}`)
  const res = spawnSync('bun', args, { stdio: 'inherit', cwd: ROOT })
  if (res.status !== 0) {
    console.error(`build failed for ${target}`)
    process.exit(res.status ?? 1)
  }
}
console.log(`built ${targets.length} binar${targets.length === 1 ? 'y' : 'ies'} into dist/bin`)
