// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import * as cartoesService from '../services/cartoesService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function editarCartaoCommand(sock, userId, texto) {
  const textoLimpo = texto.trim().toLowerCase();
  const estado = await obterEstado(userId);

  // 1. Se está aguardando escolha do cartão
  if (estado?.etapa === 'aguardando_escolha_edicao_cartao') {
    if (textoLimpo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Edição cancelada',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Status',
            itens: ['Operação cancelada pelo usuário'],
            emoji: '🛑'
          }],
          dicas: gerarDicasContextuais('cartoes')
        })
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
            itens: [`Digite um número entre 1 e ${cartoes.length} ou "cancelar"`],
            emoji: '💡'
          }],
          dicas: gerarDicasContextuais('cartoes')
        })
      });
      return;
    }

    const cartaoEscolhido = cartoes[idx - 1];
    await definirEstado(userId, 'aguardando_campo_edicao_cartao', { cartaoEscolhido });
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Editar Cartão',
        emojiTitulo: '💳',
        secoes: [{
          titulo: 'Opções de Edição',
          itens: [
            '1. Vencimento',
            '2. Fechamento',
            '3. Cancelar'
          ],
          emoji: '⚙️'
        }],
        dicas: [
          { texto: 'Digite o número da opção', comando: '1, 2 ou 3' },
          { texto: 'Cancelar edição', comando: 'cancelar' }
        ]
      })
    });
    return;
  }

  // 2. Se está aguardando escolha do campo
  if (estado?.etapa === 'aguardando_campo_edicao_cartao') {
    let campo = textoLimpo;
    if (["1", "vencimento"].includes(campo)) campo = 'vencimento';
    else if (["2", "fechamento"].includes(campo)) campo = 'fechamento';
    else if (["3", "cancelar"].includes(campo)) campo = 'cancelar';

    if (campo === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Edição cancelada',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Status',
            itens: ['Operação cancelada pelo usuário'],
            emoji: '🛑'
          }],
          dicas: gerarDicasContextuais('cartoes')
        })
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
          dicas: gerarDicasContextuais('cartoes')
        })
      });
      return;
    }

    const dados = {
      ...estado.dadosParciais,
      campoEscolhido: campo
    };

    await definirEstado(userId, 'aguardando_novo_valor_edicao_cartao', dados);
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Editar Cartão',
        emojiTitulo: '💳',
        secoes: [{
          titulo: 'Instrução',
          itens: [`Digite o novo dia de ${campo} (1-31)`],
          emoji: '📝'
        }],
        dicas: [
          { texto: 'Digite um número entre 1 e 31', comando: 'exemplo: 15' },
          { texto: 'Cancelar edição', comando: 'cancelar' }
        ]
      })
    });
    return;
  }

  // 3. Se está aguardando o novo valor
  if (estado?.etapa === 'aguardando_novo_valor_edicao_cartao') {
    const campo = estado.dadosParciais.campoEscolhido;
    const cartao = estado.dadosParciais.cartaoEscolhido;

    const dia = parseInt(texto);
    if (isNaN(dia) || dia < 1 || dia > 31) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Dia inválido',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: [`Digite um número entre 1 e 31 para ${campo}`],
            emoji: '💡'
          }],
          dicas: gerarDicasContextuais('cartoes')
        })
      });
      return;
    }

    // Atualizar campo
    let novoVencimento = cartao.dia_vencimento;
    let novoFechamento = cartao.dia_fechamento;
    if (campo === 'vencimento') novoVencimento = dia;
    if (campo === 'fechamento') novoFechamento = dia;

    await cartoesService.atualizarCartaoConfigurado(userId, cartao.nome_cartao, novoVencimento, novoFechamento);

    await limparEstado(userId);
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Cartão atualizado com sucesso',
        emojiTitulo: '✅',
        secoes: [{
          titulo: 'Detalhes do Cartão',
          itens: [
            `Cartão: ${cartao.nome_cartao}`,
            `Vencimento: dia ${novoVencimento}`,
            `Fechamento: dia ${novoFechamento}`
          ],
          emoji: '💳'
        }],
        dicas: gerarDicasContextuais('cartoes')
      })
    });
    return;
  }

  // 4. Início do fluxo: listar cartões
  const cartoes = await cartoesService.listarCartoesConfigurados(userId);
  if (!cartoes || cartoes.length === 0) {
    await sock.sendMessage(userId, { 
      text: formatarMensagem({
        titulo: 'Nenhum cartão configurado',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Configure um cartão primeiro'],
          emoji: '💡'
        }],
        dicas: gerarDicasContextuais('cartoes')
      })
    });
    return;
  }

  let msgCartoes = 'Qual cartão deseja editar?\n';
  cartoes.forEach((cartao, idx) => {
    msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
  });
  msgCartoes += '\nDigite o número do cartão ou "cancelar"';

  await definirEstado(userId, 'aguardando_escolha_edicao_cartao', { cartoes });
  await sock.sendMessage(userId, { text: msgCartoes });
}

export default editarCartaoCommand;
