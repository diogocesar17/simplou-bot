// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import * as cartoesService from '../services/cartoesService';
import { formatarMensagem, gerarDicasContextuais, formatarCancelamento, formatarMenuComCancelamento } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function editarCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando escolha do cartão
  if (estado?.etapa === 'aguardando_escolha_edicao_cartao') {
    if (textoLimpo === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Edição de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Configurar cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const idx = parseInt(texto);
    const cartoes = estado.dadosParciais.cartoes;

    if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Escolha inválida',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: [`Digite um número entre 1 e ${cartoes.length} ou "0" para cancelar`],
            emoji: '💡'
          }],
          dicas: [
            { texto: 'Ver cartões disponíveis', comando: 'cartoes' },
            { texto: 'Cancelar operação', comando: '0 ou cancelar' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
      return;
    }

    const cartaoEscolhido = cartoes[idx - 1];
    await definirEstado(userId, 'aguardando_campo_edicao_cartao', { cartaoEscolhido });
    await sock.sendMessage(userId, {
      text: formatarMenuComCancelamento(
        `Editar Cartão: ${cartaoEscolhido.nome_cartao}`,
        [
          'Vencimento',
          'Fechamento'
        ],
        'Escolha o campo que deseja editar',
        true
      )
    });
    return;
  }

  // 2. Se está aguardando escolha do campo
  if (estado?.etapa === 'aguardando_campo_edicao_cartao') {
    let campo = textoLimpo;
    if (["1", "vencimento"].includes(campo)) campo = 'vencimento';
    else if (["2", "fechamento"].includes(campo)) campo = 'fechamento';
    else if (["3", "cancelar"].includes(campo)) campo = 'cancelar';

    if (campo === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Edição de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Configurar cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    if (!['vencimento', 'fechamento'].includes(campo)) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Campo inválido',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: ['Digite: 1, 2, 3 ou o nome do campo'],
            emoji: '💡'
          }],
          dicas: [
            { texto: 'Ver cartões', comando: 'cartoes' },
            { texto: 'Cancelar edição', comando: '0 ou cancelar' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
      return;
    }

    const dados = {
      ...estado.dadosParciais,
      campoEscolhido: campo
    };

    await definirEstado(userId, 'aguardando_novo_valor_edicao_cartao', dados);
    
    const instrucao = campo === 'vencimento' 
      ? `📅 Digite o novo dia de vencimento para ${dados.cartaoEscolhido.nome_cartao} (1-31):`
      : `📅 Digite o novo dia de fechamento para ${dados.cartaoEscolhido.nome_cartao} (1-31):`;
    
    await sock.sendMessage(userId, { 
      text: `${instrucao}\n\n💡 Digite \`0\` ou \`cancelar\` para cancelar a edição` 
    });
    return;
  }

  // 3. Se está aguardando o novo valor
  if (estado?.etapa === 'aguardando_novo_valor_edicao_cartao') {
    if (textoLimpo === 'cancelar' || texto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarCancelamento('Edição de cartão', [
          { texto: 'Ver cartões', comando: 'cartoes' },
          { texto: 'Configurar cartão', comando: 'configurar cartao' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ])
      });
      return;
    }

    const dia = parseInt(texto.trim());
    if (isNaN(dia) || dia < 1 || dia > 31) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Dia inválido',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: ['Digite um número entre 1 e 31'],
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

    const { cartaoEscolhido, campoEscolhido } = estado.dadosParciais;
    
    try {
      if (campoEscolhido === 'vencimento') {
        await cartoesService.atualizarVencimentoCartao(userId, cartaoEscolhido.nome_cartao, dia);
      } else {
        await cartoesService.atualizarFechamentoCartao(userId, cartaoEscolhido.nome_cartao, dia);
      }
      
      await limparEstado(userId);
      
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Cartão atualizado com sucesso',
          emojiTitulo: '✅',
          secoes: [{
            titulo: 'Alteração realizada',
            itens: [
              `Cartão: ${cartaoEscolhido.nome_cartao}`,
              `${campoEscolhido === 'vencimento' ? 'Vencimento' : 'Fechamento'}: dia ${dia}`
            ],
            emoji: '💳'
          }],
          dicas: gerarDicasContextuais('cartoes')
        })
      });
    } catch (error) {
      console.error('Erro ao atualizar cartão:', error);
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: ERROR_MESSAGES.ERRO_INTERNO('Atualizar cartão', 'Tente novamente em alguns instantes')
      });
    }
    return;
  }

  // 4. Início do fluxo
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

  await definirEstado(userId, 'aguardando_escolha_edicao_cartao', { cartoes });
  
  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: 'Escolha o cartão para editar',
      emojiTitulo: '✏️',
      secoes: [{
        titulo: 'Cartões disponíveis',
        itens: cartoes.map((cartao, index) => 
          `${index + 1}. ${cartao.nome_cartao} (vencimento: dia ${cartao.dia_vencimento})`
        ),
        emoji: '💳'
      }],
      dicas: [
        { texto: 'Digite o número do cartão', comando: '1, 2, 3...' },
        { texto: 'Cancelar edição', comando: '0 ou cancelar' }
      ]
    })
  });
}

export default editarCartaoCommand;
