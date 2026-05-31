import { setMoeda, getMoeda, MOEDAS } from '../services/preferencesService';

async function moedaCommand(sock: any, userId: string, texto: string): Promise<void> {
  const partes = texto.trim().split(/\s+/);

  // Sem argumento — mostra moeda atual e opções
  if (partes.length === 1) {
    const atual = await getMoeda(userId);
    const opcoes = Object.values(MOEDAS)
      .map(m => `• *${m.codigo}* — ${m.nome} (${m.simbolo})`)
      .join('\n');
    await sock.sendMessage(userId, {
      text:
        `💱 *Moeda atual:* ${atual.nome} (${atual.simbolo})\n\n` +
        `Para alterar, envie:\n${opcoes}\n\n` +
        `_Exemplos: "moeda euro", "moeda real", "moeda usd"_`,
    });
    return;
  }

  const entrada = partes.slice(1).join(' ').toLowerCase().trim();

  // Mapeamento de palavras comuns para código
  const aliases: Record<string, string> = {
    real: 'BRL', reais: 'BRL', brl: 'BRL', brasil: 'BRL',
    euro: 'EUR', euros: 'EUR', eur: 'EUR',
    dolar: 'USD', dólar: 'USD', dolares: 'USD', dólares: 'USD', usd: 'USD',
    libra: 'GBP', libras: 'GBP', gbp: 'GBP',
  };

  const codigo = aliases[entrada] ?? entrada.toUpperCase();
  const moeda = await setMoeda(userId, codigo);

  if (!moeda) {
    const opcoes = Object.values(MOEDAS).map(m => m.codigo).join(', ');
    await sock.sendMessage(userId, {
      text: `❌ Moeda não reconhecida: "${entrada}"\n\nOpções disponíveis: ${opcoes}`,
    });
    return;
  }

  await sock.sendMessage(userId, {
    text: `✅ Moeda atualizada para *${moeda.nome}* (${moeda.simbolo})\n\nTodos os seus valores serão exibidos em ${moeda.simbolo}.`,
  });
}

export default moedaCommand;
