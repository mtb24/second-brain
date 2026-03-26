/**
 * tournament/src/server.ts
 * Lightweight HTTP server — accepts POST /start and runs TournamentOrchestrator.startRound()
 */

import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(__dirname, '../../.env') })
import http from 'http'
import { TournamentOrchestrator } from './orchestrator.js'

const PORT = Number(process.env.TOURNAMENT_PORT ?? 3001)

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method === 'POST' && req.url === '/start') {
    console.log('[tournament-server] POST /start received')
    try {
      const rawBody = await new Promise<string>((resolve) => {
        let data = ''
        req.on('data', (chunk) => { data += chunk })
        req.on('end', () => resolve(data))
      })
      const body = rawBody ? JSON.parse(rawBody) : {}
      const config = body.durationSeconds ? { roundDurationSeconds: Number(body.durationSeconds) } : {}
      const orchestrator = new TournamentOrchestrator(config)
      const result = await orchestrator.startRound()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, ...result }))
    } catch (err) {
      console.error('[tournament-server] startRound failed:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: String(err) }))
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[tournament-server] Listening on port ${PORT}`)
})
