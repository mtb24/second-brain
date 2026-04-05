import WebSocket from 'ws'
import { z } from 'zod'

// Session recent item (used in top-level sessions and per-agent sessions)
const SessionRecentItemSchema = z.object({
  key: z.string(),
  updatedAt: z.number().optional().nullable(),
  age: z.number().optional().nullable(),
})

// Channel probe (e.g. telegram.probe)
const ChannelProbeSchema = z
  .object({
    ok: z.boolean().optional().nullable(),
    bot: z
      .object({
        id: z.number().optional().nullable(),
        username: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .optional()
  .nullable()

// Single channel config (e.g. telegram)
const ChannelConfigSchema = z
  .object({
    configured: z.boolean().optional().nullable(),
    running: z.boolean().optional().nullable(),
    lastStartAt: z.number().optional().nullable(),
    lastStopAt: z.number().optional().nullable(),
    lastError: z.string().optional().nullable(),
    tokenSource: z.string().optional().nullable(),
    probe: ChannelProbeSchema,
    lastProbeAt: z.number().optional().nullable(),
    mode: z.string().optional().nullable(),
    accountId: z.string().optional().nullable(),
  })
  .optional()
  .nullable()

// Channels map (keyed by channel name)
const ChannelsSchema = z.record(z.string(), ChannelConfigSchema).optional().nullable()

// Agent heartbeat config
const AgentHeartbeatSchema = z
  .object({
    enabled: z.boolean().optional().nullable(),
    every: z.string().optional().nullable(),
  })
  .optional()
  .nullable()

// Per-agent sessions block
const AgentSessionsSchema = z
  .object({
    path: z.string().optional().nullable(),
    count: z.number().optional().nullable(),
    recent: z.array(SessionRecentItemSchema).optional().nullable().default([]),
  })
  .optional()
  .nullable()

// Agent entry in agents array
const AgentEntrySchema = z.object({
  agentId: z.string(),
  isDefault: z.boolean().optional().nullable(),
  heartbeat: AgentHeartbeatSchema,
  sessions: AgentSessionsSchema,
})

// Top-level sessions summary
const SessionsSummarySchema = z
  .object({
    count: z.number().optional().nullable(),
    recent: z.array(SessionRecentItemSchema).optional().nullable().default([]),
  })
  .optional()
  .nullable()

const HealthSnapshotSchema = z.object({
  ok: z.boolean(),
  ts: z.number().optional().nullable(),
  durationMs: z.number().optional().nullable(),
  channels: ChannelsSchema,
  channelOrder: z.array(z.string()).optional().nullable(),
  heartbeatSeconds: z.number().optional().nullable(),
  defaultAgentId: z.string().optional().nullable(),
  agents: z.array(AgentEntrySchema).optional().nullable().default([]),
  sessions: SessionsSummarySchema,
})

// Agents list RPC response (result may be { agents: [...] } or direct array)
const AgentsListResponseSchema = z.union([
  z.object({ agents: z.array(AgentEntrySchema).optional().nullable() }),
  z.array(AgentEntrySchema),
])

type GatewayReq = {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

type GatewayEvent = {
  type: 'event'
  event: string
  payload?: any
}

type GatewayRes = {
  type: 'res'
  id: string
  ok: boolean
  result?: unknown
  payload?: unknown
  error?: { message: string }
}

type GatewayMessage = GatewayReq | GatewayEvent | GatewayRes

export type HealthSnapshot = z.infer<typeof HealthSnapshotSchema>

export type AgentSummary = {
  agentId: string
  id?: string
  name?: string
  status?: string
  model?: string
  lastActiveAt?: string
  messageCount?: number
  isDefault?: boolean | null
  heartbeat?: { enabled?: boolean; every?: string } | null
  sessions?: { path?: string; count?: number; recent?: { key: string; updatedAt?: number; age?: number }[] } | null
}

export type AgentFile = {
  path: string
  size: number
}

export type AgentDetail = {
  agent: AgentSummary | null
  files: AgentFile[]
  sessions: {
    key: string
    updatedAt: string
    age: string
  }[]
}

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN

if (!GATEWAY_URL) {
  throw new Error('OPENCLAW_GATEWAY_URL must be set in the environment')
}

if (!GATEWAY_TOKEN) {
  console.warn('OPENCLAW_GATEWAY_TOKEN is not set — direct gateway connections will likely be rejected')
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function withGateway<T>(
  fn: (opts: { ws: WebSocket }) => Promise<T>,
): Promise<T> {
  console.log('Connecting to OpenClaw gateway:', GATEWAY_URL)
  const gatewayOrigin = (() => {
    try {
      const u = new URL(GATEWAY_URL)
      return `${u.protocol === 'wss:' ? 'https' : 'http'}://${u.host}`
    } catch {
      return GATEWAY_URL
    }
  })()
  const ws = new WebSocket(GATEWAY_URL, {
    headers: {
      Origin: gatewayOrigin,
    },
  })

  const result = new Promise<T>((resolve, reject) => {
    let connected = false

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('OpenClaw gateway handshake timed out'))
    }, 10_000)

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

      ws.on('message', (data) => {
      let msg: GatewayMessage
      try {
        msg = JSON.parse(data.toString())
      } catch (e) {
        return
      }

      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        const req: GatewayReq = {
          type: 'req',
          id: nextId('connect'),
          method: 'connect',
          params: {
            auth: {},
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'webchat-ui',
              mode: 'webchat',
              version: '2026.4.2',
              platform: process.platform,
            },
          },
        }
        ws.send(JSON.stringify(req))
        return
      }

      if (msg.type === 'res' && (msg as GatewayRes).ok === false) {
        clearTimeout(timeout)
        reject(
          new Error(
            (msg as GatewayRes).error?.message ??
              'OpenClaw gateway connect failed',
          ),
        )
        return
      }

      if (msg.type === 'res' && (msg as GatewayRes).payload?.type === 'hello-ok') {
        connected = true
        clearTimeout(timeout)
        // delegate to the caller now that the connection is established
        fn({ ws })
          .then((value) => {
            ws.close()
            resolve(value)
          })
          .catch((err) => {
            ws.close()
            reject(err)
          })
      }
    })

    ws.on('close', () => {
      if (!connected) {
        clearTimeout(timeout)
        reject(new Error('OpenClaw gateway connection closed before hello'))
      }
    })
  })

  try {
    return await result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('OpenClaw gateway error:', message)
    if (stack) console.error(stack)
    throw err
  }
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  try {
    const health = await withGateway<HealthSnapshot>(async ({ ws }) => {
    // Prefer the snapshot from the hello event which has already been parsed in withGateway.
    // If needed we could call the dedicated `health` RPC here; for now, assume the gateway
    // exposes `health` that returns the same shape.
    const req: GatewayReq = {
      type: 'req',
      id: nextId('health'),
      method: 'health',
      params: {},
    }

    const pending = new Map<string, (res: GatewayRes) => void>()

    ws.on('message', (data) => {
      let msg: GatewayMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      if (msg.type === 'res' && msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id)!
        pending.delete(msg.id)
        resolve(msg)
      }
    })

    const response: GatewayRes = await new Promise((resolve, reject) => {
      pending.set(req.id, resolve)
      ws.send(JSON.stringify(req), (err) => {
        if (err) {
          pending.delete(req.id)
          reject(err)
        }
      })
      setTimeout(() => {
        if (pending.has(req.id)) {
          pending.delete(req.id)
          reject(new Error('health RPC timed out'))
        }
      }, 10_000)
    })

    if (!response.ok) {
      throw new Error(response.error?.message ?? 'health RPC failed')
    }

    // Health RPC returns data in response.payload (not response.result)
    const raw = response.payload
    if (raw === undefined || raw === null) {
      throw new Error('health RPC returned no result')
    }
    return HealthSnapshotSchema.parse(raw)
  })
    return health
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('getHealthSnapshot failed:', message)
    if (stack) console.error(stack)
    throw err
  }
}

