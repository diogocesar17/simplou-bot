import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import * as databaseService from '../infrastructure/databaseService';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

const ITENS_POR_PAGINA = 10;

function formatarItemLancamento(l: any, idx: number, usarCriadoEm: boolean): string {
  const dataParaExibir: Date | string = usarCriadoEm ? (l.criado_em || l.data) : l.data;

  const dateObj = (dataParaExibir instanceof Date)
    ? dataParaExibir
    : (typeof dataParaExibir === 'string' && dataParaExibir.match(/\d{4}-\d{2}-\d{2}/)
        ? new Date(dataParaExibir)
        : new Date(dataParaExibir as any));

  const dataBR = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const emojiTipo = l.tipo === 'receita' ? '💰' : '💸';

  // Linha 1: N. emoji *R$ valor* — categoria
  let item = `${idx + 1}. ${emojiTipo} *R$ ${formatarValor(l.valor)}* — ${l.categoria}`;

  // Linha 2: data · pagamento [· contabilização]
  let linha2 = `   📅 ${dataBR} · 💳 ${l.pagamento}`;
  if (l.data_contabilizacao && l.data_contabilizacao !== l.data) {
    const dataContabilizacao = new Date(l.data_contabilizacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    linha2 += ` · 📊 Contab.: ${dataContabilizacao}`;
  }
  item += `\n${linha2}`;

  // Linha 3 (opcional): parcelado ou recorrente
  if (l.tipoAgrupamento === 'parcelado') {
    item += `\n   📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo && l.grupo[0] ? l.grupo[0].valor : 0)}`;
  } else if (l.tipoAgrupamento === 'recorrente') {
    item += `\n   🔁 Recorrente: ${l.grupo ? l.grupo.length : 0}x`;
  }

  // Última linha (opcional): descrição
  if (l.descricao) {
    item += `\n   📝 ${l.descricao}`;
  }

  return item;
}

async function historicoCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();

  const estadoAtual = await obterEstado(userId);

  // Handler: aguardando ação sobre lançamento selecionado do histórico
  if (estadoAtual?.etapa === 'aguardando_acao_historico') {
    const { lancamento } = estadoAtual.dadosParciais as any;
    if (texto === '0' || textoLower === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Operação cancelada.' });
      return;
    }
    if (texto === '1') {
      await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
        lancamentoId: lancamento.id,
        lancamento,
        campo: null
      });
      const dataExibir = new Date(lancamento.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '📝 Editar Lançamento',
        body:
          `📅 ${dataExibir}  💰 R$ ${formatarValor(lancamento.valor)}\n` +
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
    if (texto === '2') {
      if (lancamento.parcelamento_id) {
        await definirEstado(userId, 'aguardando_escolha_exclusao_parcelado', { lancamento });
        await sock.sendInteractiveMessage(userId, {
          type: 'button',
          header: '🧩 Lançamento parcelado',
          body: `📝 ${lancamento.descricao}\n\nO que deseja excluir?`,
          footer: 'Digite "cancelar" para abortar',
          buttons: [
            { id: '1', title: 'Só esta parcela' },
            { id: '2', title: 'Esta e futuras' },
            { id: '3', title: 'Todas as parcelas' },
          ],
        });
      } else if (lancamento.recorrente_id) {
        await definirEstado(userId, 'aguardando_escolha_exclusao_recorrente', { lancamento });
        await sock.sendInteractiveMessage(userId, {
          type: 'button',
          header: '🔁 Lançamento recorrente',
          body: `📝 ${lancamento.descricao}\n\nO que deseja excluir?`,
          footer: 'Digite "cancelar" para abortar',
          buttons: [
            { id: '1', title: 'Só esta recorrência' },
            { id: '2', title: 'Esta e futuras' },
            { id: '0', title: '❌ Cancelar' },
          ],
        });
      } else {
        await definirEstado(userId, 'aguardando_confirmacao_exclusao_lancamento', {
          lancamentoId: lancamento.id,
          lancamento
        });
        await sock.sendInteractiveMessage(userId, {
          type: 'button',
          header: 'Confirmar exclusão?',
          body:
            `📝 ${lancamento.descricao}\n` +
            `💰 R$ ${lancamento.valor}\n` +
            `📂 ${lancamento.categoria}`,
          footer: '⚠️ Esta ação não pode ser desfeita!',
          buttons: [
            { id: '1', title: '✅ Confirmar' },
            { id: '2', title: '❌ Cancelar' },
          ],
        });
      }
      return;
    }
    await limparEstado(userId);
    return;
  }

  // Handler: aguardando seleção de item no histórico interativo
  if (estadoAtual?.etapa === 'aguardando_selecao_historico') {
    const { lista, mesAno, timestamp, pagina } = estadoAtual.dadosParciais as any;

    if (texto === '0' || textoLower === 'cancelar' || textoLower === 'fechar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Histórico fechado.' });
      return;
    }

    if (textoLower === 'mais') {
      const proximaPagina = (pagina ?? 0) + 1;
      const inicio = proximaPagina * 9;
      const chunk = lista.slice(inicio, inicio + 9);
      if (chunk.length === 0) {
        await sock.sendMessage(userId, { text: 'Não há mais lançamentos.' });
        return;
      }
      const rows = chunk.map((l: any, i: number) => {
        const tipoEmoji = l.tipo === 'receita' ? '💰' : '💸';
        const title = `${tipoEmoji} R$ ${formatarValor(l.valor)} — ${l.categoria}`.slice(0, 24);
        const dataStr = new Date(l.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return { id: String(i + 1), title, description: `${dataStr} · ${l.pagamento}` };
      });
      const temMais = lista.length > inicio + chunk.length;
      if (temMais) {
        rows.push({ id: 'mais', title: '📋 Ver mais', description: '' });
      } else {
        rows.push({ id: '0', title: '↩️ Fechar', description: '' });
      }
      await definirEstado(userId, 'aguardando_selecao_historico', { lista, mesAno, timestamp, pagina: proximaPagina });
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '📋 Histórico',
        body: `Lançamentos ${inicio + 1}–${inicio + chunk.length} de ${lista.length}`,
        buttonLabel: 'Ver lançamentos',
        sections: [{ rows }],
      });
      return;
    }

    const idx = parseInt(texto) - 1;
    if (isNaN(idx) || idx < 0 || idx >= lista.length) {
      await sock.sendMessage(userId, { text: `❌ Número inválido.` });
      return;
    }

    const l = lista[idx + (pagina ?? 0) * 9];
    if (!l) {
      await sock.sendMessage(userId, { text: `❌ Item não encontrado.` });
      return;
    }

    await definirEstado(userId, 'aguardando_acao_historico', { lancamento: l });
    const dataStr = new Date(l.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const tipoEmoji = l.tipo === 'receita' ? '💰' : '💸';
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: `${tipoEmoji} ${l.descricao || l.categoria}`,
      body:
        `📅 ${dataStr}  💰 R$ ${formatarValor(l.valor)}\n` +
        `📂 ${l.categoria}  💳 ${l.pagamento}`,
      buttons: [
        { id: '1', title: '✏️ Editar' },
        { id: '2', title: '🗑️ Excluir' },
      ],
    });
    return;
  }

  // Extrai o possível período após o comando
  const partes = texto.trim().split(/\s+/);
  let mesAno: { mes: number; ano: number } | null = null;
  let limite = 9999; // busca todos para paginação local

  // Detectar filtro de tipo
  let filtroTipo: string | null = null;
  const palavrasFiltro = partes.slice(1).map(p => p.toLowerCase());
  if (palavrasFiltro.includes('gastos') || palavrasFiltro.includes('gasto') || palavrasFiltro.includes('despesas')) {
    filtroTipo = 'gasto';
  } else if (palavrasFiltro.includes('receitas') || palavrasFiltro.includes('receita') || palavrasFiltro.includes('entradas')) {
    filtroTipo = 'receita';
  }
  // Remover a palavra do filtro antes de parsear mês/ano
  const restoParts = partes.slice(1).filter(p => !['gastos','gasto','despesas','receitas','receita','entradas'].includes(p.toLowerCase()));
  const restoTexto = restoParts.join(' ');
  mesAno = restoTexto.trim() ? parseMesAno(restoTexto) : null;

  // Detectar filtro de categoria (só se não detectou tipo e o resto não é um mês/ano)
  let filtroCategoria: string | null = null;
  if (!filtroTipo) {
    const textoRestante = restoParts.join(' ').toLowerCase().trim();
    if (textoRestante && !mesAno) {
      const categorias = await databaseService.getCategorias(userId);
      const catMatch = categorias.find(c => textoRestante === c.toLowerCase() || textoRestante.includes(c.toLowerCase()));
      if (catMatch) filtroCategoria = catMatch;
    }
  }

  // Validar se não é mês futuro (apenas se especificado um mês)
  if (mesAno) {
    const agora = new Date();
    const mesAtual = agora.getMonth() + 1;
    const anoAtual = agora.getFullYear();

    if (mesAno.ano > anoAtual || (mesAno.ano === anoAtual && mesAno.mes > mesAtual)) {
      await sock.sendMessage(userId, {
        text: ERROR_MESSAGES.HISTORICO_MES_FUTURO('histórico')
      });
      return;
    }
  }

  let ultimos;
  if (mesAno) {
    ultimos = await lancamentosService.listarLancamentos(userId, limite, mesAno.mes, mesAno.ano);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Nenhum lançamento encontrado',
          emojiTitulo: '📭',
          secoes: [
            {
              titulo: 'Período',
              itens: [`${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`],
              emoji: '📅'
            }
          ],
          dicas: gerarDicasContextuais('historico')
        })
      });
      return;
    }
  } else {
    ultimos = await lancamentosService.listarLancamentos(userId, limite);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Nenhum lançamento encontrado',
          emojiTitulo: '📭',
          dicas: gerarDicasContextuais('historico')
        })
      });
      return;
    }
  }

  // Aplicar filtro por tipo se solicitado
  if (filtroTipo) {
    ultimos = ultimos.filter(l => l.tipo === filtroTipo);
  }

  // Aplicar filtro por categoria se solicitado
  if (filtroCategoria) {
    ultimos = ultimos.filter(l => l.categoria?.toLowerCase() === filtroCategoria!.toLowerCase());
  }

  const totalRegistros = ultimos.length;

  // Para histórico sem filtro de mês, exibir apenas os primeiros ITENS_POR_PAGINA
  const listaParaExibir = !mesAno ? ultimos.slice(0, ITENS_POR_PAGINA) : ultimos;

  // Salvar lista completa no estado para paginação, edição e exclusão
  await definirEstado(userId, 'historico_exibido', {
    lista: ultimos,
    mesAno: mesAno,
    timestamp: Date.now(),
    pagina: 0
  });

  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const l of listaParaExibir) {
    const v = typeof l.valor === 'string' ? parseFloat(l.valor) : Number(l.valor);
    if (!isNaN(v)) {
      if (l.tipo === 'receita') totalEntradas += v;
      else totalSaidas += v;
    }
  }
  const totalMovimentado = totalEntradas + totalSaidas;
  const saldo = totalEntradas - totalSaidas;
  const itensResumo = [
    `Total: R$ ${formatarValor(totalMovimentado)}`,
    `Entradas: R$ ${formatarValor(totalEntradas)}`,
    `Saídas: R$ ${formatarValor(totalSaidas)}`,
    `Saldo: R$ ${formatarValor(saldo)}`,
    `Lançamentos: ${listaParaExibir.length}${!mesAno && totalRegistros > listaParaExibir.length ? ` de ${totalRegistros}` : ''}`
  ];

  const usarCriadoEm = !mesAno;
  const itensLancamentos = listaParaExibir.map((l, idx) =>
    formatarItemLancamento(l, idx, usarCriadoEm)
  );

  const labelTipo = filtroTipo === 'gasto' ? ' — Gastos' : filtroTipo === 'receita' ? ' — Receitas' : filtroCategoria ? ` — ${filtroCategoria}` : '';
  const titulo = mesAno
    ? `Histórico ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}${labelTipo}`
    : `Últimos Lançamentos${labelTipo}`;

  const dicas: { texto: string; comando: string }[] = [
    { texto: 'Editar item 3 da lista', comando: 'editar 3' },
    { texto: 'Excluir item 3 da lista', comando: 'excluir 3' },
    { texto: 'Use o número da lista acima', comando: '(1, 2, 3...)' }
  ];

  if (!mesAno) {
    if (totalRegistros > ITENS_POR_PAGINA) {
      dicas.push({ texto: 'Ver mais lançamentos', comando: 'mais' });
    }
    dicas.push(
      { texto: 'Ver histórico de mês específico', comando: 'historico julho 2024' },
      { texto: 'Ver resumo detalhado', comando: 'resumo detalhado' },
      { texto: 'Ver resumo resumido', comando: 'resumo' }
    );
  }

  const MAX_ITENS_POR_MENSAGEM = 35;
  const totalPartes = Math.max(1, Math.ceil(itensLancamentos.length / MAX_ITENS_POR_MENSAGEM));

  for (let parte = 0; parte < totalPartes; parte++) {
    const inicio = parte * MAX_ITENS_POR_MENSAGEM;
    const fim = inicio + MAX_ITENS_POR_MENSAGEM;
    const chunk = itensLancamentos.slice(inicio, fim);

    const secoes = parte === 0
      ? [
          { titulo: 'Resumo', itens: itensResumo, emoji: '💰' },
          { titulo: 'Lançamentos', itens: chunk, emoji: '📊' }
        ]
      : [
          { titulo: 'Lançamentos', itens: chunk, emoji: '📊' }
        ];

    const tituloParte = totalPartes > 1
      ? `${titulo} (${parte + 1}/${totalPartes})`
      : titulo;

    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: tituloParte,
        emojiTitulo: '📋',
        secoes,
        dicas: parte === totalPartes - 1 ? dicas : []
      })
    });
  }

  // Lista interativa para selecionar item
  const listaInterativa = ultimos.slice(0, 9);
  const rowsInterativos = listaInterativa.map((l: any, i: number) => {
    const tipoEmoji = l.tipo === 'receita' ? '💰' : '💸';
    const title = `${tipoEmoji} R$ ${formatarValor(l.valor)} — ${l.categoria}`.slice(0, 24);
    const dataStr = new Date(l.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return { id: String(i + 1), title, description: `${dataStr} · ${l.pagamento}` };
  });
  const temMaisInterativo = ultimos.length > 9;
  if (temMaisInterativo) {
    rowsInterativos.push({ id: 'mais', title: '📋 Ver mais', description: '' });
  } else {
    rowsInterativos.push({ id: '0', title: '↩️ Fechar', description: '' });
  }

  await definirEstado(userId, 'aguardando_selecao_historico', {
    lista: ultimos,
    mesAno,
    timestamp: Date.now(),
    pagina: 0
  });

  await sock.sendInteractiveMessage(userId, {
    type: 'list',
    header: '📋 Selecione um lançamento',
    body: 'Toque em um item para editar ou excluir:',
    buttonLabel: 'Ver lançamentos',
    sections: [{ rows: rowsInterativos }],
  });
}

async function historicoMaisCommand(sock, userId) {
  const estado = await obterEstado<{ lista: any[]; mesAno: any; timestamp: number; pagina: number }>(userId);

  if (!estado || estado.etapa !== 'historico_exibido') {
    await sock.sendMessage(userId, {
      text: 'Não há histórico ativo. Digite *historico* para ver seus lançamentos.'
    });
    return;
  }

  const dados = estado.dadosParciais;
  const TTL_HISTORICO_MS = 10 * 60 * 1000; // 10 minutos
  if (!dados || Date.now() - (dados.timestamp || 0) > TTL_HISTORICO_MS) {
    await sock.sendMessage(userId, {
      text: 'O histórico expirou (fica ativo por 10 minutos). Digite *historico* para recarregar.'
    });
    return;
  }

  const lista: any[] = dados.lista || [];
  const paginaAtual: number = dados.pagina ?? 0;
  const proximaPagina = paginaAtual + 1;
  const inicio = proximaPagina * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;
  const chunk = lista.slice(inicio, fim);

  if (chunk.length === 0) {
    await sock.sendMessage(userId, {
      text: 'Não há mais lançamentos para exibir.'
    });
    return;
  }

  // Atualizar estado com nova página
  await definirEstado(userId, 'historico_exibido', {
    ...dados,
    pagina: proximaPagina,
    timestamp: dados.timestamp
  });

  const usarCriadoEm = !dados.mesAno;
  const itensLancamentos = chunk.map((l, idx) =>
    formatarItemLancamento(l, inicio + idx, usarCriadoEm)
  );

  const totalRegistros = lista.length;
  const restantes = totalRegistros - fim;
  const dicas: { texto: string; comando: string }[] = [];
  if (restantes > 0) {
    dicas.push({ texto: 'Ver mais lançamentos', comando: 'mais' });
  }
  dicas.push(
    { texto: 'Editar lançamento', comando: 'editar <número>' },
    { texto: 'Excluir lançamento', comando: 'excluir <número>' }
  );

  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: `Lançamentos ${inicio + 1}–${inicio + chunk.length} de ${totalRegistros}`,
      emojiTitulo: '📋',
      secoes: [
        { titulo: 'Lançamentos', itens: itensLancamentos, emoji: '📊' }
      ],
      dicas
    })
  });
}

export { historicoMaisCommand };
export default historicoCommand;
