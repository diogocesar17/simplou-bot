// @ts-nocheck
import * as lancamentosService from '../services/lancamentosService';
import { obterEstado, limparEstado, definirEstado } from '../configs/stateManager';
import { formatarMensagem, formatarConfirmacao } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function excluirLancamentoCommand(sock, userId, texto) {
  console.log('texto', texto);
  
  // Verificar se há um estado ativo primeiro
  const estado = await obterEstado(userId);
  console.log('estado excluir lancamento', estado);
  
  // Se está aguardando confirmação, processar a resposta
  if (estado?.etapa === 'aguardando_confirmacao_exclusao_lancamento') {
    const confirmacao = texto.toLowerCase().trim();
    
    if (confirmacao === '1' || confirmacao === 'sim' || confirmacao === 'confirmar') {
      try {
        const lancamento = estado.dadosParciais.lancamento;
        // Chamar serviço para excluir
        await lancamentosService.excluirLancamentoPorId(userId, lancamento.id);
        
        // Limpar estado após exclusão bem-sucedida
        await limparEstado(userId);
        
        await sock.sendMessage(userId, { 
          text: formatarMensagem({
            titulo: 'Lançamento excluído com sucesso',
            emojiTitulo: '✅',
            secoes: [
              {
                titulo: 'Detalhes do Lançamento',
                itens: [
                  `Descrição: ${lancamento.descricao}`,
                  `Valor: R$ ${lancamento.valor}`,
                  `Categoria: ${lancamento.categoria}`
                ],
                emoji: '📝'
              }
            ],
            dicas: [
              { texto: 'Ver histórico atualizado', comando: 'historico' },
              { texto: 'Ver resumo do mês', comando: 'resumo' }
            ]
          })
        });
      } catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: ERROR_MESSAGES.ERRO_INTERNO('Excluir lançamento', 'Tente novamente em alguns instantes')
        });
      }
    } else if (confirmacao === '2' || confirmacao === 'nao' || confirmacao === 'cancelar') {
      // Cancelar exclusão
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Exclusão cancelada',
          emojiTitulo: '❌',
          secoes: [
            {
              titulo: 'Status',
              itens: ['Operação cancelada pelo usuário'],
              emoji: '🛑'
            }
          ],
          dicas: [
            { texto: 'Ver histórico', comando: 'historico' },
            { texto: 'Ver resumo do mês', comando: 'resumo' }
          ]
        })
      });
    } else {
      // Resposta inválida
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.VALOR_INVALIDO('Confirmação', '1 - Confirmar, 2 - Cancelar', '1, 2, sim, nao, cancelar')
      });
    }
    return;
  }
  
  // Se não está aguardando confirmação, validar formato do comando
  const match = texto.toLowerCase().match(/^excluir\s+(\d+)$/i);
  console.log('match', match);
  if (!match) {
    console.log('match invalido');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.FORMATO_INVALIDO('Comando excluir', 'excluir 3', 'excluir 1, excluir 2, excluir 5') 
    });
    return;
  }
  
  const idx = parseInt(match[1], 10) - 1;
  
  // Verificar se há um histórico exibido no estado
  if (!estado || estado.etapa !== 'historico_exibido') {
    console.log('estado invalido');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.ESTADO_INVALIDO('excluir lançamento')
    });
    return;
  }
  
  // Verificar se o estado não expirou (mais de 10 minutos)
  const agora = Date.now();
  const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
  if (agora - estado.dadosParciais.timestamp > tempoExpiracao) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.ESTADO_INVALIDO('excluir lançamento')
    });
    return;
  }
  
  const lista = estado.dadosParciais.lista;
  
  if (!lista || !lista[idx]) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.LANCAMENTO_NAO_ENCONTRADO(idx + 1)
    });
    return;
  }
  
  const lancamento = lista[idx];
  
  // Primeira vez - mostrar confirmação
  await definirEstado(userId, 'aguardando_confirmacao_exclusao_lancamento', {
    lancamentoId: lancamento.id,
    lancamento: lancamento, // Salvar o lançamento completo para usar na confirmação
    lista: lista,
    timestamp: agora
  });
  
  await sock.sendMessage(userId, { 
    text: formatarConfirmacao(
      'Confirmar Exclusão',
      [
        `📝 Descrição: ${lancamento.descricao}`,
        `💰 Valor: R$ ${lancamento.valor}`,
        `📂 Categoria: ${lancamento.categoria}`,
        `📅 Data: ${lancamento.data instanceof Date ? lancamento.data.toLocaleDateString('pt-BR') : lancamento.data}`
      ],
      ['Confirmar', 'Cancelar'],
      'Dados do Lançamento'
    )
  });
}

export default excluirLancamentoCommand; 