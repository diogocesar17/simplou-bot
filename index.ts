import 'dotenv/config'
import { bootstrap } from './src/app'

bootstrap().catch((err) => {
  console.error('Erro ao iniciar aplicação:', err?.message || err)
  process.exit(1)
})
