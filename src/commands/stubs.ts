/**
 * Commands designed in this iteration and implemented in later ones. Their flags and help are
 * final; running one fails with `ATC_NOT_IMPLEMENTED` (exit 3) and names the iteration.
 */

import { defineCommand, notImplemented } from '../cli/index.js'

const loadOptions = {
  'engine': {
    type: 'string',
    description: 'llamacpp-upstream (default), llamacpp or mlx',
    placeholder: 'provider',
  },
  'ctx-size': { type: 'string', description: 'Context size in tokens', placeholder: 'tokens' },
  'n-gpu-layers': { type: 'string', description: 'GPU layers (-1 = all)', placeholder: 'n' },
  'embedding': { type: 'boolean', description: 'Start in embedding mode' },
} as const

const apiOptions = {
  'port': { type: 'string', description: 'API port', placeholder: 'port', default: '1337' },
  'host': {
    type: 'string',
    description: 'API bind address (0.0.0.0 to expose)',
    placeholder: 'host',
    default: '127.0.0.1',
  },
  'api-key': { type: 'string', description: 'Require this key on the API', placeholder: 'key' },
  'api-key-file': {
    type: 'string',
    description: 'Read the key from a file (secrets mounts)',
    placeholder: 'path',
  },
} as const

export const serveCommand = notImplemented({
  name: 'serve',
  summary: 'Get a model serving: engine, download, daemon, load, OpenAI-compatible API',
  description:
    'One step on a server: installs the best engine pack if needed, pulls the model if it is not installed, starts the daemon, loads the model and exposes http://127.0.0.1:1337/v1. Returns once the model answers; the daemon keeps running.',
  group: 'run',
  positionals: [
    {
      name: 'model',
      description: 'owner/repo, owner/repo:file.gguf, a catalog alias, or serve.model from config',
    },
  ],
  options: { ...apiOptions, ...loadOptions },
  examples: ['atc serve Qwen/Qwen3-8B-GGUF', 'atc serve qwen3-8b --host 0.0.0.0 --api-key "$KEY"'],
})

export const runCommand = notImplemented({
  name: 'run',
  summary: 'Like serve, but everything in the foreground (containers, systemd)',
  description:
    'Runs the daemon, the admin and the model in this process and stops them on SIGTERM/SIGINT. For Docker use `--init`. `--no-model` runs the daemon alone.',
  group: 'run',
  positionals: [{ name: 'model', description: 'As for serve' }],
  options: {
    ...apiOptions,
    ...loadOptions,
    'no-model': { type: 'boolean', description: 'Run the daemon without loading a model' },
  },
  examples: ['atc run --host 0.0.0.0 --api-key-file /run/secrets/key Qwen/Qwen3-8B-GGUF'],
})

export const modelsCommand = defineCommand({
  name: 'models',
  summary: 'Search, download, list, remove, load and unload models',
  group: 'models',
  subcommands: [
    notImplemented({
      name: 'search',
      summary: 'Search the curated catalog (and Hugging Face for owner/repo)',
      positionals: [{ name: 'query', description: 'Words, or owner/repo', required: true }],
      options: {
        limit: { type: 'string', description: 'Results to show', placeholder: 'n', default: '20' },
        fit: { type: 'boolean', description: 'Only models that fit this machine' },
      },
    }),
    notImplemented({
      name: 'pull',
      summary: 'Download a model into the data folder',
      positionals: [
        { name: 'model', description: 'owner/repo, owner/repo:file.gguf or a catalog alias', required: true },
      ],
      options: {
        'quant': { type: 'string', description: 'Quantisation to pick (e.g. Q4_K_M)', placeholder: 'quant' },
        'mmproj': { type: 'boolean', description: 'Also download the vision projector' },
        'hf-token': {
          type: 'string',
          description: 'Hugging Face token for gated repos (or HF_TOKEN)',
          placeholder: 'token',
        },
      },
      examples: ['atc models pull Qwen/Qwen3-8B-GGUF --quant Q4_K_M'],
    }),
    notImplemented({
      name: 'list',
      summary: 'Installed models',
      options: { loaded: { type: 'boolean', description: 'Only loaded models' } },
    }),
    notImplemented({
      name: 'rm',
      summary: 'Delete an installed model',
      positionals: [{ name: 'model', description: 'Model id', required: true }],
    }),
    notImplemented({
      name: 'info',
      summary: 'model.yml, size, capabilities and whether it fits',
      positionals: [{ name: 'model', description: 'Model id', required: true }],
    }),
    notImplemented({
      name: 'load',
      summary: 'Load a model into the running core',
      positionals: [{ name: 'model', description: 'Model id', required: true }],
      options: loadOptions,
    }),
    notImplemented({
      name: 'unload',
      summary: 'Unload a model',
      positionals: [{ name: 'model', description: 'Model id', required: true }],
    }),
  ],
})

