export interface IWhatsAppAdapter {
  // Envio de mensagens (usado por todos os commands)
  sendMessage(to: string, content: WhatsAppMessageContent): Promise<void>;

  // Download de mídia (usado em src/app.ts para áudio, imagem, PDF)
  downloadAudio(message: any): Promise<{ buffer: Buffer; mimeType: string }>;
  downloadImage(message: any): Promise<{ buffer: Buffer; mimeType: string }>;
  downloadDocument(message: any): Promise<{ buffer: Buffer; mimeType: string }>;
}

export interface WhatsAppMessageContent {
  text?: string;
  document?: Buffer;
  mimetype?: string;
  fileName?: string;
  caption?: string;
}
