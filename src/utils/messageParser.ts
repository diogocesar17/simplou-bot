// Categorias principais fixas com palavras-chave expandidas
const categoriasPrincipais = {
  'Alimentação': [
    'mercado', 'supermercado', 'padaria', 'restaurante', 'ifood', 'rappi', 'lanche', 'almoço', 'jantar', 'pizza', 'hamburguer', 'comida', 'bebida', 'bar', 'café', 'cafe', 'lanchonete', 'delivery',
    'pizzaria', 'fast food', 'fastfood', 'sorvete', 'picolé', 'picole', 'doces', 'chocolate', 'refrigerante', 'suco', 'água', 'agua', 'cerveja', 'vinho', 'whisky', 'vodka', 'gin', 'tequila',
    'feira', 'hortifruti', 'açougue', 'acougue', 'peixaria', 'queijaria', 'doceria', 'confeitaria', 'panificadora', 'salgados', 'bolos', 'tortas', 'sanduíches', 'sanduiches', 'cafeteria', 'cafeteria'
  ],
  'Saúde': [
    'farmácia', 'farmacia', 'remédio', 'remedio', 'dentista', 'médico', 'medico', 'consulta', 'exame', 'hospital', 'clínica', 'clinica', 'psicólogo', 'psicologo', 'plano de saúde', 'vacina',
    'fisioterapeuta', 'nutricionista', 'personal trainer', 'academia', 'ginásio', 'ginasio', 'suplemento', 'vitamina', 'medicamento', 'antibiótico', 'antibiotico', 'analgésico', 'analgesico',
    'laboratório', 'laboratorio', 'raio x', 'ultrassom', 'resonância', 'resonancia', 'cardiologista', 'dermatologista', 'oftalmologista', 'ortopedista', 'ginecologista', 'urologista'
  ],
  'Moradia': [
    'aluguel', 'energia', 'água', 'agua', 'internet', 'condomínio', 'condominio', 'gás', 'gas', 'luz', 'telefone', 'imóvel', 'imovel', 'iptu', 'ipva',
    'reforma', 'limpeza', 'faxina', 'empregada', 'segurança', 'seguranca', 'portaria', 'elevador', 'piscina', 'academia', 'salao', 'salão',
    'móveis', 'moveis', 'eletrodomésticos', 'eletrodomesticos', 'geladeira', 'fogão', 'fogao', 'microondas', 'lavadora', 'secadora', 'ar condicionado', 'ventilador', 'lâmpada', 'lampada'
  ],
  'Transporte': [
    'uber', '99', 'ônibus', 'onibus', 'metrô', 'metro', 'combustível', 'combustivel', 'gasolina', 'etanol', 'diesel', 'passagem', 'carro', 'moto', 'bicicleta', 'bike', 'trem', 'taxi', 'estacionamento',
    'pedágio', 'pedagio', 'multa', 'ipva', 'seguro', 'manutenção', 'manutencao', 'oficina', 'pneu', 'óleo', 'oleo', 'filtro', 'freio', 'bateria', 'correia', 'vela', 'radiador',
    'lavagem', 'polimento', 'cambio', 'câmbio', 'embreagem', 'suspensão', 'suspensao', 'direção', 'direcao', 'ar condicionado', 'som', 'alarme', 'ronda', 'rastreador'
  ],
  'Lazer': [
    'cinema', 'teatro', 'show', 'concerto', 'festival', 'balada', 'boate', 'disco', 'pub', 'bar', 'restaurante', 'pizzaria', 'pizza', 'hamburguer', 'fast food', 'fastfood',
    'shopping', 'loja', 'roupa', 'sapato', 'bolsa', 'acessório', 'acessorio', 'perfume', 'cosmético', 'cosmetico', 'maquiagem', 'cabelo', 'unha', 'spa', 'massagem',
    'viagem', 'hotel', 'pousada', 'airbnb', 'passagem', 'avião', 'aviao', 'ônibus', 'onibus', 'trem', 'navio', 'cruzeiro', 'passeio', 'turismo', 'museu', 'parque', 'zoológico', 'zoologico',
    'jogos', 'video game', 'videogame', 'console', 'revista', 'jornal', 'netflix', 'spotify', 'youtube', 'streaming', 'assinatura', 'hobby', 'esporte', 'futebol', 'basquete', 'tênis', 'tenis',
    'apple music', 'deezer', 'music', 'prime video', 'disney+', 'disney plus', 'globoplay', 'hbo max', 'paramount', 'star+', 'star plus', 'amazon prime', 'prime video', 'telecine', 'now', 'claro tv', 'oi play', 'looke', 'crunchyroll', 'apple tv', 'apple tv+', 'youtube premium', 'youtube music'
  ],
  'Educação': [
    'escola', 'faculdade', 'universidade', 'curso', 'aula', 'professor', 'professora', 'tutor', 'mentor', 'coaching', 'workshop', 'seminário', 'seminario', 'palestra', 'conferência', 'conferencia',
    'material escolar', 'apostila', 'caderno', 'caneta', 'lápis', 'lapis', 'mochila', 'uniforme', 'mensalidade', 'matrícula', 'matricula', 'inscrição', 'inscricao', 'vestibular', 'enem',
    'idioma', 'inglês', 'ingles', 'espanhol', 'francês', 'frances', 'alemão', 'alemao', 'italiano', 'português', 'portugues', 'chinês', 'chines', 'japonês', 'japones', 'livro'
  ],
  'Trabalho': [
    'escritório', 'escritorio', 'equipamento', 'computador', 'notebook', 'tablet', 'celular', 'smartphone', 'impressora', 'scanner', 'webcam', 'microfone', 'headset', 'fone', 'mouse', 'teclado',
    'software', 'licença', 'licenca', 'assinatura', 'assinatura', 'domínio', 'dominio', 'hosting', 'servidor', 'cloud', 'backup', 'antivírus', 'antivirus', 'office', 'adobe', 'autocad',
    'freelance', 'freela', 'projeto', 'cliente', 'reunião', 'reuniao', 'apresentação', 'apresentacao', 'relatório', 'relatorio', 'proposta', 'contrato', 'nota fiscal', 'recibo',
    'vale refeição', 'valerefeicao', 'vale alimentação', 'valealimentacao', 'vale transporte', 'valetransporte', 'plano de saúde', 'planosaude', 'plano odontológico', 'planoodontologico'
  ],
  'Renda': [
    'salário', 'salario', 'pagamento', 'remuneração', 'remuneracao', 'proventos', 'ordenado', 'vencimentos', 'bonus', 'bônus', 'comissão', 'comissao', 'adicional', 'hora extra', 'horaextra',
    'parcela', 'lote', 'venda', 'aluguel recebido', 'dividendo', 'rendimento', 'investimento', 'aplicação', 'aplicacao', 'cdb', 'lci', 'lca', 'tesouro', 'ações', 'acoes', 'fii', 'fundo',
    'freela', 'freelance', 'bico', 'trabalho extra', 'consultoria', 'palestra', 'curso ministrado', 'aula particular', 'tutoria', 'mentoria', 'coaching', 'venda online', 'ecommerce',
    'recebimento', 'transferência recebida', 'transferencia recebida', 'depósito', 'deposito', 'pix recebido', 'boleto recebido'
  ]
};

