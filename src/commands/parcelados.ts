import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { logger } from '../infrastructure/logger';

function formatarData(data: any): string {
  if (!data) return '';
  if (data instanceof Date) return data.toLocaleDateString('pt-BR');
  if (typeof data === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(data)) return new Date(data).toLocaleDateString('pt-BR');
    return data;
  }
  return String(data);
}

async function parceladosCommand(sock, userId, texto?) {
  const estado = await obterEstado(userId);
  const textoLimpo = String(texto || '').trim();
  const textoLower = textoLimpo.toLowerCase();

  // Aguardando seleção de parcelamento da lista
  if (estado?.etapa === 'aguardando_selecao_parcelado') {
    const parcelados = (estado.dadosParciais as any).parcelados as any[];

    if (textoLimpo === '0' || textoLower === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Operação cancelada.' });
      return;
    }

    const idx = parseInt(textoLimpo) - 1;
    if (isNaN(idx) || idx < 0 || idx >= parcelados.length) {
      await sock.sendMessage(userId, {
        text: `❌ Número inválido. Digite de 1 a ${parcelados.length}.`
      });
      return;
    }

    const parcelamento = parcelados[idx];
    const proximaFutura = parcelamento.parcelas.find((p: any) => p.status === 'pendente') || null;

    await definirEstado(userId, 'aguardando_acao_parcelado', { parcelamento, idx, proximaFutura });

    const linhas = [
      `📝 ${parcelamento.descricao}`,
      `💰 Total: R$ ${formatarValor(parcelamento.valor_total)} · ${parcelamento.total_parcelas}x de R$ ${formatarValor(parcelamento.valor_parcela)}`,
      `📅 ${formatarData(parcelamento.primeira_parcela)} a ${formatarData(parcelamento.ultima_parcela)}`,
      `📂 ${parcelamento.categoria} | 💳 ${parcelamento.pagamento}`,
      proximaFutura
        ? `\n⏭️ Próxima parcela: ${formatarData(proximaFutura.data)}`
        : '\n✅ Todas as parcelas já passaram'
    ];

    const botoes: any[] = [];
    if (proximaFutura) botoes.push({ id: '1', title: '✏️ Editar' });
    botoes.push({ id: '2', title: '🗑️ Excluir' });

    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '📦 Parcelamento',
      body: linhas.join('\n'),
      buttons: botoes,
    });
    return;
  }

  // Aguardando ação sobre parcelamento selecionado
  if (estado?.etapa === 'aguardando_acao_parcelado') {
    const { parcelamento, proximaFutura } = estado.dadosParciais as any;
    const acao = textoLimpo;

    if (acao === '0' || textoLower === 'cancelar' || textoLower === 'voltar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Operação cancelada.' });
      return;
    }

    if (acao === '1') { // Editar
      if (!proximaFutura) {
        await limparEstado(userId);
        await sock.sendMessage(userId, { text: '❌ Não há parcelas futuras para editar.' });
        return;
      }
      const lancamento = {
        id: proximaFutura.id,
        descricao: parcelamento.descricao,
        valor: parcelamento.valor_parcela,
        categoria: parcelamento.categoria,
        pagamento: parcelamento.pagamento,
        data: proximaFutura.data,
        parcelamento_id: parcelamento.parcelamento_id,
        parcela_atual: proximaFutura.parcela_atual,
        total_parcelas: parcelamento.total_parcelas
      };
      await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
        lancamentoId: lancamento.id,
        lancamento,
        campo: null
      });
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '📝 Editar Parcelamento',
        body:
          `📅 ${formatarData(lancamento.data)}  💰 R$ ${formatarValor(lancamento.valor)}\n` +
          `📂 ${lancamento.categoria}  💳 ${lancamento.pagamento}\n` +
          `📝 ${lancamento.descricao}\n\nQual campo deseja editar?`,
        buttonLabel: 'Ver campos',
        sections: [{
          rows: [
            { id: '1', title: '💰 Valor' },
            { id: '2', title: '📂 Categoria' },
            { id: '3', title: '📝 Descrição' },
            { id: '4', title: '💳 Forma de pagamento' },
            { id: '5', title: '📅 Data' },
            { id: '0', title: '❌ Cancelar' },
          ],
        }],
      });
      return;
    }

    if (acao === '2') { // Excluir
      const parcelaRef = proximaFutura ?? parcelamento.parcelas[parcelamento.parcelas.length - 1];
      const lancamento = {
        id: parcelaRef.id,
        descricao: parcelamento.descricao,
        valor: parcelamento.valor_parcela,
        categoria: parcelamento.categoria,
        data: parcelaRef.data,
        parcelamento_id: parcelamento.parcelamento_id,
        parcela_atual: parcelaRef.parcela_atual,
        total_parcelas: parcelamento.total_parcelas
      };
      await definirEstado(userId, 'aguardando_escolha_exclusao_parcelado', { lancamento });
      await sock.sendInteractiveMessage(userId, {
        type: 'button',
        header: '🧩 Excluir parcelamento',
        body: `📝 ${lancamento.descricao}\n\nO que deseja excluir?`,
        footer: '⚠️ Esta ação não pode ser desfeita!',
        buttons: [
          { id: '1', title: 'Só esta parcela' },
          { id: '2', title: 'Esta e futuras' },
          { id: '3', title: 'Todas as parcelas' },
        ],
      });
      return;
    }

    await sock.sendMessage(userId, { text: '❌ Opção inválida.' });
    return;
  }

  // Listagem principal
  try {
    const parcelados = await lancamentosService.buscarParceladosAtivos(userId);

    if (!parcelados || parcelados.length === 0) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Nenhum parcelamento ativo encontrado',
          emojiTitulo: '📦',
          dicas: [
            { texto: 'Ver histórico de lançamentos', comando: 'historico' },
            { texto: 'Ver resumo do mês', comando: 'resumo' }
          ]
        })
      });
      return;
    }

    const visiveis = parcelados.slice(0, 9);
    const extras = parcelados.length - visiveis.length;
    const bodyTexto = extras > 0
      ? `${parcelados.length} parcelamentos encontrados. Mostrando os primeiros 9.`
      : `${parcelados.length} parcelamento(s) encontrado(s). Toque para ver detalhes.`;

    await sock.sendInteractiveMessage(userId, {
      type: 'list',
      header: '📦 Parcelamentos Ativos',
      body: bodyTexto,
      buttonLabel: 'Ver parcelamentos',
      sections: [{
        rows: [
          ...visiveis.map((p: any, i: number) => ({
            id: String(i + 1),
            title: p.descricao.slice(0, 24),
            description: `${p.total_parcelas}x · R$ ${formatarValor(p.valor_parcela)}/parcela`
          })),
          { id: '0', title: '↩️ Cancelar' }
        ]
      }]
    });

    await definirEstado(userId, 'aguardando_selecao_parcelado', { parcelados });

  } catch (error) {
    logger.error({ err: (error as any)?.message || error }, '[PARCELADOS] Erro ao listar');
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Erro ao carregar parcelamentos',
        emojiTitulo: '❌',
        dicas: [
          { texto: 'Tentar novamente', comando: 'parcelados' },
          { texto: 'Ver histórico', comando: 'historico' }
        ]
      })
    });
  }
}

export default parceladosCommand;
