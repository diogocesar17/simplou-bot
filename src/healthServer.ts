import http from 'http'

let server: http.Server | null = null
let started = false

export function startHealthServer(port?: number): void {
  if (started && server) {
    return
  }

  const listenPort = Number(process.env.PORT || port || 3000)

  server = http.createServer((req, res) => {
    // Only GET /health
    if (req.method === 'GET' && req.url === '/health') {
      const payload = JSON.stringify({ status: 'ok' })
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      })
      res.end(payload)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  })

  server.on('error', (err) => {
    console.error('[HEALTH] Erro no servidor de health:', (err as any)?.message || err)
  })

  server.listen(listenPort, () => {
    started = true
    console.log(`[HEALTH] Health server ouvindo na porta ${listenPort}`)
  })
}

