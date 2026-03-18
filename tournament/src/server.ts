/**
 * tournament/src/server.ts
 * Lightweight HTTP server — accepts POST /start and runs TournamentOrchestrator.startRound()
 */

import 'dotenv/config'
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
      const orchestrator = new TournamentOrchestrator()
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
