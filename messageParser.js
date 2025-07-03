const categoriasPrincipais = {
  'Alimentação': [
    'mercado', 'supermercado', 'padaria', 'restaurante', 'ifood', 'rappi', 'lanche', 'almoço', 'jantar', 'pizza', 'hamburguer', 'comida', 'bebida', 'bar', 'café', 'cafe', 'lanchonete', 'delivery'
  ],
  'Saúde': [
    'farmácia', 'remédio', 'remedio', 'dentista', 'médico', 'medico', 'consulta', 'exame', 'hospital', 'clínica', 'clinica', 'psicólogo', 'psicologo', 'plano de saúde', 'vacina'
  ],
  'Moradia': [
    'aluguel', 'energia', 'água', 'agua', 'internet', 'condomínio', 'condominio', 'gás', 'gas', 'luz', 'telefone', 'imóvel', 'imovel', 'iptu', 'ipva'
  ],
  'Transporte': [
    'uber', '99', 'ônibus', 'onibus', 'metrô', 'metro', 'combustível', 'combustivel', 'gasolina', 'etanol', 'diesel', 'passagem', 'carro', 'moto', 'bicicleta', 'bike', 'trem', 'taxi', 'estacionamento'
  ]
};

// Limites de valores por categoria (em reais)
const limitesCategoria = {
  'Alimentação': { min: 0.50, max: 500, alerta: 200 },
  'Saúde': { min: 1.00, max: 2000, alerta: 1000 },
  'Moradia': { min: 10.00, max: 10000, alerta: 5000 },
  'Transporte': { min: 1.00, max: 1000, alerta: 500 },
  'Outros': { min: 0.01, max: 2500, alerta: 1000 }
};

let categoriasCadastradas = Object.keys(categoriasPrincipais);

function validarValor(valor, categoria, tipo, texto) {
  const validacoes = [];
  
  // Validação básica
  if (valor < 0.01) {
    return { error: 'Valor muito baixo. Mínimo: R$ 0,01' };
  }
  
  // Obter limites da categoria
  const limites = limitesCategoria[categoria] || limitesCategoria['Outros'];
  
  // Validação de valor mínimo por categoria
  if (valor < limites.min) {
    validacoes.push(`⚠️ Valor baixo para ${categoria}: R$ ${valor.toFixed(2)} (mínimo: R$ ${limites.min.toFixed(2)})`);
  }
  
  // Validação de valor máximo por categoria
  if (valor > limites.max) {
    return { error: `Valor muito alto para ${categoria}: R$ ${valor.toFixed(2)} (máximo: R$ ${limites.max.toFixed(2)})` };
  }
  
  // Alerta para valores altos
  if (valor > limites.alerta && tipo === 'Gasto') {
    validacoes.push(`🚨 Valor alto para ${categoria}: R$ ${valor.toFixed(2)} (limite de alerta: R$ ${limites.alerta.toFixed(2)})`);
  }
  
  // Validações específicas por categoria
  if (categoria === 'Alimentação') {
    if (valor > 100 && texto.includes('mercado')) {
      validacoes.push('💡 Valor alto para mercado. Confirme se está correto.');
    }
    if (valor > 50 && (texto.includes('ifood') || texto.includes('rappi'))) {
      validacoes.push('💡 Valor alto para delivery. Confirme se está correto.');
    }
  }
  
  if (categoria === 'Transporte') {
    if (valor > 100 && (texto.includes('uber') || texto.includes('99'))) {
      validacoes.push('💡 Valor alto para transporte. Confirme se está correto.');
    }
  }
  
  if (categoria === 'Saúde') {
    if (valor > 500 && texto.includes('farmácia')) {
      validacoes.push('💡 Valor alto para farmácia. Confirme se está correto.');
    }
  }
  
  return { validacoes };
}

