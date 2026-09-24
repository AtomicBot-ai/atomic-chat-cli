/**
 * What the person typed → where the model is. `owner/repo`, `owner/repo:file.gguf`, a catalog
 * alias, or a path to a GGUF on disk. Resolution against Hugging Face and the catalog is iteration 3.
 */

import { AtcError } from '../errors/index.js'

export type ModelSpec =
  | { kind: 'hf'; repo: string; file?: string }
  | { kind: 'alias'; alias: string }
  | { kind: 'path'; path: string }

const HF_REPO = /^[\w.-]+\/[\w.-]+$/

export function parseModelSpec(input: string): ModelSpec {
  const text = input.trim()
  if (text === '') throw new AtcError('ATC_USAGE', 'A model is required.')
  if (/^(hf:|huggingface:)/i.test(text)) return parseModelSpec(text.replace(/^(hf:|huggingface:)/i, ''))
  if (
    /\.gguf$/i.test(text) &&
    (text.includes('/') === false ||
      text.startsWith('.') ||
      text.startsWith('/') ||
      /^[A-Za-z]:\\/.test(text))
  )
    return { kind: 'path', path: text }
  const colon = text.indexOf(':')
  if (colon > 0) {
    const repo = text.slice(0, colon)
    const file = text.slice(colon + 1)
    if (HF_REPO.test(repo) && file) return { kind: 'hf', repo, file }
  }
  if (HF_REPO.test(text)) return { kind: 'hf', repo: text }
  if (/^[\w.-]+$/.test(text)) return { kind: 'alias', alias: text }
  throw new AtcError('ATC_USAGE', `'${input}' is not a model id.`, {
    hint: 'use owner/repo, owner/repo:file.gguf, a catalog alias, or a path to a .gguf',
  })
}

export interface ResolvedModel {
  modelId: string
  repo: string
  file: string
  sizeBytes: number | undefined
  sha256: string | undefined
  mmproj?: { file: string; sizeBytes: number | undefined }
}

export interface ModelResolver {
  resolve(spec: ModelSpec, options?: { quant?: string }): Promise<ResolvedModel>
}
