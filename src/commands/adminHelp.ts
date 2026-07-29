export async function adminHelpCommand(sock: any, adminId: string): Promise<void> {
  const texto =
    `🛡️ *Painel Admin — Comandos disponíveis*\n\n` +

    `*👥 Usuários*\n` +
    `• \`usuarios\` — lista todos os cadastrados\n` +
    `• \`remover usuario <numero>\` — remove um usuário\n` +
    `• \`promover <numero>\` — promove a administrador\n\n` +

    `*⏳ Beta / Acesso*\n` +
    `• \`codigo convite\` — exibe o código de convite configurado\n` +
    `• \`fila espera\` — lista usuários aguardando aprovação\n` +
    `• \`aprovar <numero>\` — aprova usuário da fila\n\n` +

    `*📊 Monitoração*\n` +
    `• \`gemini status\` — chamadas de IA: erros, latência, retries\n` +
    `• \`sentry test\` — verifica se o Sentry está recebendo eventos\n` +
    `• \`logs\` — últimos registros de auditoria\n\n` +

    `*🛠️ Sistema*\n` +
    `• \`status\` — status geral do sistema\n` +
    `• \`backup\` — gera backup CSV dos dados\n` +
    `• \`ia fallbacks\` — status dos fallbacks de IA\n\n` +

    `*📋 Dados (qualquer usuário)*\n` +
    `• \`exportar dados\` — exporta lançamentos em CSV\n` +
    `• \`perfil\` — ver dados da conta\n` +
    `• \`excluir minha conta\` — remove conta e dados`;

  await sock.sendMessage(adminId, { text: texto });
}
