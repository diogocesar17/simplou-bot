import { formatarValor, formatarComMoeda } from '../utils/formatUtils';
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

async function recorrentesCommand(sock, userId, texto?) {
  const estado = await obterEstado(userId);
  const textoLimpo = String(texto || '').trim();
  const textoLower = textoLimpo.toLowerCase();

  // Aguardando seleção de recorrente da lista
  if (estado?.etapa === 'aguardando_selecao_recorrente') {
    const recorrentes = (estado.dadosParciais as any).recorrentes as any[];

    if (textoLimpo === '0' || textoLower === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Operação cancelada.' });
      return;
    }

    const idx = parseInt(textoLimpo) - 1;
    if (isNaN(idx) || idx < 0 || idx >= recorrentes.length) {
      await sock.sendMessage(userId, {
        text: `❌ Número inválido. Digite de 1 a ${recorrentes.length}.`
      });
      return;
    }

    const recorrente = recorrentes[idx];
    const proximaPendente = recorrente.recorrencias.find((r: any) => r.status === 'pendente') || null;

    await definirEstado(userId, 'aguardando_acao_recorrente', { recorrente, idx, proximaPendente });

    const linhas = [
      `📝 ${recorrente.descricao}`,
      `💰 ${formatarComMoeda(recorrente.valor)}/mês · ${recorrente.total_recorrencias} meses registrados`,
      `📅 ${formatarData(recorrente.primeira_recorrencia)} a ${formatarData(recorrente.ultima_recorrencia)}`,
      `📂 ${recorrente.categoria} | 💳 ${recorrente.pagamento}`,
      ...(recorrente.recorrente_fim ? [`🛑 Fim previsto: ${formatarData(recorrente.recorrente_fim)}`] : []),
      proximaPendente
        ? `\n⏭️ Próxima: ${formatarData(proximaPendente.data)}`
        : '\n✅ Não há recorrências futuras no histórico'
    ];

    const botoes: any[] = [];
    if (proximaPendente) botoes.push({ id: '1', title: '✏️ Editar' });
    botoes.push({ id: '2', title: '🗑️ Excluir' });

    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🔄 Recorrente',
      body: linhas.join('\n'),
      buttons: botoes,
    });
    return;
  }

  // Aguardando ação sobre recorrente selecionado
  if (estado?.etapa === 'aguardando_acao_recorrente') {
    const { recorrente, proximaPendente } = estado.dadosParciais as any;
    const acao = textoLimpo;

    if (acao === '0' || textoLower === 'cancelar' || textoLower === 'voltar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Operação cancelada.' });
      return;
    }

    if (acao === '1') { // Editar
      if (!proximaPendente) {
        await limparEstado(userId);
        await sock.sendMessage(userId, { text: '❌ Não há recorrências futuras para editar.' });
        return;
      }
      const lancamento = {
        id: proximaPendente.id,
        descricao: recorrente.descricao,
        valor: recorrente.valor,
        categoria: recorrente.categoria,
        pagamento: recorrente.pagamento,
        data: proximaPendente.data,
        recorrente_id: recorrente.recorrente_id
      };
      await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
        lancamentoId: lancamento.id,
        lancamento,
        campo: null
      });
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '📝 Editar Recorrente',
        body:
          `📅 ${formatarData(lancamento.data)}  💰 ${formatarComMoeda(lancamento.valor)}\n` +
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
      if (!proximaPendente) {
        await limparEstado(userId);
        await sock.sendMessage(userId, { text: '❌ Não há recorrências futuras para excluir.' });
        return;
      }
      const lancamento = {
        id: proximaPendente.id,
        descricao: recorrente.descricao,
        valor: recorrente.valor,
        categoria: recorrente.categoria,
        data: proximaPendente.data,
        recorrente_id: recorrente.recorrente_id
      };
      await definirEstado(userId, 'aguardando_escolha_exclusao_recorrente', { lancamento });
      await sock.sendInteractiveMessage(userId, {
        type: 'button',
        header: '🔁 Excluir recorrente',
        body: `📝 ${lancamento.descricao}\n\nO que deseja excluir?`,
        footer: '⚠️ Esta ação não pode ser desfeita!',
        buttons: [
          { id: '1', title: 'Só esta recorrência' },
          { id: '2', title: 'Esta e futuras' },
          { id: '0', title: '❌ Cancelar' },
        ],
      });
      return;
    }

    await sock.sendMessage(userId, { text: '❌ Opção inválida.' });
    return;
  }

  // Listagem principal
  try {
    const recorrentes = await lancamentosService.buscarRecorrentesAtivos(userId);

    if (!recorrentes || recorrentes.length === 0) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Nenhum gasto recorrente/fixo encontrado',
          emojiTitulo: '🔄',
          dicas: [
            { texto: 'Ver histórico de lançamentos', comando: 'historico' },
            { texto: 'Ver resumo do mês', comando: 'resumo' }
          ]
        })
      });
      return;
    }

    const visiveis = recorrentes.slice(0, 9);
    const extras = recorrentes.length - visiveis.length;
    const bodyTexto = extras > 0
      ? `${recorrentes.length} recorrentes encontrados. Mostrando os primeiros 9.`
      : `${recorrentes.length} recorrente(s) encontrado(s). Toque para ver detalhes.`;

    await sock.sendInteractiveMessage(userId, {
      type: 'list',
      header: '🔄 Gastos Recorrentes/Fixos',
      body: bodyTexto,
      buttonLabel: 'Ver recorrentes',
      sections: [{
        rows: [
          ...visiveis.map((r: any, i: number) => ({
            id: String(i + 1),
            title: r.descricao.slice(0, 24),
            description: `${formatarComMoeda(r.valor)}/mês`
          })),
          { id: '0', title: '↩️ Cancelar' }
        ]
      }]
    });

    await definirEstado(userId, 'aguardando_selecao_recorrente', { recorrentes });

  } catch (error) {
    logger.error({ err: (error as any)?.message || error }, '[RECORRENTES] Erro ao listar');
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Erro ao carregar recorrentes',
        emojiTitulo: '❌',
        dicas: [
          { texto: 'Tentar novamente', comando: 'recorrentes' },
          { texto: 'Ver histórico', comando: 'historico' }
        ]
      })
    });
  }
}

export default recorrentesCommand;
