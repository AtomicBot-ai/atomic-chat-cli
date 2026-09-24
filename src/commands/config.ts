import { AtcError, defineCommand, plannedPartial } from '../cli/index.js'
import {
  checkValue,
  coerceValue,
  defaultConfig,
  fieldFor,
  FIELDS,
  getAt,
  setAt,
  writeConfigFile,
} from '../config/index.js'
import type { AtcConfig } from '../config/index.js'

const ENGINE_KEY = /^engine\./

function engineStub(key: string): never {
  throw new AtcError(
    'ATC_NOT_IMPLEMENTED',
    `'${key}' is an engine setting the core owns; forwarding it is not implemented yet.`,
    {
      details: `planned for ${plannedPartial('config engine.*')}`,
    }
  )
}

const get = defineCommand({
  name: 'get',
  summary: 'Print one value',
  positionals: [{ name: 'key', description: 'Dotted key, e.g. api.port', required: true }],
  run: async (inv, ctx) => {
    const key = inv.positionals[0] as string
    if (ENGINE_KEY.test(key)) engineStub(key)
    if (!fieldFor(key))
      throw new AtcError('ATC_USAGE', `Unknown config key '${key}'.`, { hint: 'see `atc config list`' })
    const config = await ctx.config()
    const value = getAt(config.values, key)
    ctx.out.result({ key, value: value ?? null, source: config.sources[key] }, () =>
      ctx.out.line(
        value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
      )
    )
    return 0
  },
})

const set = defineCommand({
  name: 'set',
  summary: 'Set one value in the config file',
  positionals: [
    { name: 'key', description: 'Dotted key, e.g. api.port', required: true },
    { name: 'value', description: 'Value as text (lists comma-separated)', required: true },
  ],
  examples: ['atc config set api.port 1337', 'atc config set models.autoLoad qwen3-8b,gemma-4b'],
  run: async (inv, ctx) => {
    const [key, raw] = inv.positionals as [string, string]
    if (ENGINE_KEY.test(key)) engineStub(key)
    const field = fieldFor(key)
    if (!field)
      throw new AtcError('ATC_USAGE', `Unknown config key '${key}'.`, { hint: 'see `atc config list`' })
    const value = coerceValue(field, raw)
    const problem = checkValue(field, value)
    if (problem) throw new AtcError('ATC_CONFIG_INVALID', problem)
    const current = await ctx.config()
    const fileConfig: AtcConfig = current.file?.config ?? defaultConfig()
    setAt(fileConfig as unknown as Record<string, unknown>, key, value)
    await writeConfigFile(ctx.paths.configFile, fileConfig, current.file?.extra ?? {})
    ctx.out.result({ key, value }, () => ctx.out.success(`${key} = ${JSON.stringify(value)}`))
    if (current.sources[key] === 'env') ctx.out.warn(`an environment variable currently overrides ${key}`)
    return 0
  },
})

const unset = defineCommand({
  name: 'unset',
  summary: 'Remove one value from the config file (the default applies again)',
  positionals: [{ name: 'key', description: 'Dotted key', required: true }],
  run: async (inv, ctx) => {
    const key = inv.positionals[0] as string
    if (!fieldFor(key)) throw new AtcError('ATC_USAGE', `Unknown config key '${key}'.`)
    const current = await ctx.config()
    const fileConfig: AtcConfig = current.file?.config ?? defaultConfig()
    const defaultValue = fieldFor(key)?.default
    setAt(
      fileConfig as unknown as Record<string, unknown>,
      key,
      defaultValue === undefined ? undefined : structuredClone(defaultValue)
    )
    await writeConfigFile(ctx.paths.configFile, fileConfig, current.file?.extra ?? {})
    ctx.out.result({ key, value: defaultValue ?? null }, () => ctx.out.success(`${key} reset`))
    return 0
  },
})

const list = defineCommand({
  name: 'list',
  summary: 'Every key with its value and where it comes from',
  run: async (_inv, ctx) => {
    const config = await ctx.config()
    ctx.out.result({ values: config.values, sources: config.sources }, () =>
      ctx.out.table(
        [{ header: 'KEY' }, { header: 'VALUE' }, { header: 'SOURCE' }, { header: 'DESCRIPTION' }],
        FIELDS.map((f) => {
          const v = getAt(config.values, f.path)
          return [
            f.path,
            v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v),
            config.sources[f.path] ?? 'default',
            f.description,
          ]
        })
      )
    )
    return 0
  },
})

const path = defineCommand({
  name: 'path',
  summary: 'Print the config file path',
  run: async (_inv, ctx) => {
    ctx.out.result({ path: ctx.paths.configFile, data_folder: ctx.paths.dataFolder }, () =>
      ctx.out.line(ctx.paths.configFile)
    )
    return 0
  },
})

export const configCommand = defineCommand({
  name: 'config',
  summary: 'Read and change atc settings',
  description:
    'atc settings live in <data>/atc/config.json; ATC_* environment variables and flags override them. Engine parameters (engine.<provider>.<key>) belong to the core.',
  group: 'system',
  subcommands: [get, set, unset, list, path],
})
