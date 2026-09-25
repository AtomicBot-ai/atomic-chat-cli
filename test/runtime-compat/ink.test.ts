/**
 * The terminal UI's foundation under both runtimes: Ink (React, the yoga layout engine in
 * WebAssembly, top-level await) renders to a TTY-like stream, reads raw key presses through
 * `readable` + `read()`, and re-lays out on `resize`. Runs under vitest and under `bun test`;
 * the compiled binary itself is driven in a pseudo-terminal by the e2e suite. No JSX, so both
 * runners load it without a transform.
 */
import { EventEmitter } from 'node:events'
import { Box, render, Text, useApp, useInput, useWindowSize } from 'ink'
import { createElement, useState } from 'react'
import { describe, expect, it } from 'vitest'

class Out extends EventEmitter {
  isTTY = true
  columns = 60
  rows = 10
  writes: string[] = []
  write = (chunk: string) => {
    this.writes.push(chunk)
    return true
  }
}

class In extends EventEmitter {
  isTTY = true
  rawMode: boolean[] = []
  private queue: string[] = []
  setEncoding() {}
  setRawMode(on: boolean) {
    this.rawMode.push(on)
  }
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => this.queue.shift() ?? null
  press(data: string) {
    this.queue.push(data)
    this.emit('readable')
  }
}

function Probe() {
  const { exit } = useApp()
  const { columns, rows } = useWindowSize()
  const [last, setLast] = useState('none')
  useInput((input, key) => {
    if (input === 'q') exit()
    else setLast(key.downArrow ? 'down' : input)
  })
  return createElement(
    Box,
    { borderStyle: 'round', width: columns },
    createElement(Text, null, `size ${columns}x${rows} key ${last}`)
  )
}

const strip = (s: string) =>
  // eslint-disable-next-line no-control-regex
  s.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')

async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !predicate(); i += 1) await new Promise((r) => setTimeout(r, 5))
  expect(predicate()).toBe(true)
}

describe('ink', () => {
  it('renders, reads raw keys, follows a resize, and restores the terminal on exit', async () => {
    const stdout = new Out()
    const stdin = new In()
    const app = render(createElement(Probe), {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stderr: new Out() as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      exitOnCtrlC: true,
      alternateScreen: true,
      interactive: true,
      patchConsole: false,
    })
    const screen = () => strip(stdout.writes.join(''))
    await until(() => screen().includes('size 60x10 key none'))
    expect(stdin.rawMode).toContain(true)
    stdin.press('\u001b[B')
    await until(() => screen().includes('key down'))
    stdout.columns = 80
    stdout.emit('resize')
    await until(() => screen().includes('size 80x10'))
    stdin.press('q')
    await app.waitUntilExit()
    expect(stdin.rawMode.at(-1)).toBe(false)
    expect(stdout.writes.join('')).toContain('\u001b[?1049l')
  })
})
