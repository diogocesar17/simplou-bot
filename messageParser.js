function parseMessage(msg) {
    const isIncome = /recebi|ganhei|entrou/i.test(msg);
    const isExpense = /paguei|comprei|gastei|usei/i.test(msg);
    const tipo = isIncome ? 'Receita' : isExpense ? 'Gasto' : 'Outro';
  
    const valorMatch = msg.match(/(\d+[.,]?\d*)/);
    const valor = valorMatch ? parseFloat(valorMatch[0].replace(',', '.')) : null;
  
    const pagamentoMatch = msg.match(/(pix|cr[eé]dito|d[eé]bito|dinheiro|boleto)/i);
    const pagamento = pagamentoMatch ? pagamentoMatch[1].toUpperCase() : 'NÃO INFORMADO';
  
    const categoria = msg.includes('mercado') ? 'Alimentação' :
                      msg.includes('gasolina') ? 'Transporte' :
                      msg.includes('aluguel') ? 'Moradia' : 'Outros';
  
    return {
      tipo,
      valor,
      descricao: msg,
      categoria,
      pagamento,
      data: new Date().toLocaleDateString('pt-BR')
    };
  }
  
  module.exports = { parseMessage };
  