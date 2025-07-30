// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';

async function resumoCommand(sock, userId, texto) {
  let mesAno = texto.toLowerCase().replace('resumo', '').trim();
  let resumo;

  // Resumo do dia
  if (["hoje", "dia", "diario", "diário", "do dia", "do dia atual", "do dia de hoje", "de hoje"].includes(mesAno)) {
    resumo = await lancamentosService.getResumoDoDia(userId);
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sock.sendMessage(userId, {
      text: `📊 *Resumo de hoje (${hoje})*\nReceitas: R$ ${formatarValor(resumo.totalReceitas)}\nDespesas: R$ ${formatarValor(resumo.totalDespesas)}\nSaldo: R$ ${formatarValor(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
    });
    return;
  }

  // Resumo do mês atual
  if (!mesAno || ["do mes atual", "do mês atual", "mes atual", "mês atual", "atual", "deste mes", "deste mês", "deste mes atual", "deste mês atual"].includes(mesAno)) {
    resumo = await lancamentosService.getResumoDoMesAtual(userId);
    await sock.sendMessage(userId, {
      text: `📊 *Resumo do mês atual*\nReceitas: R$ ${formatarValor(resumo.totalReceitas)}\nDespesas: R$ ${formatarValor(resumo.totalDespesas)}\nSaldo: R$ ${formatarValor(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
    });
    return;
  }

  // Resumo de mês/ano específico
  const parsed = parseMesAno(mesAno);
  if (!parsed) {
    await sock.sendMessage(userId, {
      text: '❌ Formato inválido. Use:\n• resumo (mês atual)\n• resumo hoje (dia atual)\n• resumo 03/2024 (mês específico)\n\n💡 *Variações aceitas:*\n• resumo do mes atual\n• resumo do dia\n• resumo atual\n• resumo hoje'
    });
    return;
  }
  resumo = await lancamentosService.getResumoPorMes(userId, parsed.mes, parsed.ano);
  await sock.sendMessage(userId, {
    text: `📊 *Resumo de ${getNomeMes(parsed.mes - 1)}/${parsed.ano}*\nReceitas: R$ ${formatarValor(resumo.totalReceitas)}\nDespesas: R$ ${formatarValor(resumo.totalDespesas)}\nSaldo: R$ ${formatarValor(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
  });
}

export default resumoCommand; 