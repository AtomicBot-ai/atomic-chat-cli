/** Is a port free to bind? A listen attempt is the only honest answer. */

import { createServer } from 'node:net'

export function probePort(host: string, port: number): Promise<'free' | 'busy'> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve('busy'))
    server.listen(port, host, () => server.close(() => resolve('free')))
  })
}
