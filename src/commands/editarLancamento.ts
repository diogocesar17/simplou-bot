// @ts-nocheck
import * as lancamentosService from '../services/lancamentosService';
import { formatarValor } from '../utils/formatUtils';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import { formatarMensagem, gerarDicasContextuais, formatarCancelamento, formatarMenuComCancelamento } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';


async function editarLancamentoCommand(sock, userId, texto) {
  const estado = await obterEstado(userId);

  // Se está aguardando edição de um campo específico
  if (estado?.etapa === 'aguardando_campo_edicao_lancamento') {
    const contexto = estado.dadosParciais;
    const textoLower = texto.toLowerCase().trim();

    // Permitir cancelar nesta etapa
    if (textoLower === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Edição de lançamento', [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const escolha = parseInt(texto);
    let campo = null;
    let instrucao = '';
    
    switch (escolha) {
      case 1:
        campo = 'valor';
        instrucao = '💰 Digite o novo valor:';
        break;
      case 2:
        campo = 'categoria';
        instrucao = '📂 Digite a nova categoria:';
        break;
      case 3:
        campo = 'descricao';
        instrucao = '📝 Digite a nova descrição:';
        break;
      case 4:
        campo = 'pagamento';
        instrucao = '💳 Digite a nova forma de pagamento:';
        break;
      case 5:
        campo = 'data';
        instrucao = '📅 Digite a nova data (dd/mm/aaaa):';
        break;
      default:
        // Não limpar estado, deixar o usuário responder novamente
        await sock.sendMessage(userId, { 
          text: formatarMensagem({
            titulo: 'Opção inválida',
            emojiTitulo: '❌',
            secoes: [{
              titulo: 'Solução',
              itens: ['Digite um número entre 1 e 5'],
              emoji: '💡'
            }],
            dicas: [
              { texto: 'Ver histórico', comando: 'historico' },
              { texto: 'Cancelar edição', comando: '0 ou cancelar' },
              { texto: 'Ver ajuda', comando: 'ajuda' }
            ]
          })
        });
        return;
    }
    // Se for lançamento parcelado ou recorrente, perguntar se aplica só na atual ou também nas futuras
    const ehParcelado = !!contexto?.lancamento?.parcelamento_id;
    const ehRecorrente = !!contexto?.lancamento?.recorrente_id;
    await limparEstado(userId);
    if (ehParcelado) {
      await definirEstado(userId, 'aguardando_escolha_parcelado_edicao', {
        lancamentoId: contexto.lancamentoId,
        lancamento: contexto.lancamento,
        campo: campo,
        instrucao
      });
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Este lançamento é parcelado',
          emojiTitulo: '🧩',
          secoes: [{
            titulo: 'Como deseja aplicar a edição?',
            itens: [
              '1. Apenas esta parcela',
              '2. Esta e todas as futuras parcelas'
            ],
            emoji: '⚙️'
          }],
          dicas: [
            { texto: 'Cancelar edição', comando: '0 ou cancelar' }
          ]
        })
      });
    } else if (ehRecorrente) {
      await definirEstado(userId, 'aguardando_escolha_recorrente_edicao', {
        lancamentoId: contexto.lancamentoId,
        lancamento: contexto.lancamento,
        campo: campo,
        instrucao
      });
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Este lançamento é recorrente/fixo',
          emojiTitulo: '🔁',
          secoes: [{
            titulo: 'Como deseja aplicar a edição?',
            itens: [
              '1. Apenas esta recorrência',
              '2. Esta e todas as futuras recorrências'
            ],
            emoji: '⚙️'
          }],
          dicas: [
            { texto: 'Cancelar edição', comando: '0 ou cancelar' }
          ]
        })
      });
    } else {
      await definirEstado(userId, 'aguardando_valor_edicao_lancamento', {
        lancamentoId: contexto.lancamentoId,
        lancamento: contexto.lancamento,
        campo: campo,
        aplicarEmLote: false
      });
      await sock.sendMessage(userId, { 
        text: `${instrucao}\n\n💡 Digite \`0\` ou \`cancelar\` para cancelar a edição` 
      });
    }
    return;
  }

  // Se está aguardando escolha de como editar parcelas (apenas atual vs futuras também)
  if (estado?.etapa === 'aguardando_escolha_parcelado_edicao') {
    const { lancamentoId, lancamento, campo, instrucao } = estado.dadosParciais;
    const textoLower = texto.toLowerCase().trim();
    if (textoLower === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: formatarCancelamento('Edição de lançamento parcelado', [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const escolha = parseInt(texto);
    if (![1,2].includes(escolha)) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Opção inválida',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Escolha uma opção',
            itens: ['1. Apenas esta parcela', '2. Esta e futuras parcelas'],
            emoji: '💡'
          }],
          dicas: [
            { texto: 'Cancelar edição', comando: '0 ou cancelar' }
          ]
        })
      });
      return;
    }

    const aplicarEmLote = escolha === 2;
    await limparEstado(userId);
    await definirEstado(userId, 'aguardando_valor_edicao_lancamento', {
      lancamentoId,
      lancamento,
      campo,
      aplicarEmLote
    });
    await sock.sendMessage(userId, { 
      text: `${instrucao}\n\n💡 Digite \`0\` ou \`cancelar\` para cancelar a edição`
    });
    return;
  }

  // Se está aguardando escolha de como editar recorrente (apenas atual vs futuras também)
  if (estado?.etapa === 'aguardando_escolha_recorrente_edicao') {
    const { lancamentoId, lancamento, campo, instrucao } = estado.dadosParciais;
    const textoLower = texto.toLowerCase().trim();
    if (textoLower === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: formatarCancelamento('Edição de lançamento recorrente', [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const escolha = parseInt(texto);
    if (![1,2].includes(escolha)) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Opção inválida',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Escolha uma opção',
            itens: ['1. Apenas esta recorrência', '2. Esta e futuras recorrências'],
            emoji: '💡'
          }],
          dicas: [
            { texto: 'Cancelar edição', comando: '0 ou cancelar' }
          ]
        })
      });
      return;
    }

    const aplicarEmLote = escolha === 2;
    await limparEstado(userId);
    await definirEstado(userId, 'aguardando_valor_edicao_lancamento', {
      lancamentoId,
      lancamento,
      campo,
      aplicarEmLote
    });
    await sock.sendMessage(userId, { 
      text: `${instrucao}\n\n💡 Digite \`0\` ou \`cancelar\` para cancelar a edição`
    });
    return;
  }

  // Se está aguardando o novo valor para um campo
  if (estado?.etapa === 'aguardando_valor_edicao_lancamento') {
    const { lancamentoId, lancamento, campo, aplicarEmLote } = estado.dadosParciais;
    
    if (texto.toLowerCase() === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Edição de lançamento', [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver resumo do mês', comando: 'resumo' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }
    
    try {
      let novoValor = texto.trim();
      
      // Validações específicas por campo
      if (campo === 'valor') {
        const valorNumerico = parseFloat(novoValor.replace(',', '.'));
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
          await sock.sendMessage(userId, { 
            text: formatarMensagem({
              titulo: 'Valor inválido',
              emojiTitulo: '❌',
              secoes: [{
                titulo: 'Solução',
                itens: ['Digite um valor numérico válido (ex: 50.90)'],
                emoji: '💡'
              }],
              dicas: [
                { texto: 'Cancelar edição', comando: '0 ou cancelar' },
                { texto: 'Ver ajuda', comando: 'ajuda' }
              ]
            })
          });
          return;
        }
        novoValor = valorNumerico.toString();
      } else if (campo === 'data') {
        const dataRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        if (!dataRegex.test(novoValor)) {
          await sock.sendMessage(userId, { 
            text: formatarMensagem({
              titulo: 'Data inválida',
              emojiTitulo: '❌',
              secoes: [{
                titulo: 'Solução',
                itens: ['Use o formato dd/mm/aaaa (ex: 25/10/2024)'],
                emoji: '💡'
              }],
              dicas: [
                { texto: 'Cancelar edição', comando: '0 ou cancelar' },
                { texto: 'Ver ajuda', comando: 'ajuda' }
              ]
            })
          });
          return;
        }
      }
      
      // Atualizar o lançamento (único ou em lote se parcelado/recorrente)
      if (aplicarEmLote && lancamento?.parcelamento_id && lancamento?.parcela_atual != null) {
        const novosDados: any = {};
        // Reaproveita validação feita acima, apenas define campo
        novosDados[campo] = campo === 'valor' ? parseFloat(novoValor) : novoValor;
        await lancamentosService.atualizarLancamentosParceladosApartir(
          userId,
          lancamento.parcelamento_id,
          lancamento.parcela_atual,
          novosDados
        );
      } else if (aplicarEmLote && lancamento?.recorrente_id) {
        const novosDados: any = {};
        novosDados[campo] = campo === 'valor' ? parseFloat(novoValor) : novoValor;
        const dataSelecionada = (lancamento.data instanceof Date)
          ? lancamento.data.toLocaleDateString('pt-BR')
          : String(lancamento.data);
        await (lancamentosService as any).atualizarRecorrenciasApartir(
          userId,
          lancamento.recorrente_id,
          dataSelecionada,
          novosDados
        );
      } else {
        await lancamentosService.atualizarCampoLancamento(userId, lancamentoId, campo, novoValor);
      }
      
      await limparEstado(userId);
      
      const titulo = aplicarEmLote ? 'Edição aplicada em lote' : 'Lançamento atualizado com sucesso';
      const itensExtras = aplicarEmLote && (lancamento?.parcelamento_id || lancamento?.recorrente_id) ? [
        lancamento?.parcelamento_id ? `Parcelamento: ${lancamento.parcelamento_id}` : `Recorrente: ${lancamento.recorrente_id}`,
        lancamento?.parcelamento_id ? `A partir da parcela: ${lancamento.parcela_atual}` : `A partir da data: ${(lancamento.data instanceof Date) ? lancamento.data.toLocaleDateString('pt-BR') : String(lancamento.data)}`
      ] : [];
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo,
          emojiTitulo: '✅',
          secoes: [{
            titulo: 'Alteração realizada',
            itens: [
              `Campo: ${campo}`,
              `Novo valor: ${novoValor}`,
              `Lançamento: ${lancamento.descricao}`,
              ...itensExtras
            ],
            emoji: '📝'
          }],
          dicas: gerarDicasContextuais('editar')
        })
      });
      
    } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro ao atualizar lançamento');
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.ERRO_INTERNO('Atualizar lançamento', 'Tente novamente em alguns instantes')
      });
    }
    return;
  }

  // Se não há estado, processar comando de edição
  const match = texto.toLowerCase().match(/^editar\s+(\d+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Formato inválido',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Use o formato: editar <número>'],
          emoji: '💡'
        }],
        dicas: [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ]
      })
    });
    return;
  }

  const idx = parseInt(match[1]) - 1;
  // Priorizar a lista exibida no histórico, se disponível e ainda válida
  let lista;
  if (estado?.etapa === 'historico_exibido' && estado?.dadosParciais?.lista) {
    const agora = Date.now();
    const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
    if (agora - (estado.dadosParciais.timestamp || 0) <= tempoExpiracao) {
      lista = estado.dadosParciais.lista;
    }
  }

  // Fallback para buscar lançamentos recentes quando não há histórico válido
  if (!lista) {
    lista = await lancamentosService.buscarLancamentosRecentes(userId, 10);
  }
  
  if (!lista || !lista[idx]) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Índice inválido',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Envie "histórico" para listar novamente'],
          emoji: '💡'
        }],
        dicas: [
          { texto: 'Ver histórico', comando: 'historico' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ]
      })
    });
    return;
  }
  
  const lancamento = lista[idx];

  // Formatar data de exibição (ISO, Date ou string já formatada)
  let dataExibir: string;
  if (lancamento.data instanceof Date) {
    dataExibir = lancamento.data.toLocaleDateString('pt-BR');
  } else if (typeof lancamento.data === 'string' && lancamento.data.match(/^\d{4}-\d{2}-\d{2}/)) {
    dataExibir = new Date(lancamento.data).toLocaleDateString('pt-BR');
  } else {
    dataExibir = String(lancamento.data);
  }

  // Mostrar lançamento e opções de edição
  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: `Editar Lançamento ${idx + 1}`,
      emojiTitulo: '📝',
      secoes: [
        {
          titulo: 'Detalhes do Lançamento',
          itens: [
            `Data: ${dataExibir}`,
            `Valor: R$ ${formatarValor(lancamento.valor)}`,
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
  
  logger.debug?.({ id: lancamento.id }, '[EDITAR_LANCAMENTO] lancamento id');

  await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
    lancamentoId: lancamento.id,
    lancamento: lancamento,
    campo: null
  });
}

export default editarLancamentoCommand; 
import { logger } from '../infrastructure/logger';
