const { buscarConfiguracaoCartao, listarCartoesConfigurados } = require('./databaseService');

// Palavras-chave para categorias
const CATEGORIAS_KEYWORDS = {
  'Alimentação': [
    'mercado', 'supermercado', 'restaurante', 'lanche', 'pão', 'pao', 'comida', 
    'almoço', 'almoco', 'jantar', 'café', 'cafe', 'pizza', 'hamburger', 'fast food',
    'ifood', 'rappi', 'uber eats', 'delivery', 'entrega', 'padaria', 'açougue', 'acougue'
  ],
  'Saúde': [
    'farmácia', 'farmacia', 'drogaria', 'médico', 'medico', 'consulta', 'remedio', 
    'medicamento', 'exame', 'laboratório', 'laboratorio', 'hospital', 'clínica', 'clinica',
    'dentista', 'psicólogo', 'psicologo', 'fisioterapeuta', 'farmacia'
  ],
  'Transporte': [
    'uber', '99', 'taxi', 'ônibus', 'onibus', 'metro', 'combustível', 'combustivel',
    'gasolina', 'etanol', 'estacionamento', 'pedágio', 'pedagio', 'passagem',
    'bilhete', 'transporte', 'locomoção', 'locomocao'
  ],
  'Lazer': [
    'cinema', 'show', 'bar', 'balada', 'viagem', 'hotel', 'passeio', 'teatro',
    'museu', 'parque', 'jogos', 'netflix', 'spotify', 'streaming', 'livro',
    'revista', 'hobby', 'esporte', 'academia', 'ginásio', 'ginasio'
  ],
  'Educação': [
    'curso', 'faculdade', 'universidade', 'escola', 'livro', 'material', 'apostila',
    'workshop', 'palestra', 'seminário', 'seminario', 'treinamento', 'estudo'
  ],
  'Moradia': [
    'aluguel', 'condomínio', 'condominio', 'luz', 'água', 'agua', 'gás', 'gas',
    'internet', 'wifi', 'telefone', 'celular', 'manutenção', 'manutencao',
    'reforma', 'móveis', 'moveis', 'decoração', 'decoracao'
  ],
  'Vestuário': [
    'roupa', 'sapato', 'tenis', 'bolsa', 'acessório', 'acessorio', 'perfume',
    'cosmético', 'cosmetico', 'maquiagem', 'joia', 'relógio', 'relogio'
  ],
  'Serviços': [
    'manicure', 'cabeleireiro', 'barbeiro', 'limpeza', 'lavanderia', 'lavanderia',
    'conserto', 'reparo', 'instalação', 'instalacao', 'serviço', 'servico'
  ]
};

// Palavras-chave para formas de pagamento
const PAGAMENTO_KEYWORDS = {
  'PIX': ['pix', 'pix', 'transferência pix', 'transferencia pix'],
  'Cartão de Crédito': ['cartão', 'cartao', 'crédito', 'credito', 'mastercard', 'visa', 'elo'],
  'Cartão de Débito': ['débito', 'debito', 'cartão débito', 'cartao debito'],
  'Dinheiro': ['dinheiro', 'dinheiro', 'espécie', 'especie', 'efetivo', 'cash'],
  'Boleto': ['boleto', 'conta', 'fatura', 'guia', 'recibo'],
  'Transferência': ['transferência', 'transferencia', 'ted', 'doc', 'p2p']
};

// Função principal para analisar mensagem
async function analisarMensagemInteligente(texto, userId) {
  const textoLower = texto.toLowerCase();
  
  // Extrair valor
  const valor = extrairValor(texto);
  if (!valor) return null;
  
  // Determinar tipo (gasto ou receita)
  const tipo = determinarTipo(textoLower);
  
  // Extrair categoria
  const categoria = extrairCategoria(textoLower);
  
  // Extrair forma de pagamento
  const formaPagamento = extrairFormaPagamento(textoLower);
  
  // Extrair descrição
  const descricao = extrairDescricao(texto, valor);
  
  return {
    tipo,
    valor,
    categoria,
    formaPagamento,
    descricao,
    textoOriginal: texto
  };
}

