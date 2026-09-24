/**
 * How a command shows its result: human text on stdout, or exactly one JSON document in `--json`
 * mode. In JSON mode the human helpers are silent, so a command writes both without branching.
 */

import type { AtcIo } from '../io.js'
import type { Colors } from './color.js'
import { renderTable } from './table.js'
import type { ColumnSpec } from './table.js'

export type OutputMode = 'human' | 'json'

export interface PrinterOptions {
  mode: OutputMode
  quiet: boolean
  colors: Colors
  width: number
}

export class Printer {
  private jsonWritten = false

  constructor(
    private readonly io: AtcIo,
    readonly options: PrinterOptions
  ) {}

  get mode(): OutputMode {
    return this.options.mode
  }

  /** A line of human output; nothing in JSON mode. */
  line(text = ''): void {
    if (this.options.mode === 'json') return
    this.io.stdout(`${text}\n`)
  }

  kv(pairs: ReadonlyArray<readonly [string, string]>): void {
    if (this.options.mode === 'json') return
    const width = Math.max(...pairs.map(([k]) => k.length), 0)
    for (const [k, v] of pairs) this.io.stdout(`${this.options.colors.dim(k.padEnd(width))}  ${v}\n`)
  }

  table(headers: ColumnSpec[], rows: string[][]): void {
    if (this.options.mode === 'json') return
    this.io.stdout(renderTable(headers, rows, { width: this.options.width }))
  }

  /** The one JSON document of a `--json` run. A second call is a programming error. */
  json(value: unknown): void {
    if (this.options.mode !== 'json') return
    if (this.jsonWritten) throw new Error('a command prints exactly one JSON document')
    this.jsonWritten = true
    this.io.stdout(`${JSON.stringify(value, null, 2)}\n`)
  }

  /** Result output that has both forms: `json(value)` in JSON mode, `human()` otherwise. */
  result(value: unknown, human: () => void): void {
    if (this.options.mode === 'json') this.json(value)
    else human()
  }

  success(message: string): void {
    if (this.options.mode === 'json' || this.options.quiet) return
    this.io.stdout(`${this.options.colors.green('✓')} ${message}\n`)
  }

  /** Warnings go to stderr so they never corrupt a JSON result. */
  warn(message: string): void {
    if (this.options.quiet) return
    this.io.stderr(`${this.options.colors.yellow('warning:')} ${message}\n`)
  }

  /** A note for the person, on stderr, e.g. what to do next. */
  note(message: string): void {
    if (this.options.mode === 'json' || this.options.quiet) return
    this.io.stderr(`${message}\n`)
  }
}
