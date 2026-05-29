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
            'custos fixos — ver/cadastrar custos mensais fixos',
            'perfil driver — ver perfil configurado'
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
        { texto: 'Ajuda por área', comando: 'ajuda lancamentos · ajuda resumo · ajuda lembrete · ajuda premium' },
        { texto: 'Cancelar qualquer operação', comando: 'cancelar' },
        { texto: 'Suporte', comando: 'contato@simplou.com' }
      ],
      ajuda: 'Plataformas: Uber, 99, iFood, Rappi, Loggi. Custos: Combustível, Pedágio, Manutenção, Lavagem, IPVA, Multa. Pagamentos: pix, crédito, débito, dinheiro'
    })
  });
}

export default ajudaCommand;