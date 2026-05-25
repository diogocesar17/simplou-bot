export interface IWhatsAppAdapter {
  sendMessage(to: string, content: WhatsAppMessageContent): Promise<void>;
  sendInteractiveMessage(to: string, interactive: WhatsAppInteractiveMessage): Promise<void>;
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

// Mensagem de botões (até 3 botões)
export interface WhatsAppButtonMessage {
  type: 'button';
  body: string;
  buttons: Array<{ id: string; title: string }>;
  header?: string;
  footer?: string;
}

// Mensagem de lista (até 10 itens)
export interface WhatsAppListMessage {
  type: 'list';
  body: string;
  buttonLabel: string;
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  header?: string;
  footer?: string;
}

export type WhatsAppInteractiveMessage = WhatsAppButtonMessage | WhatsAppListMessage;
