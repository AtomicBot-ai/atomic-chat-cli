import { describe, expect, it } from 'vitest'
import { parseModelSpec } from './resolver.js'

describe('parseModelSpec', () => {
  it.each([
    ['Qwen/Qwen3-8B-GGUF', { kind: 'hf', repo: 'Qwen/Qwen3-8B-GGUF' }],
    ['hf:Qwen/Qwen3-8B-GGUF', { kind: 'hf', repo: 'Qwen/Qwen3-8B-GGUF' }],
    ['Qwen/Qwen3-8B-GGUF:q4.gguf', { kind: 'hf', repo: 'Qwen/Qwen3-8B-GGUF', file: 'q4.gguf' }],
    ['qwen3-8b', { kind: 'alias', alias: 'qwen3-8b' }],
    ['./model.gguf', { kind: 'path', path: './model.gguf' }],
    ['/srv/m.gguf', { kind: 'path', path: '/srv/m.gguf' }],
    ['model.gguf', { kind: 'path', path: 'model.gguf' }],
  ])('%s', (input, expected) => {
    expect(parseModelSpec(input)).toEqual(expected)
  })

  it('rejects nonsense', () => {
    expect(() => parseModelSpec('')).toThrow(/required/)
    expect(() => parseModelSpec('a/b/c d')).toThrow(/not a model id/)
  })
})