export const enginesCommand = defineCommand({
  name: 'engines',
  summary: 'Engine packs (llama.cpp builds) the core runs models with',
  group: 'models',
  subcommands: [
    notImplemented({
      name: 'list',
      summary: 'Installed packs, the optimal one, and what is available',
      options: { provider: { type: 'string', description: 'Provider', placeholder: 'id' } },
    }),
    notImplemented({
      name: 'install',
      summary: 'Install a pack (the best for this hardware by default)',
      positionals: [{ name: 'pack', description: 'version/backend, e.g. b6000/cuda-cu12.4-x64' }],
      options: {
        provider: { type: 'string', description: 'Provider', placeholder: 'id' },
        force: { type: 'boolean', description: 'Reinstall' },
      },
    }),
    notImplemented({ name: 'status', summary: 'Active pack, driver facts, mismatch warnings' }),
    notImplemented({
      name: 'rm',
      summary: 'Remove a pack',
      positionals: [{ name: 'pack', description: 'version/backend', required: true }],
    }),
  ],
})

export const setupCommand = notImplemented({
  name: 'setup',
  summary: 'Guided setup: hardware → engine → optional managed runtime (TensorRT-LLM via Docker)',
  description:
    'Shows what would change on the system, asks before touching it, elevates through sudo/pkexec/UAC when needed and resumes after a re-login or reboot. `--dry-run` only prints the plan.',
  group: 'models',
  options: {
    'engine': { type: 'string', description: 'Engine to prepare', placeholder: 'provider' },
    'managed': { type: 'boolean', description: 'Also set up the managed container runtime' },
    'tensorrt': { type: 'boolean', description: 'Shorthand for --managed with TensorRT-LLM' },
    'dry-run': { type: 'boolean', description: 'Print the plan and exit' },
    'resume': {
      type: 'string',
      description: 'Continue an operation after re-login or reboot',
      placeholder: 'operation-id',
    },
  },
})

export const hardwareCommand = defineCommand({
  name: 'hardware',
  summary: 'What atc sees of the GPU and CPU, and what it tells the core',
  group: 'models',
  subcommands: [
    notImplemented({ name: 'show', summary: 'GPUs, VRAM, driver, compute capability, CPU extensions' }),
    notImplemented({
      name: 'refresh',
      summary: 'Probe again and push the facts to the running core',
      options: {
        'cpu-extensions': {
          type: 'string',
          description: 'Override, comma-separated (avx,avx2,avx512)',
          placeholder: 'list',
        },
      },
    }),
  ],
})

export const apiCommand = defineCommand({
  name: 'api',
  summary: 'The OpenAI-compatible API server and its key',
  group: 'access',
  subcommands: [
    notImplemented({
      name: 'start',
      summary: 'Start the API on the running core',
      options: {
        ...apiOptions,
        'prefix': { type: 'string', description: 'Path prefix', placeholder: '/v1', default: '/v1' },
        'cors': { type: 'boolean', description: 'Send CORS headers', default: true },
        'trusted-host': {
          type: 'string',
          multiple: true,
          description: 'Extra Host value to accept',
          placeholder: 'host',
        },
      },
    }),
    notImplemented({ name: 'stop', summary: 'Stop the API' }),
    notImplemented({ name: 'status', summary: 'Where the API listens and whether a key is required' }),
    defineCommand({
      name: 'key',
      summary: 'The API key (stored in the core settings)',
      subcommands: [
        notImplemented({
          name: 'show',
          summary: 'Print the key',
          options: { reveal: { type: 'boolean', description: 'Print it in full' } },
        }),
        notImplemented({
          name: 'set',
          summary: 'Set the key',
          positionals: [{ name: 'key', description: 'The key', required: true }],
        }),
        notImplemented({ name: 'rotate', summary: 'Generate a new key and restart the API' }),
        notImplemented({ name: 'clear', summary: 'Remove the key (loopback only)' }),
      ],
    }),
  ],
})

export const serviceCommand = defineCommand({
  name: 'service',
  summary: 'Run the daemon as an OS service (systemd, launchd, Windows task)',
  group: 'system',
  subcommands: [
    notImplemented({
      name: 'install',
      summary: 'Install and enable the service',
      options: {
        system: { type: 'boolean', description: 'System-wide (needs root)' },
        name: { type: 'string', description: 'Service name', placeholder: 'name', default: 'atc' },
      },
    }),
    notImplemented({ name: 'uninstall', summary: 'Disable and remove the service' }),
    notImplemented({ name: 'status', summary: 'Whether the service is installed and running' }),
    notImplemented({ name: 'start', summary: 'Start the service' }),
    notImplemented({ name: 'stop', summary: 'Stop the service' }),
  ],
})