// Formas de pagamento válidas
const formasPagamento = [
  'PIX', 'CRÉDITO', 'DÉBITO', 'DINHEIRO', 'BOLETO', 'TRANSFERÊNCIA'
];

// Mapeamento de números para formas de pagamento
const mapeamentoFormasPagamento = {
  1: 'PIX',
  2: 'CRÉDITO', 
  3: 'DÉBITO',
  4: 'DINHEIRO',
  5: 'BOLETO',
  6: 'TRANSFERÊNCIA'
};

// Limites de valores por categoria (em reais)
const limitesCategoria = {
  'Alimentação': { min: 0.50, max: 500, alerta: 200 },
  'Saúde': { min: 1.00, max: 5000, alerta: 2000 },
  'Moradia': { min: 10.00, max: 10000, alerta: 5000 },
  'Transporte': { min: 1.00, max: 1000, alerta: 500 },
  'Lazer': { min: 1.00, max: 2000, alerta: 500 },
  'Educação': { min: 5.00, max: 5000, alerta: 1000 },
  'Trabalho': { min: 1.00, max: 10000, alerta: 5000 },
  'Renda': { min: 1.00, max: 50000, alerta: 10000 },
  'Outros': { min: 0.01, max: 2500, alerta: 1000 }
};

// Categorias cadastradas (incluindo as fixas)
let categoriasCadastradas = Object.keys(categoriasPrincipais);

