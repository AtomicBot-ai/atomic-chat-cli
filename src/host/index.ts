/**
 * Host services: running programs, facts about the machine and session, elevation and the
 * host-step protocol, hardware probing, OS services, ports. `nodeHostServices` is the real one;
 * tests build the same shape from fakes.
 */
import { selfCommand } from '@atomic-chat/core/host'
import type { AtcIo } from '../io.js'
import { createElevator } from './elevator.js'
import type { Elevator } from './elevator.js'
import { execCommand, findOnPath } from './exec.js'
import type { ExecFn } from './exec.js'
import { nodeHostFacts } from './facts.js'
import type { HostFacts } from './facts.js'
import { readResultFile } from './host-step.js'
import { probePort } from './ports.js'
import { notImplementedServiceManager } from './service-manager.js'
import type { ServiceManager } from './service-manager.js'

export * from './exec.js'
export * from './facts.js'
export * from './ports.js'
export * from './managed-types.js'
export * from './elevator.js'
export * from './helper.js'
export * from './host-step.js'
export * from './hardware-prober.js'
export * from './service-manager.js'

export interface HostServices {
  facts: HostFacts
  exec: ExecFn
  elevator: Elevator
  services: ServiceManager
  /** How to re-run this program. */
  selfCommand: readonly string[]
  probePort: typeof probePort
  findOnPath: (name: string) => string | undefined
}

export function nodeHostServices(io: AtcIo, self: readonly string[] = selfCommand()): HostServices {
  return {
    facts: nodeHostFacts(io),
    exec: execCommand,
    elevator: createElevator({ exec: execCommand, selfCommand: self, readResult: readResultFile }),
    services: notImplementedServiceManager(),
    selfCommand: self,
    probePort,
    findOnPath: (name) => findOnPath(name, io.env),
  }
}
