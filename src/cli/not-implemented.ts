/**
 * The registry of scaffold stubs and the iteration each one is planned for. One source of truth:
 * `notImplemented()` reads it for its message, and a test asserts that every stub in the command
 * tree is listed here and every entry here is a stub — so a command cannot be implemented while
 * still listed, or listed while quietly missing. The plan behind the iterations is docs/roadmap.md.
 */

export const ITERATIONS = {
  I2: 'iteration 2 (daemon lifecycle, serve/run, api start/stop)',
  I3: 'iteration 3 (models: catalog, pull, list, rm; API keys)',
  I4: 'iteration 4 (engines, setup, managed environment, elevation)',
  I5: 'iteration 5 (admin pages: API, models, engines; non-loopback consent)',
  I6: 'iteration 6 (service, update, doctor completion)',
  I7: 'iteration 7 (admin: setup wizard, logs, settings, hardware)',
} as const
export type Iteration = keyof typeof ITERATIONS

/** Command path → iteration. Keys are the space-joined path below `atc`. */
export const PLANNED: Record<string, Iteration> = {
  'serve': 'I2',
  'run': 'I2',
  'api start': 'I2',
  'api stop': 'I2',
  'api status': 'I2',
  'api key show': 'I3',
  'api key set': 'I3',
  'api key rotate': 'I3',
  'api key clear': 'I3',
  'models search': 'I3',
  'models pull': 'I3',
  'models list': 'I3',
  'models rm': 'I3',
  'models info': 'I3',
  'models load': 'I3',
  'models unload': 'I3',
  'engines list': 'I4',
  'engines install': 'I4',
  'engines status': 'I4',
  'engines rm': 'I4',
  'setup': 'I4',
  'hardware show': 'I4',
  'hardware refresh': 'I4',
  'service install': 'I6',
  'service uninstall': 'I6',
  'service status': 'I6',
  'service start': 'I6',
  'service stop': 'I6',
}

/** Features of otherwise working commands that are still stubs (`atc logs -f`, `atc update` without `--check`). */
export const PLANNED_PARTIAL: Record<string, Iteration> = {
  'logs --follow': 'I2',
  'update apply': 'I6',
  'config engine.*': 'I2',
  'host-step recipes': 'I4',
}

export function plannedPartial(feature: string): string {
  const key = PLANNED_PARTIAL[feature]
  return key === undefined ? 'a later iteration' : ITERATIONS[key]
}

export function plannedFor(path: readonly string[]): string | undefined {
  const key = PLANNED[path.join(' ')]
  return key === undefined ? undefined : ITERATIONS[key]
}
