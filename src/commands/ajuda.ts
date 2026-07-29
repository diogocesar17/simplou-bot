import { formatarMensagem } from '../utils/formatMessages';

async function ajudaCommand(sock, userId) {
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Simplou Driver — Seu assistente no WhatsApp',
      emojiTitulo: '🚗',
      secoes: [
        {
          titulo: 'Registrar corridas e entregas',
          itens: [
            'ganhei 280 no uber — registra corrida Uber',
            'fiz 90 no ifood — registra entrega iFood',
            'recebi 150 na 99 — registra corrida 99',
            'fiz 200 de entrega particular — registra avulso'
          ],
          emoji: '💰'
        },
        {
          titulo: 'Registrar custos operacionais',
          itens: [
            'abasteci 180 de gasolina — combustível',
            'paguei 12 de pedágio — pedágio',
            'lava jato 40 — lavagem do carro',
            'troquei óleo 120 — manutenção',
            'multa de trânsito 130 — multa'
          ],
          emoji: '⛽'
        },
        {
          titulo: 'Custos fixos e recorrentes',
          itens: [
            'custos fixos — ver e gerenciar custos fixos',
            'financiamento da moto 380 por mês — cadastra parcela mensal',
            'seguro auto 1200 por ano — dividido por 12 automaticamente',
            'aluguel 800 por mês — qualquer despesa recorrente',
            'meu celular custa 60 por mês — plano de celular/internet',
            'ipva 900 por ano — descontado R$ 75/mês no lucro real',
            'Esses custos são descontados automaticamente do lucro real'
          ],
          emoji: '🏠'
        },
        {
          titulo: 'Acompanhar lucro e metas',
          itens: [
            'lucro hoje — balanço do dia (receitas − custos)',
            'resumo da semana — lucro da semana',
            'resumo do mês — lucro do mês',
            'meta diária 300 — define meta de ganhos',
            'quanto falta para a meta — progresso até a meta',
            'ver metas — todas as metas ativas'
          ],
          emoji: '🎯'
        },
        {
          titulo: 'Histórico e relatórios',
          itens: [
            'historico — últimos lançamentos',
            'historico uber — só corridas Uber',
            'historico ifood — só entregas iFood',
            'historico combustível — só abastecimentos',
            'quanto gastei em combustível — total de abastecimentos no mês',
            'quanto gastei em manutenção — total de manutenções no mês',
            'relatorio — exportar CSV do mês'
          ],
          emoji: '📊'
        },
        {
          titulo: 'Configurações driver',
          itens: [
            'sou motorista de app — configura perfil',
            'trabalho com delivery — configura perfil',
            'meu carro faz 10 km por litro — consumo médio',
            'perfil driver — ver perfil configurado',
            'desfazer — apaga o último lançamento registrado',
            'orcamento — definir limite de gasto por categoria'
          ],
          emoji: '⚙️'
        },
        {
          titulo: 'Análise com IA (Premium)',
          itens: [
            'analisar — padrões de ganhos e custos',
            'sugestoes — dicas para aumentar rentabilidade',
            'previsao — previsão de ganhos futuros',
            'ajuda inteligente — pergunte qualquer coisa sobre suas finanças'
          ],
          emoji: '🤖'
        }
      ],
      dicas: [
        { texto: 'Ajuda por área', comando: 'ajuda lancamentos · ajuda resumo · ajuda custos fixos · ajuda lembrete · ajuda premium · ajuda driver' },
        { texto: 'Cancelar qualquer operação', comando: 'cancelar' },
        { texto: 'Desfazer último lançamento', comando: 'desfazer' },
        { texto: 'Suporte', comando: 'contato@simplou.com' }
      ],
      ajuda: 'Plataformas: Uber, 99, iFood, Rappi, Loggi. Custos: Combustível, Pedágio, Manutenção, Lavagem, IPVA, Multa. Custos fixos: Financiamento, Seguro, Aluguel, Celular. Pagamentos: pix, débito, dinheiro'
    })
  });
}

export default ajudaCommand;