export async function listAgents(): Promise<AgentSummary[]> {
  try {
    return await withGateway<AgentSummary[]>(async ({ ws }) => {
    // WORKAROUND: agents.list RPC returns "missing scope: operator.read" in
    // OpenClaw 2026.3.13. Fixed in a future release. When upgrading OpenClaw
    // and this starts failing, remove this workaround and restore the original
    // agents.list RPC call below.
    // Original code: const payload = await this.rpc('agents.list', {})
    // Track: https://github.com/openclaw/openclaw/issues/46716

    const req: GatewayReq = {
      type: 'req',
      id: nextId('health'),
      method: 'health',
      params: {},
    }

    const pending = new Map<string, (res: GatewayRes) => void>()

    ws.on('message', (data) => {
      let msg: GatewayMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      if (msg.type === 'res' && msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id)!
        pending.delete(msg.id)
        resolve(msg)
      }
    })

    const response: GatewayRes = await new Promise((resolve, reject) => {
      pending.set(req.id, resolve)
      ws.send(JSON.stringify(req), (err) => {
        if (err) {
          pending.delete(req.id)
          reject(err)
        }
      })
      setTimeout(() => {
        if (pending.has(req.id)) {
          pending.delete(req.id)
          reject(new Error('health RPC timed out'))
        }
      }, 10_000)
    })

    if (!response.ok) {
      throw new Error(response.error?.message ?? 'health RPC failed')
    }

    const raw = response.payload
    if (raw === undefined || raw === null) {
      return []
    }
    const snapshot = HealthSnapshotSchema.safeParse(raw)
    if (!snapshot.success) {
      return []
    }
    const agents = snapshot.data.agents ?? []
    return agents.map((agent): AgentSummary => ({
      agentId: agent.agentId,
      id: agent.agentId,
      name: agent.agentId,
      status: 'active',
      model: 'anthropic/claude-sonnet-4-6',
      lastActiveAt: agent.sessions?.recent?.[0]?.updatedAt
        ? new Date(agent.sessions.recent[0].updatedAt).toISOString()
        : undefined,
      messageCount: agent.sessions?.count ?? 0,
      isDefault: agent.isDefault,
      heartbeat: agent.heartbeat,
      sessions: agent.sessions,
    }))
  })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('listAgents failed:', message)
    if (stack) console.error(stack)
    throw err
  }
}

