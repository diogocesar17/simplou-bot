// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function resumoCommand(sock, userId, texto) {
  let mesAno = texto.toLowerCase().replace('resumo', '').trim();
  let resumo;

  // Resumo do dia
  if (["hoje", "dia", "diario", "diário", "do dia", "do dia atual", "do dia de hoje", "de hoje"].includes(mesAno)) {
    resumo = await lancamentosService.getResumoDoDia(userId);
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: `Resumo de hoje (${hoje})`,
        emojiTitulo: '📊',
        secoes: [
          {
            titulo: 'Resumo Financeiro',
            itens: [
              `Receitas: R$ ${formatarValor(resumo.totalReceitas)}`,
              `Despesas: R$ ${formatarValor(resumo.totalDespesas)}`,
              `Saldo: R$ ${formatarValor(resumo.saldo)}`,
              `Lançamentos: ${resumo.totalLancamentos}`
            ],
            emoji: '💰'
          }
        ],
        dicas: [
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver histórico detalhado', comando: 'historico' }
        ]
      })
    });
    return;
  }

  // Resumo do mês atual
  if (!mesAno || ["do mes atual", "do mês atual", "mes atual", "mês atual", "atual", "deste mes", "deste mês", "deste mes atual", "deste mês atual"].includes(mesAno)) {
    resumo = await lancamentosService.getResumoDoMesAtual(userId);
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Resumo do mês atual',
        emojiTitulo: '📊',
        secoes: [
          {
            titulo: 'Resumo Financeiro',
            itens: [
              `Receitas: R$ ${formatarValor(resumo.totalReceitas)}`,
              `Despesas: R$ ${formatarValor(resumo.totalDespesas)}`,
              `Saldo: R$ ${formatarValor(resumo.saldo)}`,
              `Lançamentos: ${resumo.totalLancamentos}`
            ],
            emoji: '💰'
          }
        ],
        dicas: [
          { texto: 'Ver resumo de hoje', comando: 'resumo hoje' },
          { texto: 'Ver histórico detalhado', comando: 'historico' },
          { texto: 'Ver resumo de outro mês', comando: 'resumo 03/2024' }
        ]
      })
    });
    return;
  }

  // Resumo de mês/ano específico
  const parsed = parseMesAno(mesAno);
  if (!parsed) {
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.FORMATO_INVALIDO('Formato de data', 'resumo 03/2024', 'resumo hoje, resumo, resumo 12/2024')
    });
    return;
  }
  resumo = await lancamentosService.getResumoPorMes(userId, parsed.mes, parsed.ano);
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: `Resumo de ${getNomeMes(parsed.mes - 1)}/${parsed.ano}`,
      emojiTitulo: '📊',
      secoes: [
        {
          titulo: 'Resumo Financeiro',
          itens: [
            `Receitas: R$ ${formatarValor(resumo.totalReceitas)}`,
            `Despesas: R$ ${formatarValor(resumo.totalDespesas)}`,
            `Saldo: R$ ${formatarValor(resumo.saldo)}`,
            `Lançamentos: ${resumo.totalLancamentos}`
          ],
          emoji: '💰'
        }
      ],
      dicas: [
        { texto: 'Ver resumo do mês atual', comando: 'resumo' },
        { texto: 'Ver resumo de hoje', comando: 'resumo hoje' },
        { texto: 'Ver histórico detalhado', comando: 'historico' }
      ]
    })
  });
}

export default resumoCommand; 