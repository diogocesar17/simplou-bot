// @ts-nocheck
import { definirEstado, obterEstado, limparEstado } from './../configs/stateManager';
import excluirLancamentoCommand from './excluirLancamento';
import excluirCartaoCommand from './excluirCartao';

async function excluirComMenuCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  const estado = await obterEstado(userId);

  // Se está aguardando escolha do tipo de exclusão
  if (estado?.etapa === 'aguardando_tipo_exclusao') {
    if (textoLower === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { text: '❌ Exclusão cancelada.' });
      return;
    }

    const escolha = parseInt(texto);
    
    switch (escolha) {
      case 1:
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: '🗑️ *Excluir Lançamento*\n\n💡 Para excluir um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "excluir <número>"\n\n📋 Exemplo:\n• histórico\n• excluir 2' 
        });
        return;
        
      case 2:
        await limparEstado(userId);
        await excluirCartaoCommand(sock, userId, 'excluir cartão');
        return;
        
      default:
        await sock.sendMessage(userId, { 
          text: '❌ Opção inválida. Digite:\n• 1 - para excluir lançamento\n• 2 - para excluir cartão\n• cancelar - para cancelar' 
        });
        return;
    }
  }

  // Se o usuário digitou apenas "excluir"
  if (textoLower === 'excluir') {
    await definirEstado(userId, 'aguardando_tipo_exclusao');
    await sock.sendMessage(userId, {
      text: '🗑️ *O que você quer excluir?*\n\n1️⃣ *Lançamento* - excluir gasto, receita, etc.\n2️⃣ *Cartão* - excluir configuração de cartão\n\n⚠️ *Atenção:* Esta ação não pode ser desfeita!\n\n💡 Digite o número da opção ou "cancelar"'
    });
    return;
  }

  // Se o usuário digitou "excluir lançamento"
  if (textoLower === 'excluir lancamento' || textoLower === 'excluir lançamento') {
    await sock.sendMessage(userId, { 
      text: '🗑️ *Excluir Lançamento*\n\n💡 Para excluir um lançamento:\n1️⃣ Primeiro use "histórico" para ver os lançamentos\n2️⃣ Depois use "excluir <número>"\n\n📋 Exemplo:\n• histórico\n• excluir 2' 
    });
    return;
  }

  // Se o usuário digitou "excluir cartão"
  if (textoLower === 'excluir cartao' || textoLower === 'excluir cartão') {
    await excluirCartaoCommand(sock, userId, texto);
    return;
  }

  // Se o usuário digitou "excluir <número>", redirecionar para excluir lançamento
  if (/^excluir\s+\d+$/i.test(textoLower)) {
    await excluirLancamentoCommand(sock, userId, texto);
    return;
  }

  // Se chegou até aqui, mostrar menu padrão
  await definirEstado(userId, 'aguardando_tipo_exclusao');
  await sock.sendMessage(userId, {
    text: '🗑️ *O que você quer excluir?*\n\n1️⃣ *Lançamento* - excluir gasto, receita, etc.\n2️⃣ *Cartão* - excluir configuração de cartão\n\n⚠️ *Atenção:* Esta ação não pode ser desfeita!\n\n💡 Digite o número da opção ou "cancelar"'
  });
}

export default excluirComMenuCommand; 