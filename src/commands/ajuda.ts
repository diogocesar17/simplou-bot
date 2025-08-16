import { formatarMensagem } from '../utils/formatMessages';

async function ajudaCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'SIMPLOU - SEU ASSISTENTE FINANCEIRO',
      emojiTitulo: '🤖',
      secoes: [
        {
          titulo: 'Consultas e Resumos',
          itens: [
            'resumo - Resumo do mês atual',
            'resumo hoje - Resumo do dia atual',
            'resumo [mês/ano] - Resumo específico (ex: resumo 03/2024)',
            'historico - Últimos lançamentos',
            'historico [mês/ano] - Lançamentos do mês (ex: historico julho 2025)',
            'fatura [cartão] [mês/ano] - Fatura de cartão (ex: fatura nubank 08/2025)'
          ],
          emoji: '📊'
        },
        {
          titulo: 'Gestão de Cartões',
          itens: [
            'configurar cartao - Cadastrar cartão de crédito',
            'editar cartao - Editar vencimento/fechamento',
            'excluir cartao - Excluir cartão configurado',
            'cartoes - Listar cartões configurados'
          ],
          emoji: '💳'
        },
        {
          titulo: 'Gestão de Lançamentos',
          itens: [
            'editar [número] - Editar lançamento específico',
            'excluir [número] - Excluir lançamento específico',
            'cancelar - Cancela operação em andamento'
          ],
          emoji: '📝'
        },
        {
          titulo: 'Exemplos de Lançamentos',
          itens: [
            'Gasto simples: gastei 50 no mercado no crédito',
            'Receita: recebi 1000 salário',
            'Parcelado: gastei 1200 no notebook em 12x no crédito',
            'Fixo/mensal: gastei 100 aluguel todo mês',
            'Recorrente: gastei 50 Netflix por 6 meses',
            'Com data: gastei 50 no mercado dia 15/08/2024'
          ],
          emoji: '🎯'
        }
      ],
      dicas: [
        { texto: 'Digite "ajuda" a qualquer momento para ver este menu' },
        { texto: 'Use "oi" ou "olá" para mensagem de boas-vindas' }
      ],
      ajuda: 'Categorias automáticas: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação. Formas de pagamento: PIX, CRÉDITO, DÉBITO, DINHEIRO, BOLETO'
    })
  });
}

export default ajudaCommand;