// Função para detectar categoria com base no texto
function detectarCategoria(texto) {
  texto = texto.toLowerCase();
  
  // Verificações específicas de contexto primeiro (mais específicas)
  if (texto.includes('material de construção') || texto.includes('materiais de construção') || texto.includes('construção') || texto.includes('construcao')) {
    return { categoria: 'Moradia', confianca: 'alta' };
  }
  
  if (texto.includes('manutencao') && (texto.includes('carro') || texto.includes('moto') || texto.includes('veiculo') || texto.includes('veículo'))) {
    return { categoria: 'Transporte', confianca: 'alta' };
  }
  
  if (texto.includes('manutencao') && (texto.includes('casa') || texto.includes('apartamento') || texto.includes('imovel') || texto.includes('imóvel'))) {
    return { categoria: 'Moradia', confianca: 'alta' };
  }
  
  // Verificações específicas para receitas
  if (texto.includes('parcela') || texto.includes('lote') || texto.includes('venda') || texto.includes('aluguel recebido') || texto.includes('dividendo') || texto.includes('rendimento')) {
    return { categoria: 'Renda', confianca: 'alta' };
  }
  
  // Remove valores monetários do texto para evitar conflitos
  const textoLimpo = texto.replace(/\d+[.,]\d{2}/g, 'VALOR');
  
  // Primeiro, tenta encontrar correspondência exata nas categorias principais
  for (const [categoria, palavras] of Object.entries(categoriasPrincipais)) {
    for (const palavra of palavras) {
      // Verifica se a palavra está isolada (não é parte de outra palavra)
      const regex = new RegExp(`\\b${palavra}\\b`, 'i');
      if (regex.test(textoLimpo)) {
        return { categoria, confianca: 'alta' };
      }
    }
  }
  
  // Se não encontrou, tenta correspondência parcial com word boundary mais flexível
  for (const [categoria, palavras] of Object.entries(categoriasPrincipais)) {
    for (const palavra of palavras) {
      // Usa regex com word boundary para evitar matches parciais incorretos
      const regexParcial = new RegExp(`\\b${palavra}\\b`, 'i');
      if (regexParcial.test(textoLimpo)) {
        return { categoria, confianca: 'media' };
      }
    }
  }
  
  // Se ainda não encontrou, tenta extrair categoria do contexto
  const formasPagamento = [
    'pix', 'crédito', 'credito', 'débito', 'debito', 'dinheiro', 'boleto', 'transferência', 'transferencia', 'cartão', 'cartao',
    'nubank', 'inter', 'itau', 'bradesco', 'santander', 'caixa'
  ];
  
  // Palavras genéricas que devem ser categorizadas como "Outros"
  const palavrasGenericas = [
    'loja', 'estabelecimento', 'local', 'lugar', 'coisa', 'item', 'produto', 'serviço', 'servico', 'algo', 'coisa', 'objeto'
  ];
  
  // Regex para pegar a palavra após 'com', 'em', 'para', 'pro', 'pra', 'no', 'na', 'nos', 'nas'
  const padroes = [
    /(?:com|em|para|pro|pra)\s+([a-zçãáéíóúâêôõü ]{3,})/i,
    /(?:no|na|nos|nas)\s+([a-zçãáéíóúâêôõü ]{3,})/i
  ];
  
  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (match) {
      let palavraExtraida = match[1].trim().split(' ')[0];
      palavraExtraida = palavraExtraida.toLowerCase();
      
      // Se for palavra genérica, retorna "Outros"
      if (palavrasGenericas.includes(palavraExtraida)) {
        return { categoria: 'Outros', confianca: 'nenhuma' };
      }
      
      // Se não for forma de pagamento, verifica se está nas categorias principais
      if (!formasPagamento.includes(palavraExtraida)) {
        // Evitar matches com palavras muito pequenas (menos de 3 caracteres)
        if (palavraExtraida.length >= 3) {
          for (const [categoria, palavras] of Object.entries(categoriasPrincipais)) {
            // Usar correspondência mais restritiva para evitar falsos positivos
            const matchEncontrado = palavras.some(p => {
              const pLower = p.toLowerCase();
              // Só aceitar match se:
              // 1. A palavra extraída é igual à palavra-chave completa, OU
              // 2. A palavra-chave contém a palavra extraída como palavra completa (com word boundary), OU
              // 3. A palavra extraída contém a palavra-chave completa (para casos como "mercadinho" contendo "mercado")
              if (pLower === palavraExtraida) {
                return true;
              }
              
              // Verificar se a palavra-chave contém a palavra extraída como palavra completa
              const regexPalavraCompleta = new RegExp(`\\b${palavraExtraida}\\b`, 'i');
              if (regexPalavraCompleta.test(pLower)) {
                return true;
              }
              
              // Verificar se a palavra extraída contém a palavra-chave completa (mínimo 4 caracteres)
              if (pLower.length >= 4 && palavraExtraida.includes(pLower)) {
                return true;
              }
              
              return false;
            });
            
            if (matchEncontrado) {
              return { categoria, confianca: 'baixa' };
            }
          }
        }
      }
    }
  }
  
  return { categoria: 'Outros', confianca: 'nenhuma' };
}

