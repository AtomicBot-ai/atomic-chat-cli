/**
 * Colour roles for the terminal UI. Colour is on or off as for every other `atc` output
 * (`colorEnabled`: `--no-color`, `NO_COLOR`, `FORCE_COLOR`, the terminal); off, the screen keeps
 * its structure through bold, dim and inverse alone.
 */

import type { TextProps } from 'ink'
import { createContext, useContext } from 'react'

export type Role = 'accent' | 'ok' | 'warn' | 'error' | 'muted'

/** The 16-colour names every terminal has; truecolour adds nothing a status screen needs. */
const COLORS: Record<Role, string> = {
  accent: 'cyan',
  ok: 'green',
  warn: 'yellow',
  error: 'red',
  muted: 'gray',
}

export interface Theme {
  color: boolean
}

export const ThemeContext = createContext<Theme>({ color: true })

export type Tone = Pick<TextProps, 'color' | 'dimColor'>

export function toneFor(theme: Theme, role: Role): Tone {
  if (theme.color) return { color: COLORS[role] }
  return role === 'muted' ? { dimColor: true } : {}
}

/** `tone('warn')` → the props that paint text in that role under the current theme. */
export function useTone(): (role: Role) => Tone {
  const theme = useContext(ThemeContext)
  return (role) => toneFor(theme, role)
}
