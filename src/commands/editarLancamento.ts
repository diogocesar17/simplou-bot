// @ts-nocheck
import * as lancamentosService from '../services/lancamentosService';
import { formatarValor } from '../utils/formatUtils';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';


async function editarLancamentoCommand(sock, userId, texto) {
  const estado = await obterEstado(userId);

  // Se está aguardando edição de um campo específico
  if (estado?.etapa === 'aguardando_campo_edicao_lancamento') {
    const contexto = estado.dadosParciais;
    await limparEstado(userId);
    
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
        await sock.sendMessage(userId, { 
          text: formatarMensagem({
            titulo: 'Opção inválida',
            emojiTitulo: '❌',
            secoes: [{
              titulo: 'Solução',
              itens: ['Digite um número entre 1 e 5'],
              emoji: '💡'
            }],
            dicas: gerarDicasContextuais('editar')
          })
        });
        return;
    }
    
    await definirEstado(userId, 'aguardando_valor_edicao_lancamento', {
      lancamentoId: contexto.lancamentoId,
      lancamento: contexto.lancamento,
      campo: campo
    });
    
    await sock.sendMessage(userId, { text: instrucao });
    return;
  }

  // Se está aguardando valor de um campo específico
  if (estado?.etapa === 'aguardando_valor_edicao_lancamento') {
    console.log('aguardando_valor_edicao_lancamento');
    const contexto = estado.dadosParciais;
    await limparEstado(userId);
    
    // Processar a edição
    const novosDados = { ...contexto.lancamento };
    
    switch (contexto.campo) {
      case 'valor':
        const novoValor = parseFloat(texto.replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (isNaN(novoValor) || novoValor <= 0) {
          await sock.sendMessage(userId, { 
            text: formatarMensagem({
              titulo: 'Valor inválido',
              emojiTitulo: '❌',
              secoes: [{
                titulo: 'Solução',
                itens: ['Digite um número positivo'],
                emoji: '💡'
              }],
              dicas: gerarDicasContextuais('editar')
            })
          });
          return;
        }
        novosDados.valor = novoValor;
        break;
        
      case 'categoria':
        novosDados.categoria = texto.trim();
        break;
        
      case 'descricao':
        novosDados.descricao = texto.trim();
        break;
        
      case 'pagamento':
        novosDados.pagamento = texto.trim();
        break;
        
      case 'data':
        const dataRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        if (!dataRegex.test(texto)) {
          await sock.sendMessage(userId, { 
            text: formatarMensagem({
              titulo: 'Data inválida',
              emojiTitulo: '❌',
              secoes: [{
                titulo: 'Solução',
                itens: ['Use o formato dd/mm/aaaa'],
                emoji: '💡'
              }],
              dicas: gerarDicasContextuais('editar')
            })
          });
          return;
        }
        novosDados.data = texto.split('/').reverse().join('-');
        break;
        
      default:
        await sock.sendMessage(userId, { 
          text: formatarMensagem({
            titulo: 'Campo inválido',
            emojiTitulo: '❌',
            secoes: [{
              titulo: 'Solução',
              itens: ['Campo não permitido para edição'],
              emoji: '💡'
            }],
            dicas: gerarDicasContextuais('editar')
          })
        });
        return;
    }
    
    try {
      // Atualizar no banco
      await lancamentosService.atualizarLancamentoPorId(userId, contexto.lancamentoId, novosDados);
      
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Lançamento editado com sucesso',
          emojiTitulo: '✅',
          secoes: [{
            titulo: 'Detalhes do Lançamento',
            itens: [
              `Data: ${novosDados.data}`,
              `Valor: R$ ${formatarValor(novosDados.valor)}`,
              `Categoria: ${novosDados.categoria}`,
              `Pagamento: ${novosDados.pagamento}`,
              `Descrição: ${novosDados.descricao}`
            ],
            emoji: '📝'
          }],
          dicas: gerarDicasContextuais('editar')
        })
      });
    } catch (error) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Erro ao editar lançamento',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: ['Tente novamente em alguns instantes'],
            emoji: '💡'
          }],
          dicas: gerarDicasContextuais('editar')
        })
      });
    }
    return;
  }

  // Comando inicial: editar [número]
  const match = texto.toLowerCase().match(/^editar\s+(\d+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Formato inválido',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Use: editar [número]'],
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
  
  // Verificar se há um histórico exibido no estado
  const estadoHistorico = await obterEstado(userId);
  if (!estadoHistorico || estadoHistorico.etapa !== 'historico_exibido') {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Estado inválido',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Execute "histórico" primeiro para ver os lançamentos'],
          emoji: '💡'
        }],
        dicas: gerarDicasContextuais('editar')
      })
    });
    return;
  }
  
  // Verificar se o estado não expirou (mais de 10 minutos)
  const agora = Date.now();
  const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
  if (agora - estadoHistorico.dadosParciais.timestamp > tempoExpiracao) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Lista expirada',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Execute "histórico" novamente para ver os lançamentos'],
          emoji: '💡'
        }],
        dicas: gerarDicasContextuais('editar')
      })
    });
    return;
  }
  
  const idx = parseInt(match[1], 10) - 1;
  const lista = estadoHistorico.dadosParciais.lista;
  
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
        dicas: gerarDicasContextuais('editar')
      })
    });
    return;
  }
  
  const lancamento = lista[idx];
  
  // Mostrar lançamento e opções de edição
  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: `Editar Lançamento ${idx + 1}`,
      emojiTitulo: '📝',
      secoes: [
        {
          titulo: 'Detalhes do Lançamento',
          itens: [
            `Data: ${lancamento.data}`,
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
        { texto: 'Cancelar edição', comando: 'cancelar' }
      ]
    })
  });
  
  console.log('lancamento: ', lancamento.id);

  await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
    lancamentoId: lancamento.id,
    lancamento: lancamento,
    campo: null
  });
  
  // // Aguardar escolha do campo
  // const aguardandoEscolha = {};
  // aguardandoEscolha[userId] = {
  //   lancamentoId: lancamento.id,
  //   lancamento: lancamento
  // };
  
  // // Interceptar próxima mensagem para processar escolha
  // const processarEscolha = async (sock, userId, texto) => {
  //   const estado = await obterEstado(userId);
  //   if (estado?.etapa === 'aguardando_campo_edicao_lancamento') {
  //     const contexto = estado.dados;
  //     await limparEstado(userId);
      
  //     const escolha = parseInt(texto);
  //     let campo = null;
  //     let instrucao = '';
      
  //     switch (escolha) {
  //       case 1:
  //         campo = 'valor';
  //         instrucao = '💰 Digite o novo valor:';
  //         break;
  //       case 2:
  //         campo = 'categoria';
  //         instrucao = '📂 Digite a nova categoria:';
  //         break;
  //       case 3:
  //         campo = 'descricao';
  //         instrucao = '📝 Digite a nova descrição:';
  //         break;
  //       case 4:
  //         campo = 'pagamento';
  //         instrucao = '💳 Digite a nova forma de pagamento:';
  //         break;
  //       case 5:
  //         campo = 'data';
  //         instrucao = '📅 Digite a nova data (dd/mm/aaaa):';
  //         break;
  //       default:
  //         await sock.sendMessage(userId, { text: '❌ Opção inválida. Digite um número entre 1 e 5.' });
  //         return;
  //     }
      
  //     await definirEstado(userId, 'aguardando_valor_edicao_lancamento', {
  //       lancamentoId: contexto.lancamentoId,
  //       lancamento: contexto.lancamento,
  //       campo: campo
  //     });
      
  //     await sock.sendMessage(userId, { text: instrucao });
  //   }
  // };
  
  // // Processar escolha na próxima mensagem
  // setTimeout(() => {
  //   if (aguardandoEscolha[userId]) {
  //     processarEscolha(sock, userId, texto);
  //   }
  // }, 100);
}

export default editarLancamentoCommand; 