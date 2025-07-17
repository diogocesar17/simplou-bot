// Sistema de Parser de Intenções - Simplou
// Pode evoluir de regex simples para NLP avançado

class IntentParser {
  constructor() {
    this.intents = {
      // Histórico
      'historico': {
        patterns: [
          /(?:mostrar|ver|listar|consultar|buscar|encontrar).*(?:histórico|lançamentos?|gastos?|receitas?)/i,
          /(?:histórico|históricos?|lançamentos?|gastos?|receitas?)(?:\s+(?:de|do|da|em))?/i,
          /(?:últimos?|recentes?)\s+(?:lançamentos?|gastos?|receitas?)/i,
          /(?:o que|quais)\s+(?:eu|você)\s+(?:gastou|recebeu|lançou)/i,
          /(?:me\s+)?(?:mostre|mostra|mostrar)\s+(?:meus?|os\s+)?(?:lançamentos?|gastos?|receitas?)/i,
          /(?:quero\s+)?(?:ver|mostrar)\s+(?:meus?|os\s+)?(?:gastos?|lançamentos?)/i
        ],
        examples: [
          'mostrar histórico',
          'ver meus lançamentos',
          'quais foram meus gastos',
          'mostre o que eu gastei',
          'histórico de julho',
          'lançamentos do mês passado'
        ]
      },

      // Resumo
      'resumo': {
        patterns: [
          /(?:resumo|balanço|total|soma|somar).*(?:do\s+)?(?:mês|mês\s+atual|hoje|dia|semana)/i,
          /(?:quanto|quanto\s+eu)\s+(?:gastei|recebi|tenho|fiquei)/i,
          /(?:saldo|balanço|situação)\s+(?:financeira|do\s+mês|atual)/i,
          /(?:me\s+)?(?:resuma|resume|resumir)\s+(?:meus?|os\s+)?(?:gastos?|receitas?)/i,
          /(?:resumo|resuma)\s+(?:do\s+)?(?:mês|hoje|dia)/i
        ],
        examples: [
          'resumo do mês',
          'quanto eu gastei',
          'meu saldo atual',
          'resuma meus gastos',
          'balanço financeiro'
        ]
      },

      // Adicionar lançamento
      'adicionar': {
        patterns: [
          /(?:gastei|gastou|paguei|comprei|compras?|despesa)/i,
          /(?:recebi|recebeu|ganhei|salário|pagamento|entrada)/i,
          /(?:adicionar|adiciona|adicionar|incluir|inclui|registrar|registra)/i,
          /(?:novo|novo\s+lançamento|novo\s+gasto|nova\s+receita)/i,
          /(?:eu\s+)?(?:gastei|recebi|paguei|comprei)/i
        ],
        examples: [
          'gastei 50 no mercado',
          'recebi 1000 salário',
          'adicionar gasto',
          'novo lançamento'
        ]
      },

      // Editar
      'editar': {
        patterns: [
          /(?:editar|edita|modificar|modifica|alterar|altera|corrigir|corrige)/i,
          /(?:mudar|muda|trocar|troca|ajustar|ajusta)/i,
          /(?:quero\s+)?(?:alterar|mudar|corrigir)\s+(?:um|o|a)\s+(?:lançamento|gasto|receita)/i,
          /(?:editar|edita)\s+(?:lançamento|gasto|receita)/i
        ],
        examples: [
          'editar lançamento',
          'quero corrigir um gasto',
          'modificar receita'
        ]
      },

      // Excluir
      'excluir': {
        patterns: [
          /(?:excluir|exclui|remover|remove|deletar|deleta|apagar|apaga)/i,
          /(?:cancelar|cancela|desfazer|desfaz)/i,
          /(?:quero\s+)?(?:remover|excluir|apagar)\s+(?:um|o|a)\s+(?:lançamento|gasto|receita)/i,
          /(?:excluir|exclui)\s+(?:lançamento|gasto|receita)/i
        ],
        examples: [
          'excluir lançamento',
          'remover gasto',
          'quero apagar uma receita'
        ]
      },

      // Ajuda
      'ajuda': {
        patterns: [
          /(?:ajuda|help|socorro|auxílio|auxilio)/i,
          /(?:como|como\s+eu|como\s+faço|como\s+uso)/i,
          /(?:não\s+sei|não\s+entendi|confuso|perdido)/i,
          /(?:menu|comandos?|opções?|funcionalidades?)/i,
          /(?:como\s+eu\s+uso\s+o\s+bot)/i
        ],
        examples: [
          'ajuda',
          'como eu uso',
          'não sei como fazer',
          'menu de comandos'
        ]
      },

      // Cartões
      'cartoes': {
        patterns: [
          /(?:cartão|cartões?|cartao|cartoes)/i,
          /(?:fatura|faturas?)\s+(?:do\s+)?(?:cartão|cartao)/i,
          /(?:limite|credito|crédito|vencimento)\s+(?:do\s+)?(?:cartão|cartao)/i,
          /(?:meus?\s+)?(?:cartões?|cartoes?)/i,
          /(?:fatura|faturas?)\s+(?:do\s+)?(?:nubank|itau|bradesco|santander)/i
        ],
        examples: [
          'meus cartões',
          'fatura do cartão',
          'limite de crédito'
        ]
      }
    };

    // Configurações para evolução futura
    this.config = {
      confidenceThreshold: 0.3, // Reduzido para capturar mais intenções
      enableNLP: false, // Pode ser ativado no futuro
      enableContext: false, // Pode ser ativado no futuro
      enableLearning: false // Pode ser ativado no futuro
    };
  }

