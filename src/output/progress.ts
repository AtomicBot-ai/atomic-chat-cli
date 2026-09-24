/**
 * Progress for downloads and long steps: a `\r` bar on a terminal, a line every 5 % (or 10 s)
 * otherwise, nothing when quiet, and JSON lines on stderr in `--json --verbose`.
 */

import type { AtcIo } from '../io.js'
import type { Colors } from './color.js'
import { formatBytes, formatDuration, formatPercent, formatRate } from './format.js'

export interface ProgressHandle {
  update(done: number, total?: number, extra?: string): void
  finish(message?: string): void
  fail(message?: string): void
}

export interface ProgressOptions {
  isTTY: boolean
  quiet: boolean
  json: boolean
  verbose: boolean
  colors: Colors
  width: number
  now?: () => number
}

const STEP_PERCENT = 5
const STEP_MS = 10_000

export function createProgress(
  io: AtcIo,
  options: ProgressOptions
): { start(label: string, total?: number): ProgressHandle } {
  const now = options.now ?? Date.now
  return {
    start(label, initialTotal) {
      const startedAt = now()
      let total = initialTotal
      let lastPercent = -1
      let lastAt = 0
      let ended = false
      const silent = options.quiet || (options.json && !options.verbose)
      const render = (done: number, extra?: string) => {
        const percent = total ? formatPercent(done, total) : formatBytes(done)
        const rate = formatRate(done, now() - startedAt)
        const tail = extra ? ` ${extra}` : ''
        if (options.json) {
          io.stderr(`${JSON.stringify({ progress: label, done, total: total ?? null, percent, rate })}\n`)
          return
        }
        if (options.isTTY) {
          const barWidth = Math.max(10, Math.min(30, options.width - label.length - 30))
          const filled = total ? Math.round((Math.min(done, total) / total) * barWidth) : 0
          const bar = total ? `[${'#'.repeat(filled)}${'-'.repeat(barWidth - filled)}]` : ''
          io.stderr(
            `\r${label} ${bar} ${percent} ${rate}${tail}`.padEnd(options.width).slice(0, options.width)
          )
        } else io.stderr(`${label} ${percent} ${rate}${tail}\n`)
      }
      const end = (ok: boolean, message?: string) => {
        if (ended) return
        ended = true
        if (silent) return
        if (options.json) {
          io.stderr(
            `${JSON.stringify({ progress: label, done: ok ? 'finished' : 'failed', message: message ?? null })}\n`
          )
          return
        }
        const took = formatDuration(now() - startedAt)
        const text = message ?? (ok ? 'done' : 'failed')
        const mark = ok ? options.colors.green('✓') : options.colors.red('✗')
        io.stderr(
          `${options.isTTY ? '\r' : ''}${mark} ${label}: ${text} (${took})${options.isTTY ? ''.padEnd(options.width - label.length - text.length - took.length - 8) : ''}\n`
        )
      }
      return {
        update(done, newTotal, extra) {
          if (ended || silent) return
          if (newTotal !== undefined) total = newTotal
          const percent = total ? Math.floor((done / total) * 100) : -1
          const t = now()
          const due =
            options.isTTY || percent < 0 || percent >= lastPercent + STEP_PERCENT || t - lastAt >= STEP_MS
          if (!due) return
          lastPercent = percent
          lastAt = t
          render(done, extra)
        },
        finish: (message) => end(true, message),
        fail: (message) => end(false, message),
      }
    },
  }
}
