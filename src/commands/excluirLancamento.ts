import * as lancamentosService from '../services/lancamentosService';
import { obterEstado, limparEstado, definirEstado } from '../configs/stateManager';
import { formatarMensagem, formatarConfirmacao, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

function formatarDataParaExibicao(data: any): string {
  if (!data) return '';
  if (data instanceof Date) {
    return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  if (typeof data === 'string') {
    const s = data.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [ano, mes, dia] = s.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
    return s;
  }
  try {
    const d = new Date(data);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {}
  return String(data);
}

async function excluirLancamentoCommand(sock, userId, texto) {
  logger.info({ trecho: String(texto || '').slice(0, 80) }, '[EXCLUIR_LANCAMENTO] texto recebido');
  
  // Verificar se há um estado ativo primeiro
  const estado = await obterEstado(userId);
  logger.debug?.({ estado }, '[EXCLUIR_LANCAMENTO] estado inicial');
  
  // Se está aguardando confirmação, processar a resposta
  if (estado?.etapa === 'aguardando_confirmacao_exclusao_lancamento') {
    const confirmacao = texto.toLowerCase().trim();
    
    if (confirmacao === '1' || confirmacao === 'sim' || confirmacao === 'confirmar') {
      try {
        const { lancamento, escopoExclusao } = estado.dadosParciais as any;
        let lancamentosExcluidos = 0;

        if (lancamento.parcelamento_id && escopoExclusao) {
          if (escopoExclusao === 'apenas_atual') {
            lancamentosExcluidos = await lancamentosService.excluirLancamentoPorId(userId, lancamento.id) as number;
          } else if (escopoExclusao === 'atual_e_futuras') {
            lancamentosExcluidos = await (lancamentosService as any).excluirParcelasFuturasApartir(
              userId,
              lancamento.parcelamento_id,
              lancamento.parcela_atual,
              null
            );
          } else if (escopoExclusao === 'todas_parcelas') {
            lancamentosExcluidos = await lancamentosService.excluirParcelamentoPorId(userId, lancamento.parcelamento_id);
          }
        } else if (lancamento.recorrente_id && escopoExclusao) {
          if (escopoExclusao === 'apenas_atual') {
            lancamentosExcluidos = await lancamentosService.excluirLancamentoPorId(userId, lancamento.id) as number;
          } else if (escopoExclusao === 'atual_e_futuras') {
            const dataSelecionada = (lancamento.data instanceof Date)
              ? lancamento.data.toLocaleDateString('pt-BR')
              : String(lancamento.data);
            lancamentosExcluidos = await (lancamentosService as any).excluirRecorrenciasFuturasApartir(
              userId,
              lancamento.recorrente_id,
              dataSelecionada
            );
          }
        } else {
          lancamentosExcluidos = await lancamentosService.excluirLancamentoPorId(userId, lancamento.id) as number;
        }
        
        // Limpar estado após exclusão bem-sucedida
        await limparEstado(userId);
        
        // Personalizar mensagem baseada no tipo de lançamento
        if (lancamento.parcelamento_id && escopoExclusao && escopoExclusao !== 'apenas_atual') {
          await sock.sendMessage(userId, { 
            text: formatarMensagem({
              titulo: 'Parcelamento excluído com sucesso',
              emojiTitulo: '✅',
              secoes: [
                {
                  titulo: 'Detalhes do Parcelamento',
                  itens: [
                    `Descrição: ${lancamento.descricao}`,
                    `Valor Total: R$ ${lancamento.valor}`,
                    `Categoria: ${lancamento.categoria}`,
                    `Parcelas Excluídas: ${lancamentosExcluidos}`
                  ],
                  emoji: '📝'
                }
              ],
              dicas: gerarDicasContextuais('excluir')
            })
          });
        } else if (lancamento.recorrente_id && escopoExclusao && escopoExclusao !== 'apenas_atual') {
          await sock.sendMessage(userId, {
            text: formatarMensagem({
              titulo: 'Recorrente excluído com sucesso',
              emojiTitulo: '✅',
              secoes: [
                {
                  titulo: 'Detalhes do Recorrente',
                  itens: [
                    `Descrição: ${lancamento.descricao}`,
                    `Valor: R$ ${lancamento.valor}`,
                    `Categoria: ${lancamento.categoria}`,
                    `Recorrências excluídas: ${lancamentosExcluidos}`
                  ],
                  emoji: '🔁'
                }
              ],
              dicas: gerarDicasContextuais('excluir')
            })
          });
        } else {
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
              dicas: gerarDicasContextuais('excluir')
            })
          });
        }
      } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro ao excluir lançamento');
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: ERROR_MESSAGES.ERRO_INTERNO('Excluir lançamento', 'Tente novamente em alguns instantes')
        });
      }
    } else if (confirmacao === '0' || confirmacao === '2' || confirmacao === 'nao' || confirmacao === 'cancelar') {
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
          dicas: gerarDicasContextuais('excluir')
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

  // Se está aguardando escolha de escopo para exclusão de parcelado
  if (estado?.etapa === 'aguardando_escolha_exclusao_parcelado') {
    const { lancamento } = estado.dadosParciais as any;
    const escolha = texto.trim();
    const escolhaLower = escolha.toLowerCase();
    if (escolha === '0' || escolhaLower === 'cancelar') {
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
          dicas: gerarDicasContextuais('excluir')
        })
      });
      return;
    }
    if (['1', '2', '3'].indexOf(escolha) === -1) {
      await sock.sendMessage(userId, {
        text: ERROR_MESSAGES.VALOR_INVALIDO('Escopo de exclusão', '1, 2 ou 3', '1, 2, 3, 0 ou cancelar')
      });
      return;
    }

    const escopoExclusao = escolha === '1' ? 'apenas_atual' : escolha === '2' ? 'atual_e_futuras' : 'todas_parcelas';

    const dataExib = lancamento.data instanceof Date ? lancamento.data.toLocaleDateString('pt-BR') : lancamento.data;
    let header: string;
    let body: string;
    if (escopoExclusao === 'apenas_atual') {
      header = 'Excluir esta parcela?';
      body = `📝 ${lancamento.descricao}\n💰 R$ ${lancamento.valor}\n📂 ${lancamento.categoria}\n📅 ${dataExib}`;
    } else if (escopoExclusao === 'atual_e_futuras') {
      header = 'Excluir parcelas futuras?';
      body = `📝 ${lancamento.descricao}\n📂 ${lancamento.categoria}\n📅 Parcela ${lancamento.parcela_atual}/${lancamento.total_parcelas}\n⚠️ Exclui esta e todas as futuras`;
    } else {
      header = 'Excluir TODAS as parcelas?';
      body = `📝 ${lancamento.descricao}\n📂 ${lancamento.categoria}\n📅 ${lancamento.total_parcelas} parcelas\n⚠️ Inclui passadas e futuras`;
    }

    await definirEstado(userId, 'aguardando_confirmacao_exclusao_lancamento', {
      lancamentoId: lancamento.id,
      lancamento,
      escopoExclusao
    });

    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header,
      body,
      footer: '⚠️ Esta ação não pode ser desfeita!',
      buttons: [
        { id: '1', title: '✅ Confirmar' },
        { id: '2', title: '❌ Cancelar' },
      ],
    });
    return;
  }

  // Se está aguardando escolha de escopo para exclusão de recorrente
  if (estado?.etapa === 'aguardando_escolha_exclusao_recorrente') {
    const { lancamento } = estado.dadosParciais as any;
    const escolha = texto.trim();
    const escolhaLower = escolha.toLowerCase();
    if (escolha === '0' || escolhaLower === 'cancelar') {
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
          dicas: gerarDicasContextuais('excluir')
        })
      });
      return;
    }
    if (['1', '2'].indexOf(escolha) === -1) {
      await sock.sendMessage(userId, {
        text: ERROR_MESSAGES.VALOR_INVALIDO('Escopo de exclusão', '1 ou 2', '1, 2, 0 ou cancelar')
      });
      return;
    }

    const escopoExclusao = escolha === '1' ? 'apenas_atual' : 'atual_e_futuras';

    const dataExib = lancamento.data instanceof Date ? lancamento.data.toLocaleDateString('pt-BR') : lancamento.data;
    const header = escopoExclusao === 'apenas_atual' ? 'Excluir esta recorrência?' : 'Excluir recorrências futuras?';
    const body = escopoExclusao === 'apenas_atual'
      ? `📝 ${lancamento.descricao}\n💰 R$ ${lancamento.valor}\n📂 ${lancamento.categoria}\n📅 ${dataExib}`
      : `📝 ${lancamento.descricao}\n📂 ${lancamento.categoria}\n⚠️ Exclui esta e todas as futuras (passadas não afetadas)`;

    await definirEstado(userId, 'aguardando_confirmacao_exclusao_lancamento', {
      lancamentoId: lancamento.id,
      lancamento,
      escopoExclusao
    });

    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header,
      body,
      footer: '⚠️ Esta ação não pode ser desfeita!',
      buttons: [
        { id: '1', title: '✅ Confirmar' },
        { id: '2', title: '❌ Cancelar' },
      ],
    });
    return;
  }
  
  // Se não está aguardando confirmação, validar formato do comando
  const match = texto.toLowerCase().match(/^excluir\s+(\d+)$/i);
  logger.debug?.({ match }, '[EXCLUIR_LANCAMENTO] match');
  if (!match) {
  logger.info('[EXCLUIR_LANCAMENTO] match inválido');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.FORMATO_INVALIDO('Comando excluir', 'excluir 3', 'excluir 1, excluir 2, excluir 5') 
    });
    return;
  }
  
  const idx = parseInt(match[1], 10) - 1;
  
  // Verificar se há um histórico exibido no estado
  if (!estado || estado.etapa !== 'historico_exibido') {
  logger.info('[EXCLUIR_LANCAMENTO] estado inválido');
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.ESTADO_INVALIDO('excluir lançamento')
    });
    return;
  }
  
  // Verificar se o estado não expirou (mais de 10 minutos)
  const agora = Date.now();
  const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
  if (agora - (estado.dadosParciais as any).timestamp > tempoExpiracao) {
    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text: ERROR_MESSAGES.ESTADO_INVALIDO('excluir lançamento')
    });
    return;
  }

  const lista = (estado.dadosParciais as any).lista;
  
  if (!lista || !lista[idx]) {
    await sock.sendMessage(userId, { 
      text: ERROR_MESSAGES.LANCAMENTO_NAO_ENCONTRADO(String(idx + 1))
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
  
  // Personalizar mensagem baseada no tipo de lançamento
  let mensagemConfirmacao;
  
  if (lancamento.parcelamento_id) {
    // Fluxo especial: antes de confirmar, perguntar escopo de exclusão
    await definirEstado(userId, 'aguardando_escolha_exclusao_parcelado', {
      lancamento
    });
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
    // Fluxo especial para recorrente: perguntar escopo
    await definirEstado(userId, 'aguardando_escolha_exclusao_recorrente', {
      lancamento
    });
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
    // Se não for parcelado, confirmação normal
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
        `📂 ${lancamento.categoria}\n` +
        `📅 ${formatarDataParaExibicao(lancamento.data)}`,
      footer: '⚠️ Esta ação não pode ser desfeita!',
      buttons: [
        { id: '1', title: '✅ Confirmar' },
        { id: '2', title: '❌ Cancelar' },
      ],
    });
  }
}

export default excluirLancamentoCommand; 
import { logger } from '../infrastructure/logger';
