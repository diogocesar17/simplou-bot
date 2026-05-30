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

// Parseia o payload do webhook da Meta e retorna { userId, texto, tipo, rawMessage, nomeContato }
// Retorna null se não for uma mensagem processável.
// Mensagens interativas (button_reply / list_reply) são normalizadas:
// o ID do botão/item selecionado vira o `texto`, permitindo que os handlers
// existentes funcionem sem alteração (eles esperam "1", "2", etc.).
export function parseMetaWebhookPayload(body: any): {
  userId: string;
  texto: string;
  tipo: 'text' | 'audio' | 'image' | 'document';
  rawMessage: any;
  nomeContato?: string;
  messageId: string;
} | null {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    const phone = message.from;
    const userId = `${phone}@s.whatsapp.net`;
    const nomeContato = value?.contacts?.[0]?.profile?.name as string | undefined;

    const messageId: string = message.id || '';

    if (message.type === 'interactive') {
      const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
      if (!reply?.id) return null;
      return { userId, texto: reply.id, tipo: 'text', rawMessage: message, nomeContato, messageId };
    }

    const tipo = message.type as 'text' | 'audio' | 'image' | 'document';
    const texto = message?.text?.body || message?.caption || '';

    return { userId, texto, tipo, rawMessage: message, nomeContato, messageId };
  } catch (err) {
    logger.error({ err }, '[META WEBHOOK] Erro ao parsear payload');
    return null;
  }
}