function validarValor(valor, categoria, tipo, texto) {
  const validacoes: string[] = [];
  
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
  
  // Não bloquear lançamento por valor máximo de categoria.
  // Em vez de erro, apenas registrar alerta para revisão humana.
  if (valor > limites.max && tipo !== 'receita') {
    validacoes.push(`🚨 Valor acima da faixa usual para ${categoria}: R$ ${valor.toFixed(2)} (referência: até R$ ${limites.max.toFixed(2)})`);
  }
  
  // Alerta para valores altos
  if (valor > limites.alerta && tipo === 'gasto') {
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
  const regexPorMeses = /por\s*(\d{1,2})\s*mes(es)?/i;
  
  // Detecta "por N meses" primeiro
  const matchMeses = texto.match(regexPorMeses);
  if (matchMeses) {
    recorrente = true;
    recorrenteMeses = parseInt(matchMeses[1]);
    if (isNaN(recorrenteMeses) || recorrenteMeses < 1) recorrenteMeses = 12;
  }
  // Se não detectou "por N meses", verifica outras palavras
  else if (regexFixo.test(texto)) {
    recorrente = true;
    // Detecta "por N meses" mesmo com outras palavras
    const matchMeses2 = texto.match(regexPorMeses);
    if (matchMeses2) {
      recorrenteMeses = parseInt(matchMeses2[1]);
      if (isNaN(recorrenteMeses) || recorrenteMeses < 1) recorrenteMeses = 12;
    }
  }

  // Tipo
  const isIncome = /recebi|ganhei|entrou|salário|salario|pagamento|bonus|bônus|freela|freelance|venda|vendi/i.test(texto);
  const tipo = isIncome ? 'receita' : 'gasto';

  // Valor
  // Novo: aceita formatos 10.631,80 ou 10631,80 ou 10631.80
  let valor: number | null = null;
  const valorMatch = texto.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})|\d+[.,]?\d*)\s*(reais?|r\$|rs?)?/i);
  if (valorMatch) {
    let valorStr = valorMatch[1].replace(/\s/g, '');
    // Se tem vírgula e ponto, assume ponto milhar e vírgula decimal
    if (/\d+\.\d{3},\d{2}/.test(valorStr)) {
      valorStr = valorStr.replace(/\./g, '').replace(',', '.');
    } else if (/\d+,\d{2}$/.test(valorStr)) {
      // Só vírgula decimal
      valorStr = valorStr.replace('.', '').replace(',', '.');
    } else if (/\d+\.\d{2}$/.test(valorStr)) {
      // Só ponto decimal
      valorStr = valorStr.replace(',', '');
    } else {
      valorStr = valorStr.replace(',', '.');
    }
    valor = parseFloat(valorStr);
  }
  
  if (valor === null || isNaN(valor)) {
    return { error: 'Valor não encontrado ou inválido na mensagem' };
  }

  // Pagamento
  const pagamentoMatch = texto.match(/(pix|cr[eé]dito|d[eé]bito|dinheiro|boleto|transferência|transferencia|cartão|cartao|nubank|inter|itau|bradesco|santander|caixa)/i);
  let pagamento = pagamentoMatch ? pagamentoMatch[1].toUpperCase() : 'NÃO INFORMADO';
  
  // Se é parcelamento e não especificou pagamento, assume CRÉDITO
  if (parcelamento && pagamento === 'NÃO INFORMADO') {
    pagamento = 'CRÉDITO';
  }
  
  // Verificar se falta forma de pagamento (apenas para gastos)
  const faltaFormaPagamento = tipo === 'gasto' && pagamento === 'NÃO INFORMADO';

  // Data (procura por formatos dd/mm/aaaa, d/m/aaaa, dd/mm, d/m, etc)
  let data: string | null = null;
  
  // Primeiro, tenta detectar formato textual: "dia 19 de outubro", "19 de outubro", etc.
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const regexDataTextual = /(?:dia\s+)?(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(\d{4}))?/i;
  const matchDataTextual = texto.match(regexDataTextual);
  
  if (matchDataTextual) {
    const dia = parseInt(matchDataTextual[1]);
    const nomeMes = matchDataTextual[2].toLowerCase();
    const mesIndex = meses.findIndex(m => m.toLowerCase() === nomeMes);
    const ano = matchDataTextual[3] ? parseInt(matchDataTextual[3]) : (new Date()).getFullYear();
    
    if (mesIndex !== -1 && dia >= 1 && dia <= 31) {
      const dataObj = new Date(ano, mesIndex, dia);
      if (!isNaN(dataObj.getTime())) {
        data = dataObj.toLocaleDateString('pt-BR');
      }
    }
  }
  
  // Se não encontrou formato textual, tenta formato numérico
  if (!data) {
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
  }
  
  if (!data) {
    // Corrigir: sempre usar timezone do Brasil e formato correto DD/MM/YYYY
    const hoje = new Date();
    const dia = hoje.getDate().toString().padStart(2, '0');
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const ano = hoje.getFullYear();
    data = `${dia}/${mes}/${ano}`;
  }

  // Data de vencimento para boletos (procura por "vencimento", "vence", "venc", "para o dia", "para", etc)
  let dataVencimento: string | null = null;
  const regexVencimento = /(?:vencimento|vence|venc|para\s+(?:o\s+)?dia?)\s*(?:em\s*)?(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i;
  const matchVencimento = texto.match(regexVencimento);
  if (matchVencimento) {
    let partes = matchVencimento[1].replace(/-/g, '/').split('/');
    let dia = parseInt(partes[0]);
    let mes = parseInt(partes[1]) - 1; // JS: 0-based
    let ano = (partes[2]) ? parseInt(partes[2]) : (new Date()).getFullYear();
    if (ano < 100) ano += 2000; // Suporte para ano 2 dígitos
    const dataVencimentoObj = new Date(ano, mes, dia);
    if (!isNaN(dataVencimentoObj.getTime())) {
      const y = dataVencimentoObj.getFullYear();
      const m = String(dataVencimentoObj.getMonth() + 1).padStart(2, '0');
      const d = String(dataVencimentoObj.getDate()).padStart(2, '0');
      dataVencimento = `${y}-${m}-${d}`; // Formato YYYY-MM-DD sem depender de timezone
    }
  }

  // Verificar se falta data de vencimento para boletos
  const faltaDataVencimento = tipo === 'gasto' && pagamento === 'BOLETO' && !dataVencimento;

  // Categoria inteligente usando o novo sistema
  const resultadoCategoria = detectarCategoria(texto);
  let categoria = resultadoCategoria.categoria;
  let categoriaDetectada = resultadoCategoria.categoria;
  let confiancaCategoria = resultadoCategoria.confianca;
  
  // Se a confiança for baixa ou nenhuma, tenta extrair categoria do contexto como fallback
  if (confiancaCategoria === 'baixa' || confiancaCategoria === 'nenhuma') {
    const formasPagamento = [
      'pix', 'crédito', 'credito', 'débito', 'debito', 'dinheiro', 'boleto', 'transferência', 'transferencia', 'cartão', 'cartao',
      'nubank', 'inter', 'itau', 'bradesco', 'santander', 'caixa'
    ];
    
    // Regex para pegar a palavra após 'com', 'em', 'para', 'pro', 'pra', 'no', 'na', 'nos', 'nas'
    const padroes = [
      /(?:com|em|para|pro|pra)\s+([a-zçãáéíóúâêôõü ]{3,})/i,
      /(?:no|na|nos|nas)\s+([a-zçãáéíóúâêôõü ]{3,})/i
    ];
    
    for (const padrao of padroes) {
      const match = texto.match(padrao);
      if (match) {
        let palavraExtraida = match[1].trim().split(' ')[0];
        palavraExtraida = palavraExtraida.toLowerCase();
        
        // Se não for forma de pagamento, verifica se está nas categorias principais
        if (!formasPagamento.includes(palavraExtraida)) {
          // Aplicar a mesma lógica restritiva usada em detectarCategoria
          if (palavraExtraida.length >= 3) {
            for (const [cat, palavras] of Object.entries(categoriasPrincipais)) {
              const encontrou = palavras.some(keyword => {
                const keywordLower = keyword.toLowerCase();
                const palavraLower = palavraExtraida.toLowerCase();
                
                // Correspondência exata
                if (keywordLower === palavraLower) return true;
                
                // Correspondência de limite de palavra usando regex
                const regex = new RegExp(`\\b${palavraLower}\\b`, 'i');
                if (regex.test(keywordLower)) return true;
                
                // Se a palavra extraída contém a keyword completa (apenas para keywords >= 4 chars)
                if (keywordLower.length >= 4 && palavraLower.includes(keywordLower)) return true;
                
                return false;
              });
              
              if (encontrou) {
                categoria = cat;
                categoriaDetectada = cat;
                confiancaCategoria = 'media';
                break;
              }
            }
          }
        }
      }
    }
  }

  // Validação de valor
  const validacao = validarValor(valor, categoria, tipo, texto);
  if (validacao.error) {
    // Retorna o erro, mas inclui todas as informações necessárias para processar o lançamento
    return { 
      error: validacao.error, 
      valorExtraido: valor,
      tipo,
      categoria,
      pagamento,
      data,
      dataVencimento,
      descricao: msg,
      parcelamento,
      numParcelas,
      recorrente,
      recorrenteMeses,
      categoriaDetectada,
      confiancaCategoria,
      faltaFormaPagamento,
      faltaDataVencimento
    };
  }

  // Para receitas, não aplicar alertas de valor alto
  if (tipo === 'receita') {
    validacao.validacoes = (validacao.validacoes || []).filter((v: string) => !v.includes('🚨'));
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
    dataVencimento,
    isNovaCategoria,
    categoriaDetectada,
    confiancaCategoria,
    validacoes: validacao.validacoes || [],
    parcelamento,
    numParcelas,
    recorrente,
    recorrenteMeses,
    faltaFormaPagamento,
    faltaDataVencimento
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
  const diffDias = Math.abs((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diffDias > 90;
}

export { 
  parseMessage, 
  categoriasCadastradas, 
  isDataMuitoDistante,
  formasPagamento,
  mapeamentoFormasPagamento
};
  
