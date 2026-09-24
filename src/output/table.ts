/** Plain-text tables: padded columns, header underline, last column truncated to the width. */

export interface ColumnSpec {
  header: string
  align?: 'left' | 'right'
}

export function renderTable(
  headers: ColumnSpec[],
  rows: string[][],
  options: { width?: number } = {}
): string {
  const width = options.width ?? 80
  const count = headers.length
  const widths = headers.map((h, i) => Math.max(h.header.length, ...rows.map((r) => (r[i] ?? '').length)))
  const gap = 2
  const fixed = widths.slice(0, -1).reduce((a, b) => a + b + gap, 0)
  const lastMax = Math.max(8, width - fixed)
  if (count > 0 && (widths[count - 1] as number) > lastMax) widths[count - 1] = lastMax
  const cell = (text: string, i: number) => {
    const w = widths[i] as number
    const clipped = text.length > w ? `${text.slice(0, Math.max(0, w - 1))}…` : text
    return headers[i]?.align === 'right' ? clipped.padStart(w) : clipped.padEnd(w)
  }
  const line = (cells: string[]) => cells.map(cell).join(' '.repeat(gap)).trimEnd()
  const out = [line(headers.map((h) => h.header)), line(widths.map((w) => '-'.repeat(w)))]
  for (const row of rows) out.push(line(headers.map((_, i) => row[i] ?? '')))
  return `${out.join('\n')}\n`
}
