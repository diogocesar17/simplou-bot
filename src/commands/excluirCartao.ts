import * as cartoesService from '../services/cartoesService';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import { formatarMensagem, formatarConfirmacao, gerarDicasContextuais, formatarCancelamento } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';
import { logger } from '../infrastructure/logger';


// Fluxo 100% baseado em Redis (stateManager)

async function excluirCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);
  logger.debug?.({ estado }, '[EXCLUIR_CARTAO] estado inicial');
  logger.info({ trecho: String(texto || '').slice(0, 80) }, '[EXCLUIR_CARTAO] texto recebido');

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
    const cartoes = (estado.dadosParciais as any).cartoes;
    
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

    await sock.sendInteractiveMessage(userId, {
      type: 'button',
      header: '🗑️ Confirmar exclusão de cartão?',
      body:
        `💳 ${cartaoEscolhido.nome_cartao}\n` +
        `📅 Vencimento: dia ${cartaoEscolhido.dia_vencimento}\n` +
        `🔒 Fechamento: dia ${cartaoEscolhido.dia_fechamento}\n` +
        `📊 Lançamentos associados: ${totalLancamentos}`,
      footer: '⚠️ Esta ação não pode ser desfeita!',
      buttons: [
        { id: '1', title: '✅ Confirmar' },
        { id: '2', title: '❌ Cancelar' },
      ],
    });
    return;
  }

  // 2. Se está aguardando confirmação
  if (estado?.etapa === 'aguardando_confirmacao_exclusao_cartao') {
  logger.debug?.({ estado }, '[EXCLUIR_CARTAO] estado confirmação');
  logger.info({ trecho: String(texto || '').slice(0, 80) }, '[EXCLUIR_CARTAO] texto confirmação');
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
    const cartao = (estado.dadosParciais as any).cartaoEscolhido;
    const totalLancamentos = (estado.dadosParciais as any).totalLancamentos;
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

  await sock.sendInteractiveMessage(userId, {
    type: 'list',
    header: '🗑️ Escolha o cartão para excluir',
    body: 'Selecione o cartão que deseja excluir:',
    footer: '⚠️ Esta ação não pode ser desfeita!',
    buttonLabel: 'Ver cartões',
    sections: [{
      rows: [
        ...cartoes.map((cartao: any, index: number) => ({
          id: String(index + 1),
          title: cartao.nome_cartao,
          description: `Vencimento: dia ${cartao.dia_vencimento}`,
        })),
        { id: '0', title: '❌ Cancelar' },
      ],
    }],
  });
}

export default excluirCartaoCommand;
