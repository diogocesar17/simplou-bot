import { formatarMensagem } from '../utils/formatMessages';

export async function ajudaLancamentosCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Como registrar lançamentos',
      emojiTitulo: '📝',
      secoes: [
        {
          titulo: 'Gastos simples',
          itens: [
            'gastei 50 no mercado',
            'gastei 80 farmácia no débito',
            'paguei 120 conta de luz no boleto',
            'gastei 30 almoço dia 15/05'
          ],
          emoji: '💸'
        },
        {
          titulo: 'Parcelado e recorrente',
          itens: [
            'gastei 1200 notebook em 12x no crédito',
            'gastei 100 academia todo mês',
            'gastei 50 Netflix por 12 meses'
          ],
          emoji: '📦'
        },
        {
          titulo: 'Receitas',
          itens: [
            'recebi 3000 salário',
            'recebi 500 freela pix',
            'entrada de 200 venda'
          ],
          emoji: '💰'
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
        { texto: 'Resumo do mês', comando: 'resumo' }
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
          titulo: 'Histórico detalhado',
          itens: [
            'historico — últimos 10 lançamentos',
            'historico gastos — só gastos',
            'historico receitas — só receitas',
            'historico alimentação — por categoria',
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
            'gastei 200 restaurante no crédito nubank',
            'gastei 600 passagem em 3x no crédito inter',
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
          titulo: 'Criar lembrete',
          itens: [
            'lembrete — iniciar assistente de lembrete',
            'Informe: título, valor, data de vencimento',
            'Escolha: aviso com 1, 3 ou 7 dias de antecedência',
            'Pode ser recorrente (mensal, semanal, anual)'
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
        },
        {
          titulo: 'Como funciona',
          itens: [
            'Você recebe um aviso automático antes do vencimento',
            'O lembrete se repete automaticamente se for recorrente',
            'Pode vincular a um valor para lançar automaticamente'
          ],
          emoji: '💡'
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
            'Registro ilimitado de gastos e receitas',
            'Resumos mensais com categorias',
            'Histórico e paginação',
            'Controle de parcelamentos e recorrências',
            'Cartões de crédito e faturas',
            'Até 5 lembretes ativos'
          ],
          emoji: '✅'
        },
        {
          titulo: 'Exclusivo do Premium',
          itens: [
            'Análise de padrões de gasto com IA (analisar)',
            'Sugestões personalizadas de economia (sugestoes)',
            'Previsão de gastos futuros (previsao)',
            'Assistente financeiro por perguntas (ajuda inteligente)',
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
