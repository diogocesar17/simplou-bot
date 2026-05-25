import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import editarLancamentoCommand from './editarLancamento';
import editarCartaoCommand from './editarCartao';
import { formatarCancelamento, formatarMenuComCancelamento, formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function editarComMenuCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);

  // Se está aguardando escolha do tipo de edição
  if (estado?.etapa === 'aguardando_tipo_edicao') {
    if (textoLower === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Edição', [
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
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: '📝 *Editar Lançamento*\n\n💡 Para editar um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "editar <número>"\n\n📋 Exemplo:\n• histórico\n• editar 2' 
        });
        return;
        
      case 2:
        await limparEstado(userId);
        await editarCartaoCommand(sock, userId, 'editar cartão');
        return;
        
      default:
        await sock.sendMessage(userId, { 
          text: ERROR_MESSAGES.VALOR_INVALIDO('Opção', '1 - para editar lançamento\n2 - para editar cartão\n0 ou cancelar - para cancelar') 
        });
        return;
    }
  }

  // Se o usuário digitou apenas "editar"
  if (textoLower === 'editar') {
    await definirEstado(userId, 'aguardando_tipo_edicao');
    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '✏️ O que você quer editar?',
      body: 'Escolha o que deseja editar:',
      buttons: [
        { id: '1', title: '📝 Lançamento' },
        { id: '2', title: '💳 Cartão' },
        { id: '0', title: '❌ Cancelar' },
      ],
    });
    return;
  }

  // Se o usuário digitou "editar lançamento" ou "editar cartão"
  if (textoLower === 'editar lancamento' || textoLower === 'editar lançamento') {
    await sock.sendMessage(userId, { 
      text: '📝 *Editar Lançamento*\n\n💡 Para editar um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "editar <número>"\n\n📋 Exemplo:\n• histórico\n• editar 2' 
    });
    return;
  }

  if (textoLower === 'editar cartao' || textoLower === 'editar cartão') {
    await editarCartaoCommand(sock, userId, texto);
    return;
  }

  // Se o usuário digitou "editar <número>", redirecionar para editar lançamento
  if (/^editar\s+\d+$/i.test(textoLower)) {
    // Se há contexto recente de cartões listados, tratar como edição de cartão
    const estadoAtual = await obterEstado(userId);
    const idxMatch = textoLower.match(/^editar\s+(\d+)$/i);
    if (estadoAtual?.etapa === 'cartoes_listados' && (estadoAtual?.dadosParciais as any)?.cartoes?.length) {
      // Promove o estado para aguardando escolha de edição de cartão e repassa o índice
      await definirEstado(userId, 'aguardando_escolha_edicao_cartao', { cartoes: (estadoAtual.dadosParciais as any).cartoes });
      await editarCartaoCommand(sock, userId, idxMatch![1]);
      return;
    }

    // Se há contexto de recorrentes listados, iniciar fluxo de edição de recorrente diretamente
    if (estadoAtual?.etapa === 'recorrentes_listados' && (estadoAtual?.dadosParciais as any)?.recorrentes?.length) {
      const idx = parseInt(idxMatch![1], 10) - 1;
      const grupos = (estadoAtual.dadosParciais as any).recorrentes;
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
            titulo: 'Nada pendente para editar',
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
        pagamento: grupo.pagamento,
        data: proximaPendente.data,
        recorrente_id: grupo.recorrente_id
      };

      // Formatar data para exibição
      let dataExibir: string;
      if (lancamento.data instanceof Date) {
        dataExibir = lancamento.data.toLocaleDateString('pt-BR');
      } else if (typeof lancamento.data === 'string' && lancamento.data.match(/^\d{4}-\d{2}-\d{2}/)) {
        dataExibir = new Date(lancamento.data).toLocaleDateString('pt-BR');
      } else {
        dataExibir = String(lancamento.data);
      }

      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: `📝 Editar Recorrente ${idx + 1}`,
        body:
          `📅 ${dataExibir}  💰 R$ ${lancamento.valor}\n` +
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

      await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
        lancamentoId: lancamento.id,
        lancamento,
        campo: null
      });
      return;
    }

    // Caso contrário, assumir edição de lançamento
    await editarLancamentoCommand(sock, userId, texto);
    return;
  }

  // Se chegou até aqui, mostrar menu padrão
  await definirEstado(userId, 'aguardando_tipo_edicao');
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    header: '✏️ O que você quer editar?',
    body: 'Escolha o que deseja editar:',
    buttons: [
      { id: '1', title: '📝 Lançamento' },
      { id: '2', title: '💳 Cartão' },
      { id: '0', title: '❌ Cancelar' },
    ],
  });
}

export default editarComMenuCommand; 
