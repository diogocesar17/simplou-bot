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
            'troquei óleo 120',
            'revisão do carro 250'
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
    text: 'Essa função está em desenvolvimento e chegará em breve.\n\nSe precisar de ajuda, digite *ajuda* para ver o que está disponível.'
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

export async function ajudaCustosFixosCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Custos fixos e recorrentes',
      emojiTitulo: '🏠',
      secoes: [
        {
          titulo: 'O que são custos fixos',
          itens: [
            'São despesas que você paga todo mês (ou todo ano)',
            'Financiamento da moto ou carro — parcela mensal',
            'Seguro do veículo — pode ser mensal ou anual',
            'Aluguel, internet, plano de celular — mensais',
            'IPVA, licenciamento — anuais (divididos por 12 automaticamente)',
            'Eles são descontados do lucro real todos os dias que você trabalhar'
          ],
          emoji: '💡'
        },
        {
          titulo: 'Cadastrar por mensagem direta',
          itens: [
            'financiamento da moto 380 por mês',
            'seguro auto 1200 por ano',
            'aluguel 800 por mês',
            'meu celular custa 60 por mês',
            'ipva 900 por ano',
            'internet 100 por mês'
          ],
          emoji: '💬'
        },
        {
          titulo: 'Gerenciar via menu',
          itens: [
            'custos fixos — abrir lista completa',
            'Na lista você pode adicionar ou remover cada custo',
            'Custos anuais aparecem com o equivalente mensal'
          ],
          emoji: '📋'
        },
        {
          titulo: 'Como impacta o lucro real',
          itens: [
            'O total mensal é dividido pelos dias que você trabalhou',
            'Ex: R$ 380/mês de financiamento ÷ 22 dias = R$ 17,27/dia descontado',
            'Aparece como "custos fixos rateados" no resumo do dia',
            'Assim você vê quanto realmente sobrou — não só quanto faturou'
          ],
          emoji: '📊'
        }
      ],
      dicas: [
        { texto: 'Ver custos fixos', comando: 'custos fixos' },
        { texto: 'Lucro real do dia', comando: 'lucro hoje' }
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
