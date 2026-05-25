import { IWhatsAppAdapter, WhatsAppMessageContent, WhatsAppInteractiveMessage } from './IWhatsAppAdapter';

// Variáveis de ambiente necessárias para ativar este adapter:
// META_WHATSAPP_TOKEN      — token permanente do sistema gerado no Meta Business
// META_PHONE_NUMBER_ID     — ID do número de telefone no WhatsApp Business Platform
// META_API_VERSION         — versão da API (ex: v19.0)

const BASE_URL = () =>
  `https://graph.facebook.com/${process.env.META_API_VERSION || 'v19.0'}/${process.env.META_PHONE_NUMBER_ID}/messages`;

export class MetaCloudAdapter implements IWhatsAppAdapter {
  private token: string;

  constructor() {
    this.token = process.env.META_WHATSAPP_TOKEN || '';
    if (!this.token) throw new Error('META_WHATSAPP_TOKEN não configurado');
  }

  // Normaliza JID do Baileys (5511999@s.whatsapp.net) para número puro (5511999)
  private normalizePhone(to: string): string {
    return to.replace(/@.*$/, '').replace(/\D/g, '');
  }

  async sendMessage(to: string, content: WhatsAppMessageContent): Promise<void> {
    const phone = this.normalizePhone(to);

    let body: any;

    if (content.text) {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: false, body: content.text },
      };
    } else if (content.document && content.mimetype) {
      // TODO: fazer upload do documento via Media API antes de enviar
      // https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
      throw new Error('MetaCloudAdapter: envio de documento ainda não implementado — aguardando migração completa');
    } else {
      throw new Error('MetaCloudAdapter: tipo de conteúdo não suportado');
    }

    const response = await fetch(BASE_URL(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Meta API erro ${response.status}: ${err}`);
    }
  }

  async sendInteractiveMessage(to: string, interactive: WhatsAppInteractiveMessage): Promise<void> {
    const phone = this.normalizePhone(to);

    let interactivePayload: any;

    if (interactive.type === 'button') {
      interactivePayload = {
        type: 'button',
        ...(interactive.header ? { header: { type: 'text', text: interactive.header } } : {}),
        body: { text: interactive.body },
        ...(interactive.footer ? { footer: { text: interactive.footer } } : {}),
        action: {
          buttons: interactive.buttons.map((btn) => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title },
          })),
        },
      };
    } else {
      interactivePayload = {
        type: 'list',
        ...(interactive.header ? { header: { type: 'text', text: interactive.header } } : {}),
        body: { text: interactive.body },
        ...(interactive.footer ? { footer: { text: interactive.footer } } : {}),
        action: {
          button: interactive.buttonLabel,
          sections: interactive.sections.map((sec) => ({
            ...(sec.title ? { title: sec.title } : {}),
            rows: sec.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description ? { description: row.description } : {}),
            })),
          })),
        },
      };
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'interactive',
      interactive: interactivePayload,
    };

    const response = await fetch(BASE_URL(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Meta API erro ${response.status}: ${err}`);
    }
  }

  async downloadAudio(message: any): Promise<{ buffer: Buffer; mimeType: string }> {
    // Na Meta API, message.id é o media_id
    // 1. GET /{media_id} → obtém a URL temporária
    // 2. GET {url} com Authorization → baixa o buffer
    return this._downloadMedia(message?.id, message?.mime_type || 'audio/ogg');
  }

  async downloadImage(message: any): Promise<{ buffer: Buffer; mimeType: string }> {
    return this._downloadMedia(message?.id, message?.mime_type || 'image/jpeg');
  }

  async downloadDocument(message: any): Promise<{ buffer: Buffer; mimeType: string }> {
    return this._downloadMedia(message?.id, message?.mime_type || 'application/pdf');
  }

  private async _downloadMedia(mediaId: string, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!mediaId) throw new Error('MetaCloudAdapter: mediaId ausente');

    // Passo 1: obter URL do media
    const metaRes = await fetch(
      `https://graph.facebook.com/${process.env.META_API_VERSION || 'v19.0'}/${mediaId}`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    if (!metaRes.ok) throw new Error(`Meta Media API erro ${metaRes.status}`);
    const { url } = await metaRes.json() as { url: string };

    // Passo 2: baixar o arquivo
    const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!fileRes.ok) throw new Error(`Meta Media download erro ${fileRes.status}`);
    const arrayBuffer = await fileRes.arrayBuffer();

    return { buffer: Buffer.from(arrayBuffer), mimeType };
  }
}
