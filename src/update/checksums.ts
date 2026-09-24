/** `SHA256SUMS` as `sha256sum` writes it: `<hex>  <name>` per line. */

export function parseSha256Sums(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim())
    if (m) out[m[2]!.trim()] = m[1]!.toLowerCase()
  }
  return out
}
