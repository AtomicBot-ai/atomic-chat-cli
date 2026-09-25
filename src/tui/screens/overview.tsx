/**
 * The Overview: the admin dashboard's cards in the same order and words (Daemon, Core, API server,
 * Loaded models, Pending host steps, Admin), one line each, so moving between the browser and the
 * terminal teaches nothing new.
 */

import { Box, Text } from 'ink'
import { formatDuration } from '../../output/index.js'
import { Row } from '../components/index.js'
import type { DaemonView } from '../state.js'
import { useTone } from '../theme.js'

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function clockOf(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Down({ error, dataFolder }: { error: string | undefined; dataFolder: string }) {
  const tone = useTone()
  return (
    <Box flexDirection="column">
      <Row mark="off" label="Daemon">
        not running
      </Row>
      <Row>{`data folder ${dataFolder}`}</Row>
      {error ? (
        <Row mark="attention">
          <Text {...tone('warn')}>{error}</Text>
        </Row>
      ) : null}
      <Text> </Text>
      <Text>
        Press{' '}
        <Text bold {...tone('accent')}>
          s
        </Text>{' '}
        to start it (the same as `atc start`). It keeps running after you leave this screen.
      </Text>
    </Box>
  )
}

export function OverviewScreen({
  daemon,
  dataFolder,
  now,
  height,
}: {
  daemon: DaemonView
  dataFolder: string
  now: number
  height: number
}) {
  const tone = useTone()
  if (daemon.kind === 'connecting') return <Text {...tone('muted')}>connecting to the daemon…</Text>
  if (daemon.kind === 'down') return <Down error={daemon.error} dataFolder={dataFolder} />

  const { snapshot, record, pending } = daemon
  const api = snapshot.server
  const uptime = record ? ` · up ${formatDuration(now - record.started_at)}` : ''
  const started = record ? ` · started ${clockOf(record.started_at)}` : ''
  // Rows left for the per-model and per-step lines after the six card headings.
  const spare = Math.max(0, height - 7)
  const sessions = snapshot.sessions.slice(0, Math.max(1, Math.ceil(spare / 2)))
  const steps = pending.slice(0, Math.max(1, spare - sessions.length))
  return (
    <Box flexDirection="column">
      <Row mark="on" label="Daemon">
        {`pid ${record?.pid ?? snapshot.pid}${uptime}${started}`}
      </Row>
      <Row>{`data folder ${snapshot.data_folder}`}</Row>
      <Row mark="on" label="Core">
        {`${snapshot.version} · instance ${shortId(snapshot.instance_id)} · protocol ${snapshot.protocol} · pid ${snapshot.pid}`}
      </Row>
      <Row mark={api.running ? 'on' : 'off'} label="API server">
        {api.running
          ? `http://${api.host}:${api.port}${api.prefix}${api.requires_api_key ? ' · key required' : ' · no key'}${api.pid ? ` · pid ${api.pid}` : ''}`
          : 'stopped'}
      </Row>
      {snapshot.sessions.length === 0 ? (
        <Row mark="off" label="Loaded models">
          none loaded
        </Row>
      ) : (
        sessions.map((s, i) => (
          <Row
            key={`${s.provider}/${s.model_id}`}
            mark={i === 0 ? 'on' : 'none'}
            label={i === 0 ? 'Loaded models' : ''}
          >
            {`${s.model_id} · ${s.provider} · :${s.port} · pid ${s.pid}${s.is_embedding ? ' · embedding' : ''}`}
          </Row>
        ))
      )}
      {pending.length === 0 ? (
        <Row label="Pending host steps">none</Row>
      ) : (
        steps.map((step, i) => (
          <Row
            key={step.step_id}
            mark={i === 0 ? 'attention' : 'none'}
            label={i === 0 ? 'Pending host steps' : ''}
          >
            <Text {...tone('warn')}>{`${step.step_id} — ${step.instructions.split('\n')[0] ?? ''}`}</Text>
          </Row>
        ))
      )}
      <Row mark={record?.admin_url ? 'on' : 'off'} label="Admin">
        {record?.admin_url
          ? `${record.admin_url} · atc ${record.atc_version} · a for a login link`
          : record?.state === 'starting'
            ? 'starting'
            : 'off'}
      </Row>
    </Box>
  )
}
