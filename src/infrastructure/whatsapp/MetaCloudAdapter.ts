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

  // Lança erro estruturado com metaCode para facilitar diagnóstico de falhas proativas
  private async _throwMetaError(response: Response): Promise<never> {
    const errText = await response.text();
    let metaCode: number | undefined;
    let errMsg = errText;
    try {
      const errJson = JSON.parse(errText);
      metaCode = errJson?.error?.code;
      errMsg = errJson?.error?.message ?? errText;
    } catch { /* resposta não é JSON */ }
    const err = new Error(`Meta API erro ${response.status}: ${errMsg}`);
    (err as any).metaCode = metaCode;
    throw err;
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
      const mediaId = await this._uploadMedia(content.document, content.mimetype);
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'document',
        document: {
          id: mediaId,
          ...(content.fileName ? { filename: content.fileName } : {}),
          ...(content.caption ? { caption: content.caption } : {}),
        },
      };
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

    if (!response.ok) await this._throwMetaError(response);
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

    if (!response.ok) await this._throwMetaError(response);
  }

  async markAsRead(to: string, messageId: string): Promise<void> {
    const phone = this.normalizePhone(to);
    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };
    await fetch(BASE_URL(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async sendTypingIndicator(to: string): Promise<void> {
    const phone = this.normalizePhone(to);
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'typing_indicator',
      typing_indicator: { type: 'text' },
    };
    const response = await fetch(BASE_URL(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) await this._throwMetaError(response);
  }

  async sendTypingIndicatorDebug(to: string): Promise<string> {
    const phone = this.normalizePhone(to);
    const url = BASE_URL();
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'typing_indicator',
      typing_indicator: { type: 'text' },
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const resBody = await response.text();
    const icon = response.ok ? '✅' : '❌';
    return `${icon} HTTP ${response.status}\n🔗 ${url}\n\n📦 *Payload:*\n${JSON.stringify(payload, null, 2)}\n\n📄 *Resposta:*\n${resBody}`;
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

  private async _uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
    const uploadUrl = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v19.0'}/${process.env.META_PHONE_NUMBER_ID}/media`;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', new Blob([buffer], { type: mimeType }), 'file');

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta Media upload erro ${res.status}: ${err}`);
    }
    const { id } = await res.json() as { id: string };
    return id;
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
