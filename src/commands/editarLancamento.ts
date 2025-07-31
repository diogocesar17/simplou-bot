// @ts-nocheck
import * as lancamentosService from '../services/lancamentosService';
import { formatarValor } from '../utils/formatUtils';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';


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
        await sock.sendMessage(userId, { text: '❌ Opção inválida. Digite um número entre 1 e 5.' });
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
          await sock.sendMessage(userId, { text: '❌ Valor inválido. Digite um número positivo.' });
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
          await sock.sendMessage(userId, { text: '❌ Data inválida. Use o formato dd/mm/aaaa' });
          return;
        }
        novosDados.data = texto.split('/').reverse().join('-');
        break;
        
      default:
        await sock.sendMessage(userId, { text: '❌ Campo inválido para edição.' });
        return;
    }
    
    try {
      // Atualizar no banco
      await lancamentosService.atualizarLancamentoPorId(userId, contexto.lancamentoId, novosDados);
      
      await sock.sendMessage(userId, { 
        text: `✅ Lançamento editado com sucesso!\n\n` +
          `📅 Data: ${novosDados.data}\n` +
          `💰 Valor: R$ ${formatarValor(novosDados.valor)}\n` +
          `📂 Categoria: ${novosDados.categoria}\n` +
          `💳 Pagamento: ${novosDados.pagamento}\n` +
          `📝 Descrição: ${novosDados.descricao}`
      });
    } catch (error) {
      await sock.sendMessage(userId, { text: '❌ Erro ao editar lançamento. Tente novamente.' });
    }
    return;
  }

  // Comando inicial: editar [número]
  const match = texto.toLowerCase().match(/^editar\s+(\d+)$/i);
  if (!match) {
    await sock.sendMessage(userId, { text: '❌ Use: editar [número]. Exemplo: editar 2' });
    return;
  }
  
  // Verificar se há um histórico exibido no estado
  const estadoHistorico = await obterEstado(userId);
  if (!estadoHistorico || estadoHistorico.etapa !== 'historico_exibido') {
    await sock.sendMessage(userId, { 
      text: '❌ Execute "histórico" primeiro para ver a lista de lançamentos disponíveis para edição.' 
    });
    return;
  }
  
  // Verificar se o estado não expirou (mais de 10 minutos)
  const agora = Date.now();
  const tempoExpiracao = 10 * 60 * 1000; // 10 minutos
  if (agora - estadoHistorico.dadosParciais.timestamp > tempoExpiracao) {
    await limparEstado(userId);
    await sock.sendMessage(userId, { 
      text: '❌ A lista expirou. Execute "histórico" novamente para ver os lançamentos.' 
    });
    return;
  }
  
  const idx = parseInt(match[1], 10) - 1;
  const lista = estadoHistorico.dadosParciais.lista;
  
  if (!lista || !lista[idx]) {
    await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
    return;
  }
  
  const lancamento = lista[idx];
  
  // Mostrar lançamento e opções de edição
  let msg = `📝 *Editar Lançamento ${idx + 1}*\n\n`;
  msg += `📅 Data: ${lancamento.data}\n`;
  msg += `💰 Valor: R$ ${formatarValor(lancamento.valor)}\n`;
  msg += `📂 Categoria: ${lancamento.categoria}\n`;
  msg += `💳 Pagamento: ${lancamento.pagamento}\n`;
  msg += `📝 Descrição: ${lancamento.descricao}\n\n`;
  msg += `*O que você quer editar?*\n\n`;
  msg += `1. Valor\n`;
  msg += `2. Categoria\n`;
  msg += `3. Descrição\n`;
  msg += `4. Forma de pagamento\n`;
  msg += `5. Data\n\n`;
  msg += `Digite o número da opção:`;
  
  console.log('lancamento: ', lancamento.id);

  await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
    lancamentoId: lancamento.id,
    lancamento: lancamento,
    campo: null
  });
  
  await sock.sendMessage(userId, { text: msg });
  
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