/**
 * Reading the daemon log (`<data>/atc/logs/daemon.log`, the daemon's stdout and stderr appended by
 * the spawner): its last lines, then whatever is appended. `atc logs` and the terminal UI's Logs
 * screen read it this way; the file may be large, so only its end is read, and it may be truncated
 * or replaced, in which case following starts again from the top.
 */

import { open, stat } from 'node:fs/promises'
import { sleep } from '../core-link/index.js'

/** How much of the end of the file `readLogTail` looks at; plenty for a screen of lines. */
export const LOG_TAIL_BYTES = 512 * 1024

export function tailLines(text: string, count: number): string[] {
  const lines = text.split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  return lines.slice(-count)
}

async function readRange(path: string, start: number, end: number): Promise<string> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(end - start)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

async function sizeOf(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).size
  } catch {
    return undefined
  }
}

/** The last `count` lines and the offset to follow from; no file yet is no lines at offset 0. */
export async function readLogTail(
  path: string,
  count: number,
  maxBytes = LOG_TAIL_BYTES
): Promise<{ lines: string[]; offset: number }> {
  const size = await sizeOf(path)
  if (size === undefined) return { lines: [], offset: 0 }
  const start = Math.max(0, size - maxBytes)
  let text = await readRange(path, start, size)
  // Reading from the middle of the file: the first line is a fragment.
  if (start > 0) text = text.slice(text.indexOf('\n') + 1)
  return { lines: tailLines(text, count), offset: size }
}

export interface FollowLogOptions {
  signal: AbortSignal
  onLines: (lines: string[]) => void
  /** Called when the file shrank (truncated or replaced) and following restarted at its top. */
  onReset?: () => void
  intervalMs?: number
}

/** Poll the file from `offset` and hand over complete new lines until `signal` aborts. */
export async function followLog(path: string, offset: number, options: FollowLogOptions): Promise<void> {
  const { signal } = options
  let position = offset
  let partial = ''
  while (!signal.aborted) {
    const size = await sizeOf(path)
    if (size !== undefined && size < position) {
      position = 0
      partial = ''
      options.onReset?.()
    }
    if (size !== undefined && size > position) {
      const text = partial + (await readRange(path, position, size))
      position = size
      const lines = text.split(/\r?\n/)
      partial = lines.pop() ?? ''
      if (lines.length > 0 && !signal.aborted) options.onLines(lines)
    }
    await sleep(options.intervalMs ?? 500, signal)
  }
}
