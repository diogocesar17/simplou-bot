// @ts-nocheck
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
    await sock.sendMessage(userId, {
      text: formatarMenuComCancelamento(
        'O que você quer editar?',
        [
          'Lançamento - editar valor, categoria, data, etc.',
          'Cartão - editar vencimento, fechamento'
        ],
        '💡 Escolha o tipo de edição que deseja realizar',
        true
      )
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
    if (estadoAtual?.etapa === 'cartoes_listados' && estadoAtual?.dadosParciais?.cartoes?.length) {
      // Promove o estado para aguardando escolha de edição de cartão e repassa o índice
      await definirEstado(userId, 'aguardando_escolha_edicao_cartao', { cartoes: estadoAtual.dadosParciais.cartoes });
      await editarCartaoCommand(sock, userId, idxMatch![1]);
      return;
    }

    // Se há contexto de recorrentes listados, iniciar fluxo de edição de recorrente diretamente
    if (estadoAtual?.etapa === 'recorrentes_listados' && estadoAtual?.dadosParciais?.recorrentes?.length) {
      const idx = parseInt(idxMatch![1], 10) - 1;
      const grupos = estadoAtual.dadosParciais.recorrentes;
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

      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: `Editar Recorrente ${idx + 1}`,
          emojiTitulo: '📝',
          secoes: [
            {
              titulo: 'Detalhes da Recorrência (próxima pendente)'
              ,
              itens: [
                `Data: ${dataExibir}`,
                `Valor: R$ ${lancamento.valor}`,
                `Categoria: ${lancamento.categoria}`,
                `Pagamento: ${lancamento.pagamento}`,
                `Descrição: ${lancamento.descricao}`
              ],
              emoji: '📋'
            },
            {
              titulo: 'Opções de Edição',
              itens: [
                '1. Valor',
                '2. Categoria', 
                '3. Descrição',
                '4. Forma de pagamento',
                '5. Data'
              ],
              emoji: '⚙️'
            }
          ],
          dicas: [
            { texto: 'Digite o número da opção', comando: '1, 2, 3, 4 ou 5' },
            { texto: 'Cancelar edição', comando: '0 ou cancelar' }
          ]
        })
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
  await sock.sendMessage(userId, {
    text: '✏️ *O que você quer editar?*\n\n1️⃣ *Lançamento* - editar valor, categoria, data, etc.\n2️⃣ *Cartão* - editar vencimento, fechamento\n\n💡 Digite o número da opção ou "cancelar"'
  });
}

export default editarComMenuCommand; 