  // Parser principal - pode evoluir para NLP
  async parseIntent(text, userId = null) {
    const normalizedText = this.normalizeText(text);
    
    // Se NLP estiver ativado, usar processamento avançado
    if (this.config.enableNLP) {
      return await this.parseWithNLP(normalizedText, userId);
    }
    
    // Parser baseado em regex (atual)
    return this.parseWithRegex(normalizedText);
  }

  // Normalização de texto
  normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ') // Remove pontuação
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  // Parser atual baseado em regex
  parseWithRegex(text) {
    const results = [];
    
    for (const [intentName, intent] of Object.entries(this.intents)) {
      let maxConfidence = 0;
      let matchedPattern = null;
      
      // Testa cada padrão do intent
      for (const pattern of intent.patterns) {
        const match = text.match(pattern);
        if (match) {
          // Calcula confiança baseada no tamanho da correspondência
          const confidence = match[0].length / text.length;
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            matchedPattern = pattern;
          }
        }
      }
      
      // Se encontrou correspondência com confiança suficiente
      if (maxConfidence >= this.config.confidenceThreshold) {
        results.push({
          intent: intentName,
          confidence: maxConfidence,
          matchedPattern: matchedPattern.toString(),
          originalText: text,
          entities: this.extractEntities(text, intentName)
        });
      }
    }
    
    // Retorna o intent com maior confiança
    if (results.length > 0) {
      results.sort((a, b) => b.confidence - a.confidence);
      return results[0];
    }
    
