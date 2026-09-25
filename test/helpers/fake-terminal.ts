/**
 * A terminal for tests of the terminal UI: stdin that takes key presses the way Ink reads them
 * (`readable` + `read()`), stdout that records every write and has a fixed size that a test can
 * change. Ink's own fallback would ask the real terminal for its size, which differs per machine.
 */
import { EventEmitter } from 'node:events'
import type { TerminalStreams } from '../../src/io.js'

export class FakeStdout extends EventEmitter {
  readonly isTTY = true
  readonly writes: string[] = []

  constructor(
    public columns = 100,
    public rows = 30
  ) {
    super()
  }

  write = (chunk: string | Uint8Array, encoding?: unknown, callback?: unknown): boolean => {
    this.writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    const done = typeof encoding === 'function' ? encoding : callback
    if (typeof done === 'function') (done as () => void)()
    return true
  }

  resize(columns: number, rows: number): void {
    this.columns = columns
    this.rows = rows
    this.emit('resize')
  }

  /** Everything written, escape sequences removed. */
  text(): string {
    return stripTerminal(this.writes.join(''))
  }

  /** The last write, escape sequences removed: the current frame in Ink's debug mode. */
  lastFrame(): string {
    return stripTerminal(this.writes.at(-1) ?? '')
  }
}

export class FakeStdin extends EventEmitter {
  readonly isTTY = true
  private readonly queue: string[] = []
  setEncoding(): this {
    return this
  }
  setRawMode(): this {
    return this
  }
  resume(): this {
    return this
  }
  pause(): this {
    return this
  }
  ref(): this {
    return this
  }
  unref(): this {
    return this
  }
  read = (): string | null => this.queue.shift() ?? null

  /** One key press (or a pasted string), e.g. `press('q')`, `press(KEYS.down)`. */
  press(data: string): void {
    this.queue.push(data)
    this.emit('readable')
  }
}

export const KEYS = {
  up: '\u001b[A',
  down: '\u001b[B',
  right: '\u001b[C',
  left: '\u001b[D',
  enter: '\r',
  escape: '\u001b',
  tab: '\t',
  backspace: '\u007f',
} as const

export interface FakeTerminal {
  stdin: FakeStdin
  stdout: FakeStdout
  stderr: FakeStdout
  /** The same streams, typed as what `AtcIo.terminal` holds. */
  streams: TerminalStreams
}

export function fakeTerminal(columns = 100, rows = 30): FakeTerminal {
  const stdin = new FakeStdin()
  const stdout = new FakeStdout(columns, rows)
  const stderr = new FakeStdout(columns, rows)
  return {
    stdin,
    stdout,
    stderr,
    streams: { stdin, stdout, stderr } as unknown as TerminalStreams,
  }
}

/** Remove CSI (colours, cursor moves, modes) and OSC sequences. */
export function stripTerminal(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\u001b\][^\u0007]*\u0007/g, '')
}

/** Poll until `predicate` holds (Ink renders on its own schedule); fails the test after ~2 s. */
export async function eventually(predicate: () => boolean, what = 'condition'): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`timed out waiting for ${what}`)
}
