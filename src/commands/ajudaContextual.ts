import { formatarMensagem } from '../utils/formatMessages';

export async function ajudaLancamentosCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Como registrar lançamentos',
      emojiTitulo: '📝',
      secoes: [
        {
          titulo: 'Corridas e entregas',
          itens: [
            'ganhei 280 no uber',
            'fiz 90 no ifood',
            'recebi 150 na 99 pix',
            'fiz 200 de entrega particular dia 10/06'
          ],
          emoji: '💰'
        },
        {
          titulo: 'Custos operacionais',
          itens: [
            'abasteci 180 de gasolina no débito',
            'paguei 12 de pedágio',
            'lava jato 40',
            'troquei óleo 120 no crédito',
            'troquei pneu 400 em 2x no crédito'
          ],
          emoji: '⛽'
        },
        {
          titulo: 'Após registrar',
          itens: [
            'editar [número] — editar um lançamento da lista',
            'excluir [número] — excluir um lançamento da lista',
            'historico — ver lançamentos recentes'
          ],
          emoji: '🔧'
        }
      ],
      dicas: [
        { texto: 'Ver lançamentos', comando: 'historico' },
        { texto: 'Lucro do dia', comando: 'lucro hoje' }
      ]
    })
  });
}

export async function ajudaResumoCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Como usar os resumos',
      emojiTitulo: '📊',
      secoes: [
        {
          titulo: 'Resumos disponíveis',
          itens: [
            'resumo — mês atual com comparação vs mês anterior',
            'resumo hoje — só os lançamentos de hoje',
            'resumo 03/2025 — mês e ano específico',
            'resumo detalhado — análise completa com IA'
          ],
          emoji: '📅'
        },
        {
          titulo: 'O que aparece no resumo',
          itens: [
            '🟢/🔴 Saldo do mês (positivo ou negativo)',
            '📈/📉 Comparação com o mês anterior',
            '⚠️/✅ Ritmo de gastos — se está acima do esperado',
            '🏆 Top 3 categorias onde mais gastou'
          ],
          emoji: '💡'
        },
        {
          titulo: 'Histórico por plataforma e custo',
          itens: [
            'historico — últimos 10 lançamentos',
            'historico uber — só corridas Uber',
            'historico ifood — só entregas iFood',
            'historico combustível — só abastecimentos',
            'historico manutenção — revisões e reparos',
            'historico 05/2025 — mês específico',
            'mais — ver os próximos 10'
          ],
          emoji: '📋'
        }
      ],
      dicas: [
        { texto: 'Ver resumo do mês', comando: 'resumo' },
        { texto: 'Ver histórico', comando: 'historico' }
      ]
    })
  });
}

export async function ajudaCartaoCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Como usar cartões de crédito',
      emojiTitulo: '💳',
      secoes: [
        {
          titulo: 'Configurar cartão',
          itens: [
            'configurar cartao — cadastrar novo cartão',
            'Informe: nome do cartão e dia de vencimento',
            'cartoes — listar cartões configurados',
            'editar cartao — alterar vencimento',
            'excluir cartao — remover cartão'
          ],
          emoji: '⚙️'
        },
        {
          titulo: 'Registrar gasto no cartão',
          itens: [
            'abasteci 200 no crédito nubank',
            'troquei óleo 150 no crédito inter',
            'troquei pneu 600 em 3x no crédito nubank',
            'O gasto é lançado automaticamente na fatura correta'
          ],
          emoji: '💸'
        },
        {
          titulo: 'Ver faturas',
          itens: [
            'fatura nubank — fatura atual do cartão',
            'fatura nubank 06/2025 — fatura de mês específico',
            'vencimentos — próximos vencimentos de todos os cartões'
          ],
          emoji: '📄'
        }
      ],
      dicas: [
        { texto: 'Configurar cartão', comando: 'configurar cartao' },
        { texto: 'Ver cartões', comando: 'cartoes' }
      ]
    })
  });
}

export async function ajudaLembreteCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Como usar lembretes',
      emojiTitulo: '⏰',
      secoes: [
        {
          titulo: 'Exemplos para motoristas',
          itens: [
            'Troca de óleo — a cada 5.000 km ou 3 meses',
            'Vencimento do IPVA — aviso com 7 dias de antecedência',
            'Renovação da CNH — aviso com 30 dias antes',
            'Revisão do veículo — manutenção preventiva semestral',
            'Vencimento do seguro auto — renovação anual'
          ],
          emoji: '🚗'
        },
        {
          titulo: 'Criar lembrete',
          itens: [
            'lembrete — iniciar o assistente',
            'Informe: título, valor (opcional), data de vencimento',
            'Escolha: aviso com 1, 3 ou 7 dias de antecedência',
            'Pode ser recorrente (mensal, anual)'
          ],
          emoji: '➕'
        },
        {
          titulo: 'Gerenciar lembretes',
          itens: [
            'meus lembretes — ver e gerenciar todos',
            'alertas — verificar alertas ativos hoje',
            'Você pode editar, pausar ou excluir pela lista'
          ],
          emoji: '📋'
        }
      ],
      dicas: [
        { texto: 'Criar lembrete', comando: 'lembrete' },
        { texto: 'Ver lembretes', comando: 'meus lembretes' }
      ]
    })
  });
}

export async function ajudaPremiumCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Simplou Premium',
      emojiTitulo: '⭐',
      secoes: [
        {
          titulo: 'O que está incluído no gratuito',
          itens: [
            'Registro ilimitado de corridas, entregas e custos',
            'Resumo de lucro: dia, semana e mês',
            'Histórico por plataforma e tipo de custo',
            'Custos fixos mensais e anuais',
            'Metas de ganhos diária, semanal e mensal',
            'Até 5 lembretes ativos'
          ],
          emoji: '✅'
        },
        {
          titulo: 'Exclusivo do Premium',
          itens: [
            'Análise de padrões de ganhos e custos por plataforma (analisar)',
            'Dicas para aumentar rentabilidade e reduzir custos (sugestoes)',
            'Previsão de ganhos futuros (previsao)',
            'Assistente driver por perguntas livres (ajuda inteligente)',
            'Registro por áudio e comprovante (foto/PDF)',
            'Lembretes ilimitados'
          ],
          emoji: '⭐'
        }
      ],
      dicas: [
        { texto: 'Ver planos e assinar', comando: 'assinar' }
      ]
    })
  });
}
