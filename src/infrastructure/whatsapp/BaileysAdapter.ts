import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { IWhatsAppAdapter, WhatsAppMessageContent } from './IWhatsAppAdapter';

export class BaileysAdapter implements IWhatsAppAdapter {
  constructor(private sock: any) {}

  async sendMessage(to: string, content: WhatsAppMessageContent): Promise<void> {
    await this.sock.sendMessage(to, content);
  }

  async downloadAudio(message: any): Promise<{ buffer: Buffer; mimeType: string }> {
    const stream = await downloadContentFromMessage(message, 'audio');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return {
      buffer: Buffer.concat(chunks),
      mimeType: message?.mimetype || 'audio/ogg',
    };
  }

  async downloadImage(message: any): Promise<{ buffer: Buffer; mimeType: string }> {
    const stream = await downloadContentFromMessage(message, 'image');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return {
      buffer: Buffer.concat(chunks),
      mimeType: message?.mimetype || 'image/jpeg',
    };
  }

  async downloadDocument(message: any): Promise<{ buffer: Buffer; mimeType: string }> {
    const stream = await downloadContentFromMessage(message, 'document');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return {
      buffer: Buffer.concat(chunks),
      mimeType: message?.mimetype || 'application/pdf',
    };
  }
}
