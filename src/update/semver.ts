/** Enough semver for release tags: `v1.2.3`, `1.2.3-beta.1`; pre-releases sort before releases. */

export interface Semver {
  major: number
  minor: number
  patch: number
  pre: string[]
}

export function parseSemver(text: string): Semver | undefined {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim())
  if (!m) return undefined
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split('.') : [] }
}

export function compareSemver(a: Semver, b: Semver): number {
  for (const key of ['major', 'minor', 'patch'] as const)
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  if (a.pre.length === 0 && b.pre.length === 0) return 0
  if (a.pre.length === 0) return 1
  if (b.pre.length === 0) return -1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = Number(x)
    const ny = Number(y)
    const cmp = Number.isFinite(nx) && Number.isFinite(ny) ? Math.sign(nx - ny) : x < y ? -1 : x > y ? 1 : 0
    if (cmp !== 0) return cmp
  }
  return 0
}

export function isNewer(candidate: string, current: string): boolean {
  const a = parseSemver(candidate)
  const b = parseSemver(current)
  return a !== undefined && b !== undefined && compareSemver(a, b) > 0
}
