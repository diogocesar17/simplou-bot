import { formatarValor, formatarComMoeda } from '../utils/formatUtils';
import * as driverService from '../services/driverService';
import { logger } from '../infrastructure/logger';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dataHoje(): string {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function barraProgresso(atual: number, meta: number): string {
  const pct = Math.min(Math.round((atual / meta) * 10), 10);
  const preenchido = '▓'.repeat(pct);
  const vazio = '░'.repeat(10 - pct);
  return `${preenchido}${vazio}`;
}

function formatarMeta(resumo: driverService.DriverResumo, referencia: string): string {
  if (!resumo.meta) return '';
  const valor = resumo.meta.valor;
  const lucro = resumo.lucroReal;
  const pct = valor > 0 ? Math.round((lucro / valor) * 100) : 0;
  const falta = valor - lucro;
  const barra = barraProgresso(Math.max(lucro, 0), valor);

  if (lucro >= valor) {
    return `\n🎯 Meta ${referencia}: *ATINGIDA!* ${formatarComMoeda(valor)}\n${barra} ${pct}%\n`;
  }
  if (falta > 0) {
    return `\n🎯 Meta ${referencia}: ${formatarComMoeda(valor)}\n${barra} ${pct}%\nFalta: ${formatarComMoeda(falta)}\n`;
  }
  return '';
}

const EXEMPLOS_DRIVER = '"ganhei 200 no uber" ou "abasteci 100"';
const EXEMPLOS_GENERICO = '"recebi 200 de um cliente" ou "gastei 100 com material"';

function montarMensagem(
  titulo: string,
  resumo: driverService.DriverResumo,
  tipoMeta: string,
  ehDriver: boolean,
): string {
  const { receitas, despesas, lucro, lucroReal, custosFixosRateados, porPlataforma, porCategoriaDespesa, totalLancamentos } = resumo;

  const emojiLucro = lucroReal >= 0 ? '🟢' : '🔴';
  const emojiTitulo = ehDriver ? '🚗' : '📊';

  let msg = `${emojiTitulo} *${titulo}*\n\n`;
  msg += `💰 Receitas: ${formatarComMoeda(receitas)}\n`;
  msg += `💸 Custos registrados: ${formatarComMoeda(despesas)}\n`;
  if (custosFixosRateados > 0) {
    msg += `🏠 Custos fixos (rateio): ${formatarComMoeda(custosFixosRateados)}\n`;
  }
  msg += `${emojiLucro} *Lucro real: ${formatarComMoeda(lucroReal)}*\n`;

  msg += formatarMeta(resumo, tipoMeta);

  if (porPlataforma.length > 0) {
    msg += `\n${ehDriver ? '📊 *Por plataforma:*' : '💰 *Receitas por origem:*'}\n`;
    for (const p of porPlataforma) {
      msg += `• ${p.plataforma}: ${formatarComMoeda(p.total)}\n`;
    }
  }

  if (porCategoriaDespesa.length > 0) {
    msg += '\n🔧 *Custos por tipo:*\n';
    for (const c of porCategoriaDespesa.slice(0, 5)) {
      msg += `• ${c.categoria}: ${formatarComMoeda(c.total)}\n`;
    }
  }

  if (totalLancamentos === 0) {
    msg += '\n📭 Nenhum lançamento encontrado neste período.\n';
    msg += `Registre: ${ehDriver ? EXEMPLOS_DRIVER : EXEMPLOS_GENERICO}`;
  }

  return msg.trim();
}

async function enviarResumo(
  sock: any,
  userId: string,
  titulo: string,
  resumo: driverService.DriverResumo,
  tipoMeta: string,
): Promise<void> {
  const perfil = await driverService.getDriverProfile(userId);
  const ehDriver = perfil !== null;
  const msg = montarMensagem(titulo, resumo, tipoMeta, ehDriver);
  await sock.sendMessage(userId, { text: msg });
}

export async function driverResumoDiaCommand(sock: any, userId: string): Promise<void> {
  try {
    const resumo = await driverService.getResumoDia(userId);
    await enviarResumo(sock, userId, `Resumo do dia — ${dataHoje()}`, resumo, 'diária');
  } catch (err) {
    logger.error({ err }, '[DRIVER_RESUMO] Erro no resumo do dia');
    await sock.sendMessage(userId, { text: '❌ Erro ao gerar resumo. Tente novamente.' });
  }
}

export async function driverResumoSemanaCommand(sock: any, userId: string): Promise<void> {
  try {
    const resumo = await driverService.getResumoSemana(userId);
    await enviarResumo(sock, userId, 'Resumo da semana', resumo, 'semanal');
  } catch (err) {
    logger.error({ err }, '[DRIVER_RESUMO] Erro no resumo da semana');
    await sock.sendMessage(userId, { text: '❌ Erro ao gerar resumo. Tente novamente.' });
  }
}

export async function driverResumoMesCommand(sock: any, userId: string): Promise<void> {
  try {
    const resumo = await driverService.getResumoMes(userId);
    const d = new Date();
    const nomeMes = d.toLocaleString('pt-BR', { month: 'long' });
    await enviarResumo(sock, userId, `Resumo de ${nomeMes}`, resumo, 'mensal');
  } catch (err) {
    logger.error({ err }, '[DRIVER_RESUMO] Erro no resumo do mês');
    await sock.sendMessage(userId, { text: '❌ Erro ao gerar resumo. Tente novamente.' });
  }
}

export async function driverResumoMesEspecificoCommand(sock: any, userId: string, mes: number, ano: number): Promise<void> {
  try {
    const resumo = await driverService.getResumoPorMesAno(userId, mes, ano);
    const nomeMes = new Date(ano, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' });
    const titulo = `Resumo de ${nomeMes}/${ano}`;
    await enviarResumo(sock, userId, titulo, resumo, 'mensal');
  } catch (err) {
    logger.error({ err }, '[DRIVER_RESUMO] Erro no resumo do mês específico');
    await sock.sendMessage(userId, { text: '❌ Erro ao gerar resumo. Tente novamente.' });
  }
}

// Roteador interno — decide qual período pelo texto da mensagem
export async function driverResumoCommand(sock: any, userId: string, texto: string): Promise<void> {
  const norm = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const ehSemana = /semana/.test(norm);
  const ehMes = /\bmes\b|\bmensal\b|\bdo mes\b/.test(norm);

  if (ehSemana) return driverResumoSemanaCommand(sock, userId);
  if (ehMes) return driverResumoMesCommand(sock, userId);
  return driverResumoDiaCommand(sock, userId);
}
