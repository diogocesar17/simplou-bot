import http from 'http'
import { logger } from './logger'
import { getPoolStats } from './databaseService'
import { handleMetaWebhookVerification } from './whatsapp/webhookMeta'

let server: http.Server | null = null
let started = false

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function startHealthServer(port?: number): void {
  if (started && server) {
    return
  }

  const listenPort = Number(process.env.PORT || port || 3000)

  server = http.createServer(async (req, res) => {
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

    // GET /webhook/meta — verificação de webhook pelo painel da Meta
    if (req.method === 'GET' && req.url?.startsWith('/webhook/whatsapp')) {
      handleMetaWebhookVerification(req, res)
      return
    }

    // POST /webhook/meta — recebimento de mensagens da Meta
    if (req.method === 'POST' && req.url?.startsWith('/webhook/whatsapp')) {
      try {
        const raw = await readBody(req)
        const body = JSON.parse(raw)
        logger.info({ body }, '[META WEBHOOK] Payload recebido')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
      } catch (err) {
        logger.error({ err: (err as any)?.message || err }, '[META WEBHOOK] Erro ao processar payload')
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'error', message: 'invalid json' }))
      }
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

