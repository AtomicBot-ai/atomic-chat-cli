/**
 * Levelled logging to stderr (human or JSON lines) or to a rotating file in the daemon. Commands
 * never `console.log`; data goes through the printer, diagnostics through here.
 */

import { appendFileSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AtcIo } from '../io.js'
import type { Colors } from './color.js'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

export interface LogEntry {
  time: number
  level: Exclude<LogLevel, 'silent'>
  scope: string | undefined
  message: string
  fields: Record<string, unknown> | undefined
}

export type LogSink = (entry: LogEntry) => void

export interface Logger {
  readonly level: LogLevel
  debug(message: string, fields?: Record<string, unknown>): void
  info(message: string, fields?: Record<string, unknown>): void
  warn(message: string, fields?: Record<string, unknown>): void
  error(message: string, fields?: Record<string, unknown>): void
  child(scope: string): Logger
}

export function createLogger(
  sink: LogSink,
  options: { level: LogLevel; scope?: string; now?: () => number }
): Logger {
  const now = options.now ?? Date.now
  const emit = (level: LogEntry['level'], message: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[options.level]) return
    sink({ time: now(), level, scope: options.scope, message, fields })
  }
  return {
    level: options.level,
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (scope) =>
      createLogger(sink, { ...options, scope: options.scope ? `${options.scope}:${scope}` : scope }),
  }
}

export function levelFromFlags(flags: { verbose: boolean; quiet: boolean }): LogLevel {
  if (flags.quiet) return 'error'
  if (flags.verbose) return 'debug'
  return 'info'
}

export function formatEntry(entry: LogEntry, colors?: Colors): string {
  const tag = entry.scope ? `[${entry.level}] ${entry.scope}:` : `[${entry.level}]`
  const painted =
    colors === undefined
      ? tag
      : entry.level === 'error'
        ? colors.red(tag)
        : entry.level === 'warn'
          ? colors.yellow(tag)
          : entry.level === 'debug'
            ? colors.dim(tag)
            : tag
  const fields = entry.fields ? ` ${JSON.stringify(entry.fields)}` : ''
  return `${painted} ${entry.message}${fields}`
}

export function stderrSink(io: AtcIo, options: { json: boolean; colors: Colors }): LogSink {
  return (entry) => {
    io.stderr(
      options.json
        ? `${JSON.stringify({ time: new Date(entry.time).toISOString(), level: entry.level, scope: entry.scope, message: entry.message, ...entry.fields })}\n`
        : `${formatEntry(entry, options.colors)}\n`
    )
  }
}

/** Append JSON lines to a file, rotating by size (`file`, `file.1`, … up to `maxFiles`). */
export function fileSink(path: string, options: { maxSizeBytes: number; maxFiles: number }): LogSink {
  mkdirSync(dirname(path), { recursive: true })
  const rotate = () => {
    for (let i = options.maxFiles - 1; i >= 1; i -= 1) {
      const from = i === 1 ? path : `${path}.${i - 1}`
      const to = `${path}.${i}`
      try {
        if (i === options.maxFiles - 1) unlinkSync(to)
      } catch {
        /* nothing to drop */
      }
      try {
        renameSync(from, to)
      } catch {
        /* nothing to rotate */
      }
    }
  }
  return (entry) => {
    const line = `${JSON.stringify({ time: new Date(entry.time).toISOString(), level: entry.level, scope: entry.scope, message: entry.message, ...entry.fields })}\n`
    try {
      if (statSync(path).size + line.length > options.maxSizeBytes) rotate()
    } catch {
      /* first write */
    }
    appendFileSync(path, line)
  }
}

export function tee(...sinks: LogSink[]): LogSink {
  return (entry) => {
    for (const sink of sinks) sink(entry)
  }
}
