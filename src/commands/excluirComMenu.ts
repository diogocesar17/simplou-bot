import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import excluirLancamentoCommand from './excluirLancamento';
import excluirCartaoCommand from './excluirCartao';
import { formatarCancelamento, formatarMenuComCancelamento, formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';
import * as lancamentosService from '../services/lancamentosService';
import { formatarComMoeda } from '../utils/formatUtils';

async function mostrarListaParaExcluir(sock: any, userId: string): Promise<void> {
  const lancamentos = await lancamentosService.buscarLancamentosRecentes(userId, 5);

  if (!lancamentos || lancamentos.length === 0) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: '📭 Nenhum lançamento encontrado para excluir.' });
    return;
  }

  await definirEstado(userId, 'aguardando_selecao_exclusao_lancamento', {
    lista: lancamentos,
    timestamp: Date.now(),
  });

  const rows = lancamentos.map((l: any, i: number) => {
    const emoji = l.tipo === 'receita' ? '💰' : '💸';
    const data = new Date(l.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const title = `${emoji} ${formatarComMoeda(l.valor)} · ${l.categoria}`.slice(0, 24);
    return { id: String(i + 1), title, description: `${data} · ${l.descricao || ''}`.slice(0, 72) };
  });

  await sock.sendInteractiveMessage(userId, {
    type: 'list',
    header: '🗑️ Qual lançamento excluir?',
    body: 'Selecione o lançamento que deseja remover:',
    buttonLabel: 'Ver lançamentos',
    sections: [{ rows }],
  });
}

async function excluirComMenuCommand(sock: any, userId: string, texto: string) {
  const textoLower = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);

  // Usuário selecionou um lançamento da lista interativa
  if (estado?.etapa === 'aguardando_selecao_exclusao_lancamento') {
    if (textoLower === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '↩️ Operação cancelada.' });
      return;
    }

    const lista = (estado.dadosParciais as any).lista;
    const idx = parseInt(texto) - 1;

    if (isNaN(idx) || idx < 0 || !lista[idx]) {
      await sock.sendMessage(userId, { text: `❌ Opção inválida. Escolha de 1 a ${lista.length}.` });
      return;
    }

    // Configura estado que excluirLancamento.ts espera e delega para ele
    await definirEstado(userId, 'historico_exibido', { lista, timestamp: Date.now() });
    await excluirLancamentoCommand(sock, userId, `excluir ${idx + 1}`);
    return;
  }

  // Se está aguardando escolha do tipo de exclusão
  if (estado?.etapa === 'aguardando_tipo_exclusao') {
    if (textoLower === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Exclusão', [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const escolha = parseInt(texto);
    
    switch (escolha) {
      case 1:
        await mostrarListaParaExcluir(sock, userId);
        return;
        
      case 2:
        await limparEstado(userId);
        await excluirCartaoCommand(sock, userId, 'excluir cartão');
        return;
        
      default:
        await sock.sendMessage(userId, { 
          text: ERROR_MESSAGES.VALOR_INVALIDO('Opção', '1 - para excluir lançamento\n2 - para excluir cartão\n0 ou cancelar - para cancelar') 
        });
        return;
    }
  }

  // Se o usuário digitou apenas "excluir"
  if (textoLower === 'excluir') {
    await definirEstado(userId, 'aguardando_tipo_exclusao');
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🗑️ O que você quer excluir?',
      body: 'Escolha o que deseja excluir:',
      footer: '⚠️ Esta ação não pode ser desfeita!',
      buttons: [
        { id: '1', title: '📝 Lançamento' },
        { id: '2', title: '💳 Cartão' },
        { id: '0', title: '❌ Cancelar' },
      ],
    });
    return;
  }

  // Se o usuário digitou "excluir lançamento"
  if (textoLower === 'excluir lancamento' || textoLower === 'excluir lançamento') {
    await mostrarListaParaExcluir(sock, userId);
    return;
  }

  // Se o usuário digitou "excluir cartão"
  if (textoLower === 'excluir cartao' || textoLower === 'excluir cartão') {
    await excluirCartaoCommand(sock, userId, texto);
    return;
  }

  // Se o usuário digitou "excluir <número>", redirecionar para excluir lançamento
  if (/^excluir\s+\d+$/i.test(textoLower)) {
    // Se há contexto recente de cartões listados, tratar como exclusão de cartão
    const estadoAtual = await obterEstado(userId);
    const idxMatch = textoLower.match(/^excluir\s+(\d+)$/i);
    if (estadoAtual?.etapa === 'cartoes_listados' && (estadoAtual?.dadosParciais as any)?.cartoes?.length) {
      // Promove o estado para aguardando escolha de exclusão de cartão e repassa o índice
      await definirEstado(userId, 'aguardando_escolha_exclusao_cartao', { cartoes: (estadoAtual.dadosParciais as any).cartoes });
      await excluirCartaoCommand(sock, userId, idxMatch![1]);
      return;
    }

    // Se há contexto de recorrentes listados, iniciar fluxo de exclusão de recorrente
    if (estadoAtual?.etapa === 'recorrentes_listados' && (estadoAtual?.dadosParciais as any)?.recorrentes?.length) {
      const idx = parseInt(idxMatch![1], 10) - 1;
      const grupos = (estadoAtual.dadosParciais as any).recorrentes as any[];
      if (!grupos[idx]) {
        await sock.sendMessage(userId, {
          text: '❌ Número inválido. Escolha um dos itens listados.'
        });
        return;
      }
      const grupo = grupos[idx];
      const proximaPendente = grupo.recorrencias.find((r: any) => r.status === 'pendente');
      if (!proximaPendente) {
        await sock.sendMessage(userId, { 
          text: formatarMensagem({
            titulo: 'Nada pendente para excluir',
            emojiTitulo: '✅',
            secoes: [{
              titulo: 'Recorrente selecionado',
              itens: [
                `📝 ${grupo.descricao}`,
                `📂 ${grupo.categoria}`,
                'Todas as recorrências listadas estão marcadas como pagas.'
              ],
              emoji: 'ℹ️'
            }],
            dicas: [
              { texto: 'Ver histórico', comando: 'historico' },
              { texto: 'Ver ajuda', comando: 'ajuda' },
              { texto: 'Voltar aos recorrentes', comando: 'recorrentes' }
            ]
          })
        });
        return;
      }

      const lancamento = {
        id: proximaPendente.id,
        descricao: grupo.descricao,
        valor: grupo.valor,
        categoria: grupo.categoria,
        data: proximaPendente.data,
        recorrente_id: grupo.recorrente_id
      };

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
      return;
    }

    // Caso contrário, assumir exclusão de lançamento
    await excluirLancamentoCommand(sock, userId, texto);
    return;
  }

  // Se chegou até aqui, mostrar menu padrão
  await definirEstado(userId, 'aguardando_tipo_exclusao');
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '🗑️ O que você quer excluir?',
    body: 'Escolha o que deseja excluir:',
    footer: '⚠️ Esta ação não pode ser desfeita!',
    buttons: [
      { id: '1', title: '📝 Lançamento' },
      { id: '2', title: '💳 Cartão' },
      { id: '0', title: '❌ Cancelar' },
    ],
  });
}

export default excluirComMenuCommand; 
