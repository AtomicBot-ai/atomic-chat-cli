import { describe, expect, it } from 'vitest'
import { renderTable } from './table.js'

describe('renderTable', () => {
  it('pads columns, underlines headers and right-aligns when asked', () => {
    const text = renderTable(
      [{ header: 'ID' }, { header: 'SIZE', align: 'right' }],
      [
        ['a', '1 B'],
        ['longer', '12 B'],
      ]
    )
    expect(text).toBe('ID      SIZE\n------  ----\na        1 B\nlonger  12 B\n')
  })

  it('truncates the last column to the width', () => {
    const text = renderTable([{ header: 'A' }, { header: 'B' }], [['x', 'y'.repeat(50)]], { width: 20 })
    const [, , row] = text.split('\n')
    expect(row!.length).toBeLessThanOrEqual(20)
    expect(row).toContain('…')
  })
})