    return {
      intent: 'unknown',
      confidence: 0,
      originalText: text,
      entities: {}
    };
  }

  // Extração de entidades (datas, valores, etc.)
  extractEntities(text, intent) {
    const entities = {};
    
    // Extrair datas
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, // dd/mm/yyyy
      /(\d{1,2})\/(\d{1,2})/g, // dd/mm
      /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/gi,
      /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/gi
    ];
    
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.dates = matches;
        break;
      }
    }
    
    // Extrair valores monetários
    const moneyPatterns = [
      /r?\$?\s*(\d+[.,]\d{2})/gi,
      /r?\$?\s*(\d+)/gi
    ];
    
    for (const pattern of moneyPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.money = matches.map(m => parseFloat(m.replace(/[^\d.,]/g, '').replace(',', '.')));
        break;
      }
    }
    
    // Extrair categorias comuns
    const categoryPatterns = [
      /(mercado|supermercado|compras?)/gi,
      /(uber|99|taxi|transporte)/gi,
      /(netflix|spotify|streaming)/gi,
      /(aluguel|condominio|moradia)/gi,
      /(salario|pagamento|receita)/gi
    ];
    
    for (const pattern of categoryPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.categories = matches;
        break;
      }
    }
    
    return entities;
  }

  // Parser futuro com NLP (placeholder)
  async parseWithNLP(text, userId) {
    // Aqui você pode integrar com:
    // - Dialogflow
    // - Azure Cognitive Services
    // - AWS Comprehend
    // - OpenAI GPT
    // - Hugging Face
    
    console.log('NLP parser seria usado aqui');
    return this.parseWithRegex(text); // Fallback para regex
  }

  // Treinamento do modelo (futuro)
  async trainModel(trainingData) {
    if (!this.config.enableLearning) {
      console.log('Aprendizado não está ativado');
      return;
    }
    
    // Aqui você pode implementar:
    // - Coleta de dados de uso
    // - Feedback do usuário
    // - Ajuste automático de padrões
    // - Machine Learning
    
    console.log('Modelo seria treinado aqui');
  }

  // Feedback do usuário (futuro)
  async provideFeedback(userId, originalText, detectedIntent, wasCorrect) {
    if (!this.config.enableLearning) return;
    
    // Salvar feedback para melhorar o modelo
    console.log(`Feedback: "${originalText}" -> ${detectedIntent} (correto: ${wasCorrect})`);
  }

  // Configuração para evolução
  enableNLP() {
    this.config.enableNLP = true;
    console.log('NLP ativado - parser avançado disponível');
  }

  enableContext() {
    this.config.enableContext = true;
    console.log('Contexto ativado - conversas mais naturais');
  }

  enableLearning() {
    this.config.enableLearning = true;
    console.log('Aprendizado ativado - modelo pode melhorar com uso');
  }

  // Exemplos de uso para cada intent
  getExamples(intentName = null) {
    if (intentName) {
      return this.intents[intentName]?.examples || [];
    }
    
    const allExamples = {};
    for (const [name, intent] of Object.entries(this.intents)) {
      allExamples[name] = intent.examples;
    }
    return allExamples;
  }
}

// Exemplo de uso
async function testIntentParser() {
  const parser = new IntentParser();
  
  const testCases = [
    'mostrar histórico',
    'quero ver meus gastos',
    'resumo do mês',
    'quanto eu gastei em julho',
    'gastei 50 no mercado',
    'recebi 1000 de salário',
    'editar um lançamento',
    'excluir gasto',
    'ajuda',
    'como eu uso o bot',
    'meus cartões',
    'fatura do nubank'
  ];
  
  console.log('🧪 TESTANDO PARSER DE INTENÇÕES');
  console.log('=' .repeat(60));
  
  for (const testCase of testCases) {
    const result = await parser.parseIntent(testCase);
    console.log(`"${testCase}" -> ${result.intent} (${Math.round(result.confidence * 100)}%)`);
    if (result.entities && Object.keys(result.entities).length > 0) {
      console.log(`  Entidades:`, result.entities);
    }
  }
  
  console.log('\n📚 EXEMPLOS POR INTENT:');
  console.log('=' .repeat(60));
  const examples = parser.getExamples();
  for (const [intent, intentExamples] of Object.entries(examples)) {
    console.log(`\n${intent.toUpperCase()}:`);
    intentExamples.forEach(ex => console.log(`  - "${ex}"`));
  }
}

// Exportar para uso no bot
module.exports = {
  IntentParser,
  testIntentParser
};

// Executar teste se chamado diretamente
if (require.main === module) {
  testIntentParser();
} 