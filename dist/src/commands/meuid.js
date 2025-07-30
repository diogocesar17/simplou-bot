"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
async function meuidCommand(sock, userId) {
    await sock.sendMessage(userId, { text: `🆔 *Seu ID do WhatsApp:*\n\n📱 ${userId}\n\n(TODO: personalizar mensagem se necessário)` });
}
exports.default = meuidCommand;
//# sourceMappingURL=meuid.js.map