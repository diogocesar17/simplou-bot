// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import excluirLancamentoCommand from './excluirLancamento';
import excluirCartaoCommand from './excluirCartao';
import { formatarCancelamento, formatarMenuComCancelamento, formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function excluirComMenuCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);

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
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: '🗑️ *Excluir Lançamento*\n\n💡 Para excluir um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "excluir <número>"\n\n📋 Exemplo:\n• histórico\n• excluir 2' 
        });
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
    await sock.sendMessage(userId, {
      text: formatarMenuComCancelamento(
        'O que você quer excluir?',
        [
          'Lançamento - excluir gasto, receita, etc.',
          'Cartão - excluir configuração de cartão'
        ],
        '⚠️ Atenção: Esta ação não pode ser desfeita!',
        true
      )
    });
    return;
  }

  // Se o usuário digitou "excluir lançamento"
  if (textoLower === 'excluir lancamento' || textoLower === 'excluir lançamento') {
    await sock.sendMessage(userId, { 
      text: '🗑️ *Excluir Lançamento*\n\n💡 Para excluir um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "excluir <número>"\n\n📋 Exemplo:\n• histórico\n• excluir 2' 
    });
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
    if (estadoAtual?.etapa === 'cartoes_listados' && estadoAtual?.dadosParciais?.cartoes?.length) {
      // Promove o estado para aguardando escolha de exclusão de cartão e repassa o índice
      await definirEstado(userId, 'aguardando_escolha_exclusao_cartao', { cartoes: estadoAtual.dadosParciais.cartoes });
      await excluirCartaoCommand(sock, userId, idxMatch![1]);
      return;
    }

    // Se há contexto de recorrentes listados, iniciar fluxo de exclusão de recorrente
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
      const mensagemEscolha = formatarMensagem({
        titulo: 'Este lançamento é recorrente/fixo',
        emojiTitulo: '🔁',
        secoes: [{
          titulo: 'O que deseja excluir?',
          itens: [
            '1. Apenas esta recorrência',
            '2. Esta e todas as futuras'
          ],
          emoji: '⚠️'
        }],
        dicas: [
          { texto: 'Cancelar', comando: '0 ou cancelar' }
        ]
      });
      await sock.sendMessage(userId, { text: mensagemEscolha });
      return;
    }

    // Caso contrário, assumir exclusão de lançamento
    await excluirLancamentoCommand(sock, userId, texto);
    return;
  }

  // Se chegou até aqui, mostrar menu padrão
  await definirEstado(userId, 'aguardando_tipo_exclusao');
  await sock.sendMessage(userId, {
    text: '🗑️ *O que você quer excluir?*\n\n1️⃣ *Lançamento* - excluir gasto, receita, etc.\n2️⃣ *Cartão* - excluir configuração de cartão\n\n⚠️ *Atenção:* Esta ação não pode ser desfeita!\n\n💡 Digite o número da opção ou "cancelar"'
  });
}

export default excluirComMenuCommand; 
