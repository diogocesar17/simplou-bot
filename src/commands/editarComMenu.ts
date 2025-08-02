// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import editarLancamentoCommand from './editarLancamento';
import editarCartaoCommand from './editarCartao';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function editarComMenuCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);

  // Se está aguardando escolha do tipo de edição
  if (estado?.etapa === 'aguardando_tipo_edicao') {
    if (textoLower === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: ERROR_MESSAGES.OPERACAO_CANCELADA('Edição') });
      return;
    }

    const escolha = parseInt(texto);
    
    switch (escolha) {
      case 1:
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: '📝 *Editar Lançamento*\n\n💡 Para editar um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "editar <número>"\n\n📋 Exemplo:\n• histórico\n• editar 2' 
        });
        return;
        
      case 2:
        await limparEstado(userId);
        await editarCartaoCommand(sock, userId, 'editar cartão');
        return;
        
      default:
        await sock.sendMessage(userId, { 
          text: ERROR_MESSAGES.VALOR_INVALIDO('Opção', '1 - para editar lançamento\n2 - para editar cartão\ncancelar - para cancelar') 
        });
        return;
    }
  }

  // Se o usuário digitou apenas "editar"
  if (textoLower === 'editar') {
    await definirEstado(userId, 'aguardando_tipo_edicao');
    await sock.sendMessage(userId, {
      text: '✏️ *O que você quer editar?*\n\n1️⃣ *Lançamento* - editar valor, categoria, data, etc.\n2️⃣ *Cartão* - editar vencimento, fechamento\n\n💡 Digite o número da opção ou "cancelar"'
    });
    return;
  }

  // Se o usuário digitou "editar lançamento" ou "editar cartão"
  if (textoLower === 'editar lancamento' || textoLower === 'editar lançamento') {
    await sock.sendMessage(userId, { 
      text: '📝 *Editar Lançamento*\n\n💡 Para editar um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "editar <número>"\n\n📋 Exemplo:\n• histórico\n• editar 2' 
    });
    return;
  }

  if (textoLower === 'editar cartao' || textoLower === 'editar cartão') {
    await editarCartaoCommand(sock, userId, texto);
    return;
  }

  // Se o usuário digitou "editar <número>", redirecionar para editar lançamento
  if (/^editar\s+\d+$/i.test(textoLower)) {
    await editarLancamentoCommand(sock, userId, texto);
    return;
  }

  // Se chegou até aqui, mostrar menu padrão
  await definirEstado(userId, 'aguardando_tipo_edicao');
  await sock.sendMessage(userId, {
    text: '✏️ *O que você quer editar?*\n\n1️⃣ *Lançamento* - editar valor, categoria, data, etc.\n2️⃣ *Cartão* - editar vencimento, fechamento\n\n💡 Digite o número da opção ou "cancelar"'
  });
}

export default editarComMenuCommand; 