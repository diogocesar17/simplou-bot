import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { definirEstado, obterEstado } from '../configs/stateManager';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

const ITENS_POR_PAGINA = 10;

function formatarItemLancamento(l: any, idx: number, usarCriadoEm: boolean): string {
  const dataParaExibir: Date | string = usarCriadoEm ? (l.criado_em || l.data) : l.data;

  const dataBR = (dataParaExibir instanceof Date)
    ? dataParaExibir.toLocaleDateString('pt-BR')
    : (typeof dataParaExibir === 'string' && dataParaExibir.match(/\d{4}-\d{2}-\d{2}/)
        ? new Date(dataParaExibir).toLocaleDateString('pt-BR')
        : (typeof dataParaExibir === 'string' ? dataParaExibir : new Date(dataParaExibir as any).toLocaleDateString('pt-BR')));

  const emojiTipo = l.tipo === 'receita' ? '💰' : '💸';

  let item = `${idx + 1}. ${emojiTipo} ${dataBR} | R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;

  if (l.tipoAgrupamento === 'parcelado') {
    item += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo && l.grupo[0] ? l.grupo[0].valor : 0)}`;
  }
  if (l.tipoAgrupamento === 'recorrente') {
    item += ` | 🔁 Recorrente: ${l.grupo ? l.grupo.length : 0}x`;
  }
  if (l.data_contabilizacao && l.data_contabilizacao !== l.data) {
    const dataContabilizacao = new Date(l.data_contabilizacao).toLocaleDateString('pt-BR');
    item += ` | 📊 Contabilização: ${dataContabilizacao}`;
  }

  if (l.descricao) {
    item += `\n   📝 ${l.descricao}`;
  }

  return item;
}

async function historicoCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
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

  const labelTipo = filtroTipo === 'gasto' ? ' — Gastos' : filtroTipo === 'receita' ? ' — Receitas' : '';
  const titulo = mesAno
    ? `Histórico ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}${labelTipo}`
    : `Últimos Lançamentos${labelTipo}`;

  const dicas: { texto: string; comando: string }[] = [
    { texto: 'Editar lançamento', comando: 'editar <número>' },
    { texto: 'Excluir lançamento', comando: 'excluir <número>' }
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
}

async function historicoMaisCommand(sock, userId) {
  const estado = await obterEstado<{ lista: any[]; mesAno: any; timestamp: number; pagina: number }>(userId);

  if (!estado || estado.etapa !== 'historico_exibido') {
    await sock.sendMessage(userId, {
      text: 'Não há histórico recente. Digite *historico* para ver seus lançamentos.'
    });
    return;
  }

  const dados = estado.dadosParciais;
  const TTL_HISTORICO_MS = 10 * 60 * 1000; // 10 minutos
  if (!dados || Date.now() - (dados.timestamp || 0) > TTL_HISTORICO_MS) {
    await sock.sendMessage(userId, {
      text: 'Não há histórico recente. Digite *historico* para ver seus lançamentos.'
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
