import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import * as databaseService from '../infrastructure/databaseService';
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
              `${resumo.saldo >= 0 ? '🟢' : '🔴'} Saldo: R$ ${formatarValor(resumo.saldo)}`,
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
    const gastosCat = await databaseService.getGastosPorCategoria(userId, null, null);
    const secoes: any[] = [
      {
        titulo: 'Resumo Financeiro',
        itens: [
          `Receitas: R$ ${formatarValor(resumo.totalReceitas)}`,
          `Despesas: R$ ${formatarValor(resumo.totalDespesas)}`,
          `${resumo.saldo >= 0 ? '🟢' : '🔴'} Saldo: R$ ${formatarValor(resumo.saldo)}`,
          `Lançamentos: ${resumo.totalLancamentos}`
        ],
        emoji: '💰'
      }
    ];
    if (resumo.totalDespesas > 0 && gastosCat.categorias && gastosCat.categorias.length > 0) {
      const top3 = gastosCat.categorias.slice(0, 3);
      secoes.push({
        titulo: 'Top gastos',
        itens: top3.map((cat, idx) => {
          const pct = gastosCat.totalGeral > 0 ? Math.round((cat.total / gastosCat.totalGeral) * 100) : 0;
          return `${idx + 1}. ${cat.nome}: R$ ${formatarValor(cat.total)} (${pct}%)`;
        }),
        emoji: '🏆'
      });
    }
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Resumo do mês atual',
        emojiTitulo: '📊',
        secoes,
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
  const gastosCatEsp = await databaseService.getGastosPorCategoria(userId, (parsed.mes - 1) as any, parsed.ano as any);
  const secoesEsp: any[] = [
    {
      titulo: 'Resumo Financeiro',
      itens: [
        `Receitas: R$ ${formatarValor(resumo.totalReceitas)}`,
        `Despesas: R$ ${formatarValor(resumo.totalDespesas)}`,
        `${resumo.saldo >= 0 ? '🟢' : '🔴'} Saldo: R$ ${formatarValor(resumo.saldo)}`,
        `Lançamentos: ${resumo.totalLancamentos}`
      ],
      emoji: '💰'
    }
  ];
  if (resumo.totalDespesas > 0 && gastosCatEsp.categorias && gastosCatEsp.categorias.length > 0) {
    const top3Esp = gastosCatEsp.categorias.slice(0, 3);
    secoesEsp.push({
      titulo: 'Top gastos',
      itens: top3Esp.map((cat, idx) => {
        const pct = gastosCatEsp.totalGeral > 0 ? Math.round((cat.total / gastosCatEsp.totalGeral) * 100) : 0;
        return `${idx + 1}. ${cat.nome}: R$ ${formatarValor(cat.total)} (${pct}%)`;
      }),
      emoji: '🏆'
    });
  }
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: `Resumo de ${getNomeMes(parsed.mes - 1)}/${parsed.ano}`,
      emojiTitulo: '📊',
      secoes: secoesEsp,
      dicas: [
        { texto: 'Ver resumo do mês atual', comando: 'resumo' },
        { texto: 'Ver resumo de hoje', comando: 'resumo hoje' },
        { texto: 'Ver histórico detalhado', comando: 'historico' }
      ]
    })
  });
}

export default resumoCommand; 