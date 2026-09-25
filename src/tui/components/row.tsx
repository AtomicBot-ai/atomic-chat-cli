/** One labelled line of a status card: a state mark, the card's title, what it says. */

import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import type { Role } from '../theme.js'
import { useTone } from '../theme.js'

/** Wide enough for the longest card title, "Pending host steps". */
export const LABEL_WIDTH = 20

export type Mark = 'on' | 'off' | 'attention' | 'none'

const MARKS: Record<Mark, { glyph: string; role: Role }> = {
  on: { glyph: '●', role: 'ok' },
  off: { glyph: '○', role: 'muted' },
  attention: { glyph: '!', role: 'warn' },
  none: { glyph: ' ', role: 'muted' },
}

export function Row({
  mark = 'none',
  label = '',
  children,
}: {
  mark?: Mark
  label?: string
  children: ReactNode
}) {
  const tone = useTone()
  const { glyph, role } = MARKS[mark]
  // The mark and the label keep their width (flex items shrink by default, and a squeezed label
  // of spaces wraps onto a second line); only the text after them gives way, truncated.
  return (
    <Box>
      <Box width={2} flexShrink={0}>
        <Text {...tone(role)}>{glyph}</Text>
      </Box>
      <Box width={LABEL_WIDTH} flexShrink={0}>
        <Text bold>{label}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="truncate-end">{children}</Text>
      </Box>
    </Box>
  )
}
