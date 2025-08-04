// @ts-nocheck
import * as cartoesService from '../services/cartoesService';
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import { formatarMensagem, formatarConfirmacao, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';


// Contexto simples em memória
const aguardandoExclusaoCartao = {};

async function excluirCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);
  console.log('estado excluir cartao', estado);
  console.log('texto excluir cartao', texto);

  // 1. Se está aguardando escolha do cartão
  if (estado?.etapa === 'aguardando_escolha_exclusao_cartao') {
    const escolha = texto.trim();
    if (escolha.toLowerCase() === 'cancelar') {
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
            { texto: 'Ver cartões', comando: 'cartoes' },
            { texto: 'Configurar cartão', comando: 'configurar cartao' }
          ]
        })
      });
      return;
    }
    const idx = parseInt(escolha);
    const cartoes = estado.dadosParciais.cartoes;
    
    if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.VALOR_INVALIDO('Escolha', `Entre 1 e ${cartoes.length}`, `1, 2, 3, cancelar`)
      });
      return;
    }
    const cartaoEscolhido = cartoes[idx - 1];
    // Verificar lançamentos associados
    const totalLancamentos = await cartoesService.contarLancamentosAssociadosCartao(userId, cartaoEscolhido.nome_cartao);
    
    await definirEstado(userId, 'aguardando_confirmacao_exclusao_cartao', { cartaoEscolhido, totalLancamentos });
    
    await sock.sendMessage(userId, { 
      text: formatarConfirmacao(
        'Confirmar Exclusão de Cartão',
        [
          `💳 Cartão: ${cartaoEscolhido.nome_cartao}`,
          `📅 Vencimento: dia ${cartaoEscolhido.dia_vencimento}`,
          cartaoEscolhido.dia_fechamento ? `📅 Fechamento: dia ${cartaoEscolhido.dia_fechamento}` : `📅 Fechamento: NÃO INFORMADO`,
          `📊 Lançamentos associados: ${totalLancamentos}`,
          totalLancamentos > 0 ? `⚠️ Este cartão possui ${totalLancamentos} lançamento(s) associado(s)` : `✅ Nenhum lançamento associado`
        ],
        ['Confirmar', 'Cancelar'],
      'Dados do Cartão'
      )
    });
    return;
  }
  // 2. Se está aguardando confirmação
  if (estado?.etapa === 'aguardando_confirmacao_exclusao_cartao') {
    console.log('estado confirmacao cartao', estado);
    console.log('texto confirmacao cartao', texto);
    const confirmacao = texto.trim().toLowerCase();
    if (confirmacao === 'cancelar' || confirmacao === '2' || confirmacao === 'nao') {
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
          dicas: gerarDicasContextuais('cartoes')
        })
      });
      return;
    }
    if (confirmacao !== 'sim' && confirmacao !== '1') {
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.VALOR_INVALIDO('Confirmação', '1 - Confirmar, 2 - Cancelar', '1, 2, sim, nao, cancelar')
      });
      return;
    }
    const cartao = estado.dadosParciais.cartaoEscolhido;
    const totalLancamentos = estado.dadosParciais.totalLancamentos;
    await cartoesService.excluirCartaoConfigurado(userId, cartao.nome_cartao);
    
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Cartão excluído com sucesso',
        emojiTitulo: '✅',
        secoes: [
          {
            titulo: 'Detalhes do Cartão',
            itens: [
              `Cartão: ${cartao.nome_cartao}`,
              `Lançamentos associados: ${totalLancamentos}`
            ],
            emoji: '💳'
          },
          totalLancamentos > 0 ? {
            titulo: 'Informação',
            itens: [
              `Os ${totalLancamentos} lançamento(s) associado(s) continuam no sistema`,
              'Para limpar completamente, edite os lançamentos individualmente'
            ],
            emoji: 'ℹ️'
          } : null
        ].filter(Boolean),
                  dicas: gerarDicasContextuais('cartoes')
      })
    });
    await limparEstado(userId);
    return;
  }
  // 3. Início do fluxo: listar cartões
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum cartão configurado',
        emojiTitulo: '❌',
        dicas: [
          { texto: 'Configurar primeiro cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ]
      })
    });
    return;
  }
  
  const itensCartoes = cartoes.map((cartao, idx) => {
    const fechamento = cartao.dia_fechamento ? `fecha dia ${cartao.dia_fechamento}` : 'fechamento NÃO INFORMADO';
    return `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, ${fechamento})`;
  });
  
  await definirEstado(userId, 'aguardando_escolha_exclusao_cartao', { cartoes });
  await sock.sendMessage(userId, { 
    text: formatarMensagem({
      titulo: 'Escolher Cartão para Excluir',
      emojiTitulo: '🗑️',
      secoes: [
        {
          titulo: 'Cartões Disponíveis',
          itens: itensCartoes,
          emoji: '💳'
        }
      ],
      dicas: [
        { texto: 'Digite o número do cartão', comando: '1, 2, 3...' },
        { texto: 'Cancelar operação', comando: 'cancelar' }
      ],
      ajuda: 'Digite o número do cartão que deseja excluir ou "cancelar"'
    })
  });
}

export default excluirCartaoCommand; 