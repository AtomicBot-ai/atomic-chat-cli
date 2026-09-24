import { AtomicCoreError } from '@atomic-chat/core'
import { describe, expect, it } from 'vitest'
import { AtcError, describeError, errorBody, exitCodeFor } from './errors.js'

describe('errors', () => {
  it('maps usage and stubs to their exit codes, everything else to 1', () => {
    expect(exitCodeFor(new AtcError('ATC_USAGE', 'x'))).toBe(2)
    expect(exitCodeFor(new AtcError('ATC_NOT_IMPLEMENTED', 'x'))).toBe(3)
    expect(exitCodeFor(new AtcError('ATC_CONFIG_INVALID', 'x'))).toBe(1)
    expect(exitCodeFor(new AtomicCoreError('CORE_NOT_RUNNING', 'x'))).toBe(1)
    expect(exitCodeFor(new Error('x'))).toBe(1)
  })

  it('keeps the core error codes and renders details and hints', () => {
    expect(errorBody(new AtomicCoreError('MODEL_NOT_FOUND', 'gone', 'id'))).toEqual({
      code: 'MODEL_NOT_FOUND',
      message: 'gone',
      details: 'id',
    })
    const text = describeError(
      new AtcError('ATC_CONSENT_REQUIRED', 'Needs a yes.', { hint: 're-run with --yes' })
    )
    expect(text).toBe('Needs a yes.\n  [ATC_CONSENT_REQUIRED]\n  hint: re-run with --yes')
    expect(errorBody('boom')).toEqual({ code: 'ATC_INTERNAL', message: 'boom' })
  })
})
