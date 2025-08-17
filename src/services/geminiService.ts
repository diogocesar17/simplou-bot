import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Interfaces para tipagem
interface AnaliseTransacao {
  tipo: 'gasto' | 'receita';
  valor: number;
  categoria: string;
  formaPagamento: string;
  descricao: string;
  confianca: 'alta' | 'media' | 'baixa';
}

interface TesteConexao {
  success: boolean;
  message: string;
}

// Configuração do Gemini
let gemini: GoogleGenerativeAI | null = null;
let isGeminiAvailable: boolean = false;

// Inicializar Gemini
export function initializeGemini(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('[GEMINI] API key não configurada. Funcionalidades inteligentes desabilitadas.');
    return false;
  }
  
  try {
    gemini = new GoogleGenerativeAI(apiKey);
    isGeminiAvailable = true;
    console.log('[GEMINI] Inicializado com sucesso!');
    return true;
  } catch (error: any) {
    console.error('[GEMINI] Erro ao inicializar:', error.message);
    return false;
  }
}

// Função para analisar transação com Gemini
export async function analisarTransacaoComGemini(texto: string, userId: string): Promise<AnaliseTransacao | null> {
  if (!isGeminiAvailable || !gemini) {
    console.log('[GEMINI] Não disponível, usando parser padrão');
    return null;
  }
  
  try {
    const model: GenerativeModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
Analise a seguinte mensagem de transação financeira e extraia as informações em formato JSON:

Mensagem: "${texto}"

Extraia e retorne APENAS um JSON com os seguintes campos:
{
  "tipo": "gasto" ou "receita",
  "valor": número (apenas o valor numérico),
  "categoria": "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Moradia", "Vestuário", "Serviços", "Outros",
  "formaPagamento": "PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Boleto", "Transferência", "Não especificado",
  "descricao": "descrição limpa da transação",
  "confianca": "alta", "media" ou "baixa"
}

Regras importantes:
- Se não conseguir identificar o tipo, retorne "gasto"
- Se não conseguir identificar a categoria, retorne "Outros"
- Se não conseguir identificar forma de pagamento, retorne "Não especificado"
- Para confiança: "alta" se muito claro, "media" se parcialmente claro, "baixa" se pouco claro
- Retorne APENAS o JSON, sem texto adicional
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Tentar extrair JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: AnaliseTransacao = JSON.parse(jsonMatch[0]);
      console.log('[GEMINI] Análise realizada:', parsed);
      return parsed;
    } else {
      console.log('[GEMINI] Não conseguiu extrair JSON da resposta:', text);
      return null;
    }
    
  } catch (error: any) {
    console.error('[GEMINI] Erro na análise:', error.message);
    return null;
  }
}

// Função para analisar padrões de gastos
export async function analisarPadroesGastos(userId: string, dados: any): Promise<string | null> {
  if (!isGeminiAvailable || !gemini) {
    return null;
  }
  
  try {
    const model: GenerativeModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
Analise os dados de gastos do usuário e forneça insights inteligentes:

Dados dos últimos 3 meses:
${JSON.stringify(dados, null, 2)}

Forneça uma análise em português brasileiro com:
1. Principais categorias de gastos
2. Tendências identificadas
3. Possíveis oportunidades de economia
4. Alertas sobre gastos excessivos
5. Sugestões práticas

Formato a resposta de forma clara e objetiva, usando emojis para melhor visualização.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error: any) {
    console.error('[GEMINI] Erro na análise de padrões:', error.message);
    return null;
  }
}

// Função para gerar sugestões de economia
export async function gerarSugestoesEconomia(userId: string, dados: any): Promise<string | null> {
  if (!isGeminiAvailable || !gemini) {
    return null;
  }
  
  try {
    const model: GenerativeModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
Com base nos dados de gastos do usuário, gere sugestões práticas de economia:

Dados dos gastos:
${JSON.stringify(dados, null, 2)}

Forneça:
1. 3-5 sugestões específicas de economia
2. Estimativa de economia mensal para cada sugestão
3. Dicas práticas para implementar
4. Alertas sobre gastos desnecessários

Formato a resposta de forma motivacional e prática, usando emojis.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error: any) {
    console.error('[GEMINI] Erro ao gerar sugestões:', error.message);
    return null;
  }
}

// Função para prever gastos futuros
export async function preverGastosFuturos(userId: string, dados: any): Promise<string | null> {
  if (!isGeminiAvailable || !gemini) {
    return null;
  }
  
  try {
    const model: GenerativeModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
Analise o histórico de gastos e faça previsões para os próximos meses:

Histórico dos últimos 6 meses:
${JSON.stringify(dados, null, 2)}

Forneça:
1. Previsão de gastos para os próximos 3 meses
2. Gastos sazonais esperados (IPVA, IPTU, etc.)
3. Tendências identificadas
4. Alertas sobre períodos de alto gasto
5. Recomendações para planejamento

Formato a resposta de forma clara e objetiva.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error: any) {
    console.error('[GEMINI] Erro na previsão:', error.message);
    return null;
  }
}

// Função para responder perguntas financeiras
export async function responderPerguntaFinanceira(userId: string, pergunta: string, contexto: any = null): Promise<string | null> {
  if (!isGeminiAvailable || !gemini) {
    console.log('[GEMINI][responderPerguntaFinanceira] Gemini indisponível, retornando null');
    return null;
  }
  
  try {
    console.log('[GEMINI][responderPerguntaFinanceira] Chamando modelo gemini-1.5-flash');
    const model: GenerativeModel = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    let prompt = `Responda à seguinte pergunta sobre finanças pessoais de forma clara e objetiva:

Pergunta: "${pergunta}"`;

    if (contexto) {
      prompt += `\n\nContexto adicional: ${contexto}`;
    }
    
    prompt += `\n\nForneça uma resposta prática e útil, usando linguagem simples e emojis quando apropriado.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const texto = response.text();
    console.log('[GEMINI][responderPerguntaFinanceira] Resposta recebida (primeiros 120 chars):', (texto || '').slice(0, 120));
    return texto;
    
  } catch (error: any) {
    console.error('[GEMINI] Erro ao responder pergunta:', error.message);
    return null;
  }
}

// Teste de conectividade
export async function testarConexaoGemini(): Promise<TesteConexao> {
  if (!isGeminiAvailable) {
    return { success: false, message: 'Gemini não está configurado' };
  }
  
  try {
    const resultado = await analisarTransacaoComGemini("100 reais de gasolina", "teste");
    if (resultado) {
      return { success: true, message: 'Conexão com Gemini funcionando!' };
    } else {
      return { success: false, message: 'Erro na análise de teste' };
    }
  } catch (error: any) {
    return { success: false, message: `Erro: ${error.message}` };
  }
}

export { isGeminiAvailable };