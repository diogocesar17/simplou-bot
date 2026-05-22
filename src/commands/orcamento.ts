import * as databaseService from '../infrastructure/databaseService';
import { formatarValor } from '../utils/formatUtils';
import { formatarMensagem } from '../utils/formatMessages';

async function orcamentoCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().replace('orcamento', '').replace('orçamento', '').trim();

  // "excluir orcamento alimentação"
  if (textoLower.startsWith('excluir ')) {
    const cat = textoLower.replace('excluir ', '').trim();
    await databaseService.excluirOrcamento(userId, cat);
    await sock.sendMessage(userId, { text: `✅ Orçamento de *${cat}* removido.` });
    return;
  }

  // Listar: "meus orcamentos" ou "orcamento" sem argumentos
  if (!textoLower || textoLower === 'meus' || textoLower === 'listar' || textoLower === 'ver') {
    const orcamentos = await databaseService.listarOrcamentos(userId);
    if (!orcamentos.length) {
      await sock.sendMessage(userId, {
        text: 'Nenhum orçamento configurado.\n\nPara criar: *orcamento alimentação 500*'
      });
      return;
    }
    const itens = await Promise.all(orcamentos.map(async o => {
      const total = await databaseService.getTotalCategoriaNoMes(userId, o.categoria);
      const pct = Math.round((total / o.limite) * 100);
      const emoji = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
      return `${emoji} ${o.categoria}: R$ ${formatarValor(total)} / R$ ${formatarValor(o.limite)} (${pct}%)`;
    }));
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Orçamentos do mês',
        emojiTitulo: '📊',
        secoes: [{ titulo: 'Por categoria', itens, emoji: '💰' }],
        dicas: [
          { texto: 'Criar/editar orçamento', comando: 'orcamento alimentação 500' },
          { texto: 'Remover orçamento', comando: 'excluir orcamento alimentação' }
        ]
      })
    });
    return;
  }

  // Criar/editar: "orcamento alimentação 500"
  const partes = textoLower.split(' ');
  const limite = parseFloat(partes[partes.length - 1].replace(',', '.'));
  if (isNaN(limite) || limite <= 0) {
    await sock.sendMessage(userId, {
      text: 'Formato inválido. Ex: *orcamento alimentação 500*'
    });
    return;
  }
  const categoria = partes.slice(0, partes.length - 1).join(' ').trim();
  if (!categoria) {
    await sock.sendMessage(userId, { text: 'Informe a categoria. Ex: *orcamento alimentação 500*' });
    return;
  }
  // Capitalizar primeira letra
  const categoriaNome = categoria.charAt(0).toUpperCase() + categoria.slice(1);
  await databaseService.salvarOrcamento(userId, categoriaNome, limite);
  await sock.sendMessage(userId, {
    text: `✅ Orçamento de *${categoriaNome}* definido em *R$ ${formatarValor(limite)}/mês*.\n\nDigite *meus orcamentos* para ver todos.`
  });
}

export default orcamentoCommand;
