import { formatarMensagem } from '../utils/formatMessages';

async function ajudaCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Simplou — Assistente Financeiro',
      emojiTitulo: '🤖',
      secoes: [
        {
          titulo: 'O que eu faço',
          itens: [
            'Registro gastos e receitas por texto ou áudio',
            'Mostro resumos financeiros do mês com categorias',
            'Controlo parcelas e gastos recorrentes',
            'Gerencio faturas de cartão de crédito',
            'Envio lembretes de vencimentos',
            'Analiso seus padrões de gasto com IA (Premium)'
          ],
          emoji: '💡'
        },
        {
          titulo: 'Comandos essenciais',
          itens: [
            'gastei 50 no mercado — registrar gasto',
            'recebi 1000 salário — registrar receita',
            'resumo — resumo do mês atual',
            'historico — últimos lançamentos',
            'lembrete — criar lembrete de conta',
            'ajuda [tema] — ajuda específica por área'
          ],
          emoji: '🚀'
        },
        {
          titulo: 'Consultas e relatórios',
          itens: [
            'resumo hoje — resumo do dia',
            'resumo 03/2025 — resumo de mês específico',
            'historico gastos — só os gastos',
            'historico alimentação — por categoria',
            'fatura nubank 05/2025 — fatura do cartão',
            'parcelados — parcelas ativas',
            'relatorio — exportar CSV do mês'
          ],
          emoji: '📊'
        },
        {
          titulo: 'Análise com IA (Premium)',
          itens: [
            'analisar — padrões de gastos',
            'sugestoes — dicas personalizadas de economia',
            'previsao — previsão de gastos futuros',
            'ajuda inteligente — pergunte qualquer coisa sobre suas finanças'
          ],
          emoji: '🤖'
        }
      ],
      dicas: [
        { texto: 'Ajuda por área', comando: 'ajuda lancamentos · ajuda resumo · ajuda cartao · ajuda lembrete · ajuda premium' },
        { texto: 'Cancelar qualquer operação', comando: 'cancelar' }
      ],
      ajuda: 'Categorias automáticas: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação. Pagamentos: pix, crédito, débito, dinheiro, boleto'
    })
  });
}

export default ajudaCommand;