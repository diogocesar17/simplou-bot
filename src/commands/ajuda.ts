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
            'resumo detalhado - Análise completa com gráficos e categorias',
            'resumo detalhado [mês/ano] - Análise detalhada de período específico',
            'historico - Últimos lançamentos',
            'historico [mês/ano] - Lançamentos do mês (ex: historico julho 2025)',
            'fatura [cartão] [mês/ano] - Fatura de cartão (ex: fatura nubank 08/2025)'
          ],
          emoji: '📊'
        },
        {
          titulo: 'Consultas Avançadas',
          itens: [
            'parcelados - Lista todos os parcelamentos ativos',
            'recorrentes - Lista gastos fixos e recorrentes',
            'vencimentos - Próximos vencimentos de cartões',
            'vencimentos [dias] - Vencimentos nos próximos X dias',
            'valor alto - Gastos acima da média do mês',
            'categoria [nome] - Gastos por categoria específica',
            'alertas - Verificar alertas e lembretes'
          ],
          emoji: '🔍'
        },
        {
          titulo: 'Relatórios e Exportação',
          itens: [
            'relatorio - Exporta CSV com lançamentos do mês atual',
            'relatorio [mês/ano] - Exporta CSV de período específico (ex: relatorio 08/2024)'
          ],
          emoji: '📄'
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
          titulo: 'Lembretes e Alertas',
          itens: [
            'lembrete - Criar novo lembrete',
            'Criar lembrete - Criar novo lembrete (comando interativo)',
            'meuslembretes - Gerenciar lembretes existentes',
            'Meus Lembretes - Gerenciar lembretes (comando interativo)',
            'alertas - Verificar alertas e lembretes ativos'
          ],
          emoji: '⏰'
        },
        {
          titulo: 'Análises Inteligentes (IA)',
          itens: [
            'analisar - Análise de padrões de gastos com IA',
            'sugestoes - Dicas personalizadas de economia',
            'previsao - Previsão de gastos futuros',
            'ajuda inteligente - Assistente financeiro com IA'
          ],
          emoji: '🤖'
        },
        {
          titulo: 'Comandos Administrativos',
          itens: [
            'status - Status do sistema e estatísticas',
            'usuarios - Gerenciar usuários (admin)',
            'logs - Visualizar logs do sistema (admin)',
            'limpar - Limpeza de dados antigos (admin)'
          ],
          emoji: '⚙️'
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