function parseMessage(msg) {
  const texto = msg.toLowerCase().trim();

  // Detecta parcelamento
  let parcelamento = false;
  let numParcelas = 1;
  const regexParcelamento = /em\s*(\d{1,2})\s*(x|vezes|parcelas)/i;
  const matchParcelamento = texto.match(regexParcelamento);
  if (matchParcelamento) {
    parcelamento = true;
    numParcelas = parseInt(matchParcelamento[1]);
  }

  // Detecta recorrente/fixo e quantidade de meses
  let recorrente = false;
  let recorrenteMeses = 12; // padrão
  const regexFixo = /\b(fixo|recorrente|todo mês|mensal)\b/i;
  if (regexFixo.test(texto)) {
    recorrente = true;
    // Detecta "por N meses"
    const matchMeses = texto.match(/por\s*(\d{1,2})\s*mes(es)?/i);
    if (matchMeses) {
      recorrenteMeses = parseInt(matchMeses[1]);
      if (isNaN(recorrenteMeses) || recorrenteMeses < 1) recorrenteMeses = 12;
    }
  }

  // Tipo
  const isIncome = /recebi|ganhei|entrou|salário|salario|pagamento|bonus|bônus|freela|freelance|venda|vendi/i.test(texto);
  const isExpense = /paguei|comprei|gastei|usei|debitou|saquei|transferi|pix|boleto|cartão|cartao/i.test(texto);
  const tipo = isIncome ? 'Receita' : isExpense ? 'Gasto' : 'Outro';

  // Valor
  const valorMatch = texto.match(/(\d+[.,]?\d*)\s*(reais?|r\$|rs?)?/i);
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : null;
  
  if (valor === null) {
    return { error: 'Valor não encontrado na mensagem' };
  }

  // Pagamento
  const pagamentoMatch = texto.match(/(pix|cr[eé]dito|d[eé]bito|dinheiro|boleto|transferência|transferencia|cartão|cartao|nubank|inter|itau|bradesco|santander|caixa)/i);
  let pagamento = pagamentoMatch ? pagamentoMatch[1].toUpperCase() : 'NÃO INFORMADO';
  
  // Se é parcelamento e não especificou pagamento, assume CRÉDITO
  if (parcelamento && pagamento === 'NÃO INFORMADO') {
    pagamento = 'CRÉDITO';
  }

  // Data (procura por formatos dd/mm/aaaa, d/m/aaaa, dd/mm, d/m, etc)
  let data = null;
  let dataMatch = texto.match(/(?:em\s*)?(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/);
  if (dataMatch) {
    let partes = dataMatch[1].replace(/-/g, '/').split('/');
    let dia = parseInt(partes[0]);
    let mes = parseInt(partes[1]) - 1; // JS: 0-based
    let ano = (partes[2]) ? parseInt(partes[2]) : (new Date()).getFullYear();
    if (ano < 100) ano += 2000; // Suporte para ano 2 dígitos
    const dataObj = new Date(ano, mes, dia);
    if (!isNaN(dataObj.getTime())) {
      data = dataObj.toLocaleDateString('pt-BR');
    }
  }
  if (!data) {
    data = new Date().toLocaleDateString('pt-BR');
  }

  // Categoria inteligente
  let categoria = 'Outros';
  let categoriaDetectada = null;
  for (const [cat, palavras] of Object.entries(categoriasPrincipais)) {
    if (palavras.some(p => {
      // Verifica se a palavra está isolada (não é parte de outra palavra)
      const regex = new RegExp(`\\b${p}\\b`, 'i');
      return regex.test(texto);
    })) {
      categoria = cat;
      categoriaDetectada = cat;
      break;
    }
  }
  // Se não encontrou, tenta sugerir nova categoria baseada em palavra após 'com', 'em', 'para', etc.
  if (categoria === 'Outros') {
    // Lista de formas de pagamento para não considerar como categoria
    const formasPagamento = [
      'pix', 'crédito', 'credito', 'débito', 'debito', 'dinheiro', 'boleto', 'transferência', 'transferencia', 'cartão', 'cartao',
      'nubank', 'inter', 'itau', 'bradesco', 'santander', 'caixa'
    ];
    // Regex para pegar a palavra após 'com', 'em', 'para', 'pro', 'pra'
    const novaCatMatch = texto.match(/(?:com|em|para|pro|pra)\s+([a-zçãáéíóúâêôõü ]{3,})/i);
    if (novaCatMatch) {
      let novaCat = capitalize(novaCatMatch[1].trim().split(' ')[0]);
      // Se não for forma de pagamento, sugere como categoria
      if (!formasPagamento.includes(novaCat.toLowerCase())) {
        categoria = novaCat;
        categoriaDetectada = categoria;
      }
    } else {
      // Regex para pegar a palavra após 'no', 'na', 'nos', 'nas'
      const novaCatMatch2 = texto.match(/(?:no|na|nos|nas)\s+([a-zçãáéíóúâêôõü ]{3,})/i);
      if (novaCatMatch2) {
        let novaCat = capitalize(novaCatMatch2[1].trim().split(' ')[0]);
        if (!formasPagamento.includes(novaCat.toLowerCase())) {
          categoria = novaCat;
          categoriaDetectada = categoria;
        }
      }
    }
  }

  // Validação de valor
  const validacao = validarValor(valor, categoria, tipo, texto);
  if (validacao.error) {
    return validacao;
  }

  // Para receitas, não aplicar alertas de valor alto
  if (tipo === 'Receita') {
    validacao.validacoes = validacao.validacoes.filter(v => !v.includes('🚨'));
  }

  // Verifica se é nova categoria
  const isNovaCategoria = !categoriasCadastradas.includes(categoria);

  return {
    tipo,
    valor,
    descricao: msg,
    categoria,
    pagamento,
    data,
    isNovaCategoria,
    categoriaDetectada,
    validacoes: validacao.validacoes || [],
    parcelamento,
    numParcelas,
    recorrente,
    recorrenteMeses
  };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Verifica se a data está muito distante da data atual (ex: mais de 90 dias no passado ou futuro)
function isDataMuitoDistante(dataStr) {
  if (!dataStr) return false;
  // Espera data no formato DD/MM/AAAA
  const partes = dataStr.split('/');
  if (partes.length !== 3) return false;
  const dia = parseInt(partes[0]);
  const mes = parseInt(partes[1]) - 1;
  const ano = parseInt(partes[2]);
  const data = new Date(ano, mes, dia);
  if (isNaN(data.getTime())) return false;
  const hoje = new Date();
  const diffDias = Math.abs((data - hoje) / (1000 * 60 * 60 * 24));
  return diffDias > 90;
}

module.exports = { parseMessage, categoriasCadastradas, isDataMuitoDistante };
  