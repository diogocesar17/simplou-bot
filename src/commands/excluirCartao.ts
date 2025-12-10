// @ts-nocheck
import * as cartoesService from '../services/cartoesService';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import { formatarMensagem, formatarConfirmacao, gerarDicasContextuais, formatarCancelamento } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';


// Fluxo 100% baseado em Redis (stateManager)

async function excluirCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);
  console.log('estado excluir cartao', estado);
  console.log('texto excluir cartao', texto);

  // 1. Se está aguardando escolha do cartão
  if (estado?.etapa === 'aguardando_escolha_exclusao_cartao') {
    const escolha = texto.trim();
    if (escolha.toLowerCase() === 'cancelar' || escolha === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Exclusão de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Configurar cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }
    const idx = parseInt(escolha);
    const cartoes = estado.dadosParciais.cartoes;
    
    if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.VALOR_INVALIDO('Escolha', `Entre 1 e ${cartoes.length}`, `1, 2, 3, 0 ou cancelar`)
      });
      return;
    }
    const cartaoEscolhido = cartoes[idx - 1];
    // Verificar lançamentos associados
    const totalLancamentos = await cartoesService.contarLancamentosAssociadosCartao(userId, cartaoEscolhido.nome_cartao);
    
    // Aguardar confirmação
    await definirEstado(userId, 'aguardando_confirmacao_exclusao_cartao', {
      cartaoEscolhido,
      totalLancamentos
    });
    
    await sock.sendMessage(userId, { 
      text: formatarConfirmacao(
        'Confirmar exclusão de cartão',
        [
          `Nome: ${cartaoEscolhido.nome_cartao}`,
          `Vencimento: dia ${cartaoEscolhido.dia_vencimento}`,
          `Fechamento: dia ${cartaoEscolhido.dia_fechamento}`,
          `Lançamentos associados: ${totalLancamentos}`
        ],
        ['1 - Confirmar', '2 - Cancelar'],
        'Detalhes do cartão'
      )
    });
    return;
  }

  // 2. Se está aguardando confirmação
  if (estado?.etapa === 'aguardando_confirmacao_exclusao_cartao') {
    console.log('estado confirmacao cartao', estado);
    console.log('texto confirmacao cartao', texto);
    const confirmacao = texto.trim().toLowerCase();
    if (confirmacao === 'cancelar' || confirmacao === '2' || confirmacao === 'nao' || confirmacao === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Exclusão de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Configurar cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }
    if (confirmacao !== 'sim' && confirmacao !== '1') {
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.VALOR_INVALIDO('Confirmação', '1 - Confirmar, 2 - Cancelar', '1, 2, sim, nao, 0 ou cancelar')
      });
      return;
    }
    const cartao = estado.dadosParciais.cartaoEscolhido;
    const totalLancamentos = estado.dadosParciais.totalLancamentos;
    await cartoesService.excluirCartaoConfigurado(userId, cartao.nome_cartao);
    await limparEstado(userId);
    
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Cartão excluído com sucesso',
        emojiTitulo: '✅',
        secoes: [
          {
            titulo: 'Detalhes do cartão excluído',
            itens: [
              `Nome: ${cartao.nome_cartao}`,
              `Vencimento: dia ${cartao.dia_vencimento}`,
              `Fechamento: dia ${cartao.dia_fechamento}`,
              `Lançamentos associados: ${totalLancamentos}`
            ],
            emoji: '💳'
          }
        ],
        dicas: gerarDicasContextuais('cartoes')
      })
    });
    return;
  }

  // 3. Início do fluxo
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum cartão configurado',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Configure seu primeiro cartão para começar'],
          emoji: '💡'
        }],
        dicas: [
          { texto: 'Configurar cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ]
      })
    });
    return;
  }

  await definirEstado(userId, 'aguardando_escolha_exclusao_cartao', { cartoes });
  
  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Escolha o cartão para excluir',
      emojiTitulo: '🗑️',
      secoes: [{
        titulo: 'Cartões disponíveis',
        itens: cartoes.map((cartao, index) => 
          `${index + 1}. ${cartao.nome_cartao} (vencimento: dia ${cartao.dia_vencimento})`
        ),
        emoji: '💳'
      }],
      dicas: [
        { texto: 'Digite o número do cartão', comando: '1, 2, 3...' },
        { texto: 'Cancelar exclusão', comando: '0 ou cancelar' }
      ]
    })
  });
}

export default excluirCartaoCommand; 
