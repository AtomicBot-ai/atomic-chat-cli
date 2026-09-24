import { describe, expect, it } from 'vitest'
import { atcPathsFor } from '../config/index.js'
import { daemonArgs } from './spawn.js'

describe('daemonArgs', () => {
  it('always names the folder and a free control port', () => {
    const paths = atcPathsFor('/d')
    expect(daemonArgs(paths)).toEqual(['daemon', '--data-folder', '/d', '--control-port', '0'])
    expect(daemonArgs(paths, ['--admin-port', '0'])).toEqual([
      'daemon',
      '--data-folder',
      '/d',
      '--control-port',
      '0',
      '--admin-port',
      '0',
    ])
  })
})
