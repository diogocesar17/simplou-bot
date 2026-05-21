import http from 'http'
import { logger } from './logger'
import { getPoolStats } from './databaseService'

let server: http.Server | null = null
let started = false

export function startHealthServer(port?: number): void {
  if (started && server) {
    return
  }

  const listenPort = Number(process.env.PORT || port || 3000)

  server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const pool = getPoolStats()
      const payload = JSON.stringify({ status: 'ok', pool })
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      })
      res.end(payload)
      logger.debug({ pool }, '[HEALTH] health check')
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  })

  server.on('error', (err) => {
    logger.error({ err: (err as any)?.message || err }, '[HEALTH] Erro no servidor de health')
  })

  server.listen(listenPort, () => {
    started = true
    logger.info({ port: listenPort }, '[HEALTH] Health server ouvindo')
  })
}

