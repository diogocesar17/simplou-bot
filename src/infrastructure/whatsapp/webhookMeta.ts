import { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../logger';

// Variável de ambiente necessária:
// META_WEBHOOK_VERIFY_TOKEN — token secreto definido por você no painel da Meta para verificar o webhook

export function handleMetaWebhookVerification(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('[META WEBHOOK] Verificação de webhook bem-sucedida');
    res.writeHead(200);
    res.end(challenge);
    return true;
  }

  logger.warn('[META WEBHOOK] Falha na verificação do webhook — token inválido');
  res.writeHead(403);
  res.end('Forbidden');
  return false;
}

// Parseia o payload do webhook da Meta e retorna { userId, texto, tipo, rawMessage }
// Retorna null se não for uma mensagem de texto/mídia processável
export function parseMetaWebhookPayload(body: any): {
  userId: string;
  texto: string;
  tipo: 'text' | 'audio' | 'image' | 'document';
  rawMessage: any;
} | null {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    // userId no formato compatível com Baileys: número@s.whatsapp.net
    const phone = message.from;
    const userId = `${phone}@s.whatsapp.net`;

    const tipo = message.type as 'text' | 'audio' | 'image' | 'document';
    const texto = message?.text?.body || message?.caption || '';

    return { userId, texto, tipo, rawMessage: message };
  } catch (err) {
    logger.error({ err }, '[META WEBHOOK] Erro ao parsear payload');
    return null;
  }
}

// TODO (migração completa): montar este handler no servidor HTTP
// O servidor deve:
//   GET  /webhook/meta → handleMetaWebhookVerification
//   POST /webhook/meta → parsear payload, chamar handleMessage(adapter, userId, texto)
//                        e tratar mídia (áudio, imagem, documento) via MetaCloudAdapter