// Extrair valor da mensagem
function extrairValor(texto) {
  // Padrões para valores
  const padroes = [
    /(\d+[,.]?\d*)\s*(?:reais?|r\$|contos?|pila)/i,
    /r\$\s*(\d+[,.]?\d*)/i,
    /(\d+[,.]?\d*)\s*(?:real|r\$)/i,
    /(\d+[,.]?\d*)/  // Apenas números
  ];
  
  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (match) {
      let valor = match[1].replace(',', '.');
      return parseFloat(valor);
    }
  }
  
  return null;
}

// Determinar se é gasto ou receita
function determinarTipo(texto) {
  const palavrasGasto = ['gastei', 'comprei', 'paguei', 'gasto', 'compra', 'pagamento', 'despesa'];
  const palavrasReceita = ['recebi', 'ganhei', 'entrou', 'receita', 'salário', 'salario', 'pagamento recebido'];
  
  for (const palavra of palavrasGasto) {
    if (texto.includes(palavra)) return 'gasto';
  }
  
  for (const palavra of palavrasReceita) {
    if (texto.includes(palavra)) return 'receita';
  }
  
  // Padrão: se não especificar, assume gasto
  return 'gasto';
}

// Extrair categoria baseada em palavras-chave
function extrairCategoria(texto) {
  // Ordem de prioridade: categorias mais específicas primeiro
  const categoriasPrioritarias = [
    'Serviços', // Mais específico
    'Saúde',
    'Transporte', 
    'Lazer',
    'Educação',
    'Vestuário',
    'Moradia',
    'Alimentação' // Mais genérico
  ];
  
  for (const categoria of categoriasPrioritarias) {
    const keywords = CATEGORIAS_KEYWORDS[categoria];
    for (const keyword of keywords) {
      if (texto.includes(keyword)) {
        return categoria;
      }
    }
  }
  
  return 'Outros'; // Categoria padrão
}

// Extrair forma de pagamento
function extrairFormaPagamento(texto) {
  for (const [forma, keywords] of Object.entries(PAGAMENTO_KEYWORDS)) {
    for (const keyword of keywords) {
      if (texto.includes(keyword)) {
        return forma;
      }
    }
  }
  
  return 'Não especificado';
}

// Extrair descrição da mensagem
function extrairDescricao(texto, valor) {
  // Remove o valor e palavras comuns
  let descricao = texto
    .replace(new RegExp(`\\b${valor}\\b`, 'gi'), '')
    .replace(/\b(reais?|r\$|contos?|pila)\b/gi, '')
    .replace(/\b(gastei|comprei|paguei|recebi|ganhei)\b/gi, '')
    .replace(/\b(com|no|na|em|por|via|através|atraves)\b/gi, '')
    .trim();
  
  // Remove espaços extras
  descricao = descricao.replace(/\s+/g, ' ');
  
  return descricao || 'Lançamento automático';
}

// Verificar se precisa selecionar cartão
async function verificarSelecaoCartao(formaPagamento, userId) {
  if (formaPagamento.includes('Cartão')) {
    const cartoes = await listarCartoesConfigurados(userId);
    
    if (cartoes.length === 0) {
      return {
        precisaSelecionar: true,
        tipo: 'sem_cartoes',
        mensagem: 'Você ainda não tem cartões configurados. Quer configurar um agora? (sim/não)'
      };
    } else if (cartoes.length === 1) {
      return {
        precisaSelecionar: false,
        cartaoSelecionado: cartoes[0]
      };
    } else {
      let mensagem = 'Em qual cartão você quer lançar?\n';
      cartoes.forEach((cartao, index) => {
        mensagem += `${index + 1}. ${cartao.nome} (vence dia ${cartao.dia_vencimento})\n`;
      });
      mensagem += 'Ou digite "novo" para configurar um cartão';
      
      return {
        precisaSelecionar: true,
        tipo: 'multiplos_cartoes',
        cartoes: cartoes,
        mensagem: mensagem
      };
    }
  }
  
  return {
    precisaSelecionar: false
  };
}

module.exports = {
  analisarMensagemInteligente,
  verificarSelecaoCartao
}; 