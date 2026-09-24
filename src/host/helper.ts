/**
 * `atc host-step exec <request.json>`: the privileged half. It reads the request, runs the recipe
 * the core asked for, writes `<step_id>.result.json` beside the request and exits. It never opens
 * the control API and never trusts anything but the file.
 *
 * Recipes are not shipped yet (the core's `provisionerFor` is null on every platform), so today
 * every request ends in `failed` with a message that says so. That is the honest state of the
 * feature, and the file protocol around it is what the executor tests against.
 */

import { AtcError } from '../errors/index.js'
import type { HostStepRequestFile, HostStepResultFile } from './elevator.js'
import { MANAGED_HOST_ACTIONS } from './managed-types.js'

export function resultPathFor(requestPath: string): string {
  return requestPath.replace(/\.request\.json$/, '.result.json')
}

export function parseRequestFile(text: string): HostStepRequestFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new AtcError('ATC_USAGE', 'The host-step request is not valid JSON.', {
      details: (error as Error).message,
    })
  }
  const r = raw as Record<string, unknown>
  const problems: string[] = []
  if (r['schema_version'] !== 1) problems.push('schema_version must be 1')
  for (const key of [
    'step_id',
    'operation_id',
    'recipe_id',
    'recipe_digest',
    'parameters_digest',
    'nonce',
    'data_folder',
  ])
    if (typeof r[key] !== 'string' || r[key] === '') problems.push(`${key} must be a string`)
  if (!MANAGED_HOST_ACTIONS.includes(r['action'] as never))
    problems.push(`action must be one of ${MANAGED_HOST_ACTIONS.join(', ')}`)
  if (typeof r['expected_operation_revision'] !== 'number')
    problems.push('expected_operation_revision must be a number')
  if (problems.length)
    throw new AtcError('ATC_USAGE', `The host-step request is malformed: ${problems.join('; ')}`)
  return r as unknown as HostStepRequestFile
}

export interface HelperDeps {
  readFile: (path: string) => Promise<string | undefined>
  writeFile: (path: string, text: string) => Promise<void>
  now: () => number
}

export async function runHostStepHelper(requestPath: string, deps: HelperDeps): Promise<HostStepResultFile> {
  const text = await deps.readFile(requestPath)
  if (text === undefined) throw new AtcError('ATC_USAGE', `No request file at ${requestPath}.`)
  const request = parseRequestFile(text)
  const result: HostStepResultFile = {
    schema_version: 1,
    step_id: request.step_id,
    outcome: 'failed',
    exit_code: null,
    log_tail: `no recipe is shipped for ${request.action} (${request.recipe_id}) in this build [MANAGED_ADAPTER_UNAVAILABLE]`,
    finished_at: deps.now(),
  }
  await deps.writeFile(resultPathFor(requestPath), `${JSON.stringify(result, null, 2)}\n`)
  return result
}
