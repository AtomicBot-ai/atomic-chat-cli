/** The command tree. Order here is the order in `atc --help`. */

import { defineCommand } from '../cli/index.js'
import { adminCommand } from './admin.js'
import { completionCommand } from './completion.js'
import { configCommand } from './config.js'
import { daemonCommand } from './daemon.js'
import { doctorCommand } from './doctor.js'
import { hostStepCommand } from './host-step.js'
import { restartCommand, startCommand, statusCommand, stopCommand } from './lifecycle.js'
import { logsCommand } from './logs.js'
import {
  apiCommand,
  enginesCommand,
  hardwareCommand,
  modelsCommand,
  runCommand,
  serveCommand,
  serviceCommand,
  setupCommand,
} from './stubs.js'
import { updateCommand } from './update.js'
import { versionCommand } from './version.js'

export const ROOT = defineCommand({
  name: 'atc',
  summary: 'Atomic Chat server CLI',
  description:
    'atc runs an inference engine and a model on this machine, exposes them over an OpenAI-compatible API, and manages it all from the terminal or a local web admin.',
  subcommands: [
    serveCommand,
    runCommand,
    startCommand,
    stopCommand,
    restartCommand,
    statusCommand,
    logsCommand,
    modelsCommand,
    enginesCommand,
    setupCommand,
    hardwareCommand,
    apiCommand,
    adminCommand,
    configCommand,
    doctorCommand,
    serviceCommand,
    updateCommand,
    versionCommand,
    completionCommand,
    daemonCommand,
    hostStepCommand,
  ],
})