export async function getAgentDetail(agentId: string): Promise<AgentDetail> {
  return withGateway<AgentDetail>(async ({ ws }) => {
    // WORKAROUND: agents.list RPC returns "missing scope: operator.read" in
    // OpenClaw 2026.3.13. Fixed in a future release. When upgrading OpenClaw
    // and this starts failing, remove this workaround and restore the original
    // agents.list RPC call for resolving the agent.
    // Track: https://github.com/openclaw/openclaw/issues/46716

    const pending = new Map<string, (res: GatewayRes) => void>()

    ws.on('message', (data) => {
      let msg: GatewayMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }
      if (msg.type === 'res' && msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id)!
        pending.delete(msg.id)
        resolve(msg)
      }
    })

    async function rpc(method: string, params?: unknown): Promise<any> {
      const req: GatewayReq = {
        type: 'req',
        id: nextId(method),
        method,
        params,
      }

      const res: GatewayRes = await new Promise((resolve, reject) => {
        pending.set(req.id, resolve)
        ws.send(JSON.stringify(req), (err) => {
          if (err) {
            pending.delete(req.id)
            reject(err)
          }
        })
        setTimeout(() => {
          if (pending.has(req.id)) {
            pending.delete(req.id)
            reject(new Error(`${method} RPC timed out`))
          }
        }, 10_000)
      })

      if (!res.ok) {
        throw new Error(res.error?.message ?? `${method} RPC failed`)
      }

      return res.result
    }

    // Resolve agent from health RPC (workaround for agents.list scope bug)
    const healthReq: GatewayReq = {
      type: 'req',
      id: nextId('health'),
      method: 'health',
      params: {},
    }
    const healthRes: GatewayRes = await new Promise((resolve, reject) => {
      pending.set(healthReq.id, resolve)
      ws.send(JSON.stringify(healthReq), (err) => {
        if (err) {
          pending.delete(healthReq.id)
          reject(err)
        }
      })
      setTimeout(() => {
        if (pending.has(healthReq.id)) {
          pending.delete(healthReq.id)
          reject(new Error('health RPC timed out'))
        }
      }, 10_000)
    })
    let agent: AgentSummary | null = null
    if (healthRes.ok && healthRes.payload != null) {
      const snapshot = HealthSnapshotSchema.safeParse(healthRes.payload)
      if (snapshot.success) {
        const entry = snapshot.data.agents?.find((a) => a.agentId === agentId)
        if (entry) {
          agent = {
            agentId: entry.agentId,
            id: entry.agentId,
            name: entry.agentId,
            status: 'active',
            model: 'anthropic/claude-sonnet-4-6',
            lastActiveAt: entry.sessions?.recent?.[0]?.updatedAt
              ? new Date(entry.sessions.recent[0].updatedAt).toISOString()
              : undefined,
            messageCount: entry.sessions?.count ?? 0,
            isDefault: entry.isDefault,
            heartbeat: entry.heartbeat,
            sessions: entry.sessions,
          }
        }
      }
    }

    // agents.files.list (and agents.files.get) may fail with "missing scope" in
    // OpenClaw 2026.3.13. Return empty files gracefully instead of throwing.
    // Track: https://github.com/openclaw/openclaw/issues/46716
    let files: AgentFile[] = []
    try {
      const filesList = await rpc('agents.files.list', { agentId })
      if (Array.isArray(filesList?.files)) {
        files = filesList.files as AgentFile[]
      }
    } catch {
      // Scope or other RPC failure — return empty files
    }

    const sessions = await rpc('sessions.list', { agentId })
    const sessionItems: AgentDetail['sessions'] = Array.isArray(
      sessions?.sessions,
    )
      ? (sessions.sessions as AgentDetail['sessions'])
      : []

    return {
      agent,
      files,
      sessions: sessionItems,
    }
  })
}


