import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../infrastructure/logger';

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

// 🔧 Configuração de modelo (texto e, futuramente, imagens de vouchers)
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
// Usar o mesmo modelo para multimodal conforme instrução do projeto
const GEMINI_VISION_MODEL = GEMINI_TEXT_MODEL;

// Configuração do Gemini
let gemini: GoogleGenerativeAI | null = null;
let isGeminiAvailable = false;

// Inicializar Gemini
export function initializeGemini(): boolean {
  const rawKey = process.env.GEMINI_API_KEY ?? '';
  const apiKey = rawKey.trim();

  if (!apiKey) {
    logger.warn('[GEMINI] API key não configurada — funcionalidades inteligentes desabilitadas');
    return false;
  }

  try {
    gemini = new GoogleGenerativeAI(apiKey);
    isGeminiAvailable = true;
    logger.info({ model: GEMINI_TEXT_MODEL }, '[GEMINI] Inicializado com sucesso');
    return true;
  } catch (error: any) {
    logger.error({ err: error?.message || error }, '[GEMINI] Erro ao inicializar');
    isGeminiAvailable = false;
    return false;
  }
}

// Função helper para pegar o modelo já tipado
function getTextModel(): GenerativeModel | null {
  if (!isGeminiAvailable || !gemini) return null;
  return gemini.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
}

export async function gerarJSONComGemini(prompt: string): Promise<any | null> {
  const model = getTextModel();
  if (!model) return null;

  try {
    const t0 = Date.now();
    const result = await model.generateContent(String(prompt || ''));
    const response = await result.response;
    const textResp = response.text();
    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    logger.debug({ latencyMs: Date.now() - t0 }, '[GEMINI] gerarJSON');
    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    logger.error({ err: error?.message || error }, '[GEMINI] gerarJSON erro');
    return null;
  }
}

// Função helper para pegar o modelo multimodal (imagens/documentos)
function getVisionModel(): GenerativeModel | null {
  if (!isGeminiAvailable || !gemini) return null;
  return gemini.getGenerativeModel({ model: GEMINI_VISION_MODEL });
}

// Função para analisar transação com Gemini
export async function analisarTransacaoComGemini(
  texto: string,
  userId: string
): Promise<AnaliseTransacao | null> {
  const model = getTextModel();
  if (!model) return null;

  try {
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

    const t0 = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResp = response.text();
    const latencyMs = Date.now() - t0;

    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: AnaliseTransacao = JSON.parse(jsonMatch[0]);
      logger.info({ userId, latencyMs, tipo: parsed.tipo, categoria: parsed.categoria, confianca: parsed.confianca }, '[GEMINI] analisarTransacao');
      return parsed;
    } else {
      logger.warn({ userId, latencyMs, respLen: (textResp || '').length }, '[GEMINI] analisarTransacao sem JSON na resposta');
      return null;
    }
  } catch (error: any) {
    logger.error({ userId, err: error?.message || String(error) }, '[GEMINI] analisarTransacao erro');
    return null;
  }
}

// Função para analisar padrões de gastos
export async function analisarPadroesGastos(
  userId: string,
  dados: any
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  try {
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

    const t0 = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] analisarPadroes');
    return response.text();
  } catch (error: any) {
    logger.error({ userId, err: error?.message || error }, '[GEMINI] analisarPadroes erro');
    return null;
  }
}

// Função para gerar sugestões de economia
export async function gerarSugestoesEconomia(
  userId: string,
  dados: any
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  try {
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

    const t0 = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] gerarSugestoes');
    return response.text();
  } catch (error: any) {
    logger.error({ userId, err: error?.message || error }, '[GEMINI] gerarSugestoes erro');
    return null;
  }
}

// Função para prever gastos futuros
export async function preverGastosFuturos(
  userId: string,
  dados: any
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  try {
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

    const t0 = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] preverGastos');
    return response.text();
  } catch (error: any) {
    logger.error({ userId, err: error?.message || error }, '[GEMINI] preverGastos erro');
    return null;
  }
}

// Função para responder perguntas financeiras
export async function responderPerguntaFinanceira(
  userId: string,
  pergunta: string,
  contexto: any = null
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  try {
    let prompt = `Responda à seguinte pergunta sobre finanças pessoais de forma clara e objetiva:

Pergunta: "${pergunta}"`;

    if (contexto) {
      prompt += `\n\nContexto adicional: ${JSON.stringify(contexto, null, 2)}`;
    }

    prompt += `\n\nForneça uma resposta prática e útil, usando linguagem simples e emojis quando apropriado.`;

    const t0 = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const texto = response.text();
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] responderPergunta');
    return texto;
  } catch (error: any) {
    logger.error({ userId, err: error?.message || error }, '[GEMINI] responderPergunta erro');
    return null;
  }
}

// Teste de conectividade
export async function testarConexaoGemini(): Promise<TesteConexao> {
  if (!isGeminiAvailable) {
    return { success: false, message: 'Gemini não está configurado' };
  }

  try {
    const resultado = await analisarTransacaoComGemini('100 reais de gasolina', 'teste');
    if (resultado) {
      return { success: true, message: 'Conexão com Gemini funcionando!' };
    } else {
      return { success: false, message: 'Erro na análise de teste' };
    }
  } catch (error: any) {
    return { success: false, message: `Erro: ${error?.message || error}` };
  }
}

export { isGeminiAvailable };

// Novo método: análise de voucher financeiro (imagem/PDF)
export async function analisarVoucherFinanceiro(
  fileBuffer: Buffer,
  mimeType: string,
  userId: string
): Promise<{
  tipo: string;
  valor: number;
  categoria: string;
  formaPagamento: string;
  descricao: string;
  data: string;
  parcelado?: boolean;
  parcelas?: number;
} | null> {
  const model = getVisionModel();
  if (!model) return null;

  try {
    const t0 = Date.now();
    const base64Data = fileBuffer.toString('base64');
    const prompt = `Você é uma IA que lê comprovantes financeiros (voucher/recibo/extrato) e extrai os campos abaixo. Atenção: responda APENAS um JSON válido.

Campos obrigatórios no JSON de saída:
{
  "tipo": "gasto" ou "receita",
  "valor": número (ex.: 123.45). Se houver "TOTAL", use o valor total da compra, não o valor da parcela.
  "categoria": texto simples compatível com categorias usuais (ex.: Mercado, Restaurante, Salário),
  "formaPagamento": "pix" | "credito" | "debito" | "dinheiro" | "boleto" | "outro",
  "descricao": frase curta (ex.: Compra no mercado XYZ),
  "data": "YYYY-MM-DD" (data do comprovante; se não houver com segurança, use a data atual),
  "parcelado": booleano (true se identificar indícios de parcelamento como "X/Y", "QTDE PARCELAS", "PARC", caso contrário false),
  "parcelas": número (quantidade total de parcelas. Se não identificar, use 1)
}


Regras:
- Não inclua texto extra fora do JSON.
- Valores devem vir sem símbolo de moeda.
- Se não houver data clara, use a data atual em formato ISO.
- Se não identificar claramente forma de pagamento, defina "outro".
- Para identificar parcelamento, procure por termos como "QTDE PARCELAS", "X/Y" (ex: 01/03), "PARC". Se encontrar, defina "parcelado": true e extraia o total de parcelas.
`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'application/octet-stream',
        },
      },
      { text: prompt },
    ]);
    const response = await result.response;
    const textResp = response.text();

    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ userId }, '[GEMINI] analisarVoucher sem JSON na resposta');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    // Validação mínima
    if (!parsed || !parsed.valor || !parsed.tipo) {
      logger.warn({ userId }, '[GEMINI] analisarVoucher JSON sem campos essenciais');
      return null;
    }

    // Normalizações leves
    const fp = String(parsed.formaPagamento || parsed.forma_pagamento || '').toLowerCase();
    const formaPagamentoNormalizada = fp && ['pix', 'credito', 'debito', 'dinheiro', 'boleto'].includes(fp)
      ? fp
      : 'outro';

    let dataISO = String(parsed.data || '').trim();
    if (!dataISO || dataISO.length !== 10 || !dataISO.includes('-')) {
      const agora = new Date();
      const y = agora.getFullYear();
      const m = String(agora.getMonth() + 1).padStart(2, '0');
      const d = String(agora.getDate()).padStart(2, '0');
      dataISO = `${y}-${m}-${d}`;
    }

    const resultado = {
      tipo: String(parsed.tipo).toLowerCase() === 'receita' ? 'receita' : 'gasto',
      valor: Number(parsed.valor),
      categoria: parsed.categoria || 'Outros',
      formaPagamento: formaPagamentoNormalizada,
      descricao: parsed.descricao || 'Lançamento por voucher',
      data: dataISO,
      parcelado: parsed.parcelado === true,
      parcelas: typeof parsed.parcelas === 'number' ? parsed.parcelas : 1
    };

    logger.info({ userId, latencyMs: Date.now() - t0, tipo: resultado.tipo, valor: resultado.valor, categoria: resultado.categoria, parcelado: resultado.parcelado }, '[GEMINI] analisarVoucher');
    return resultado;
  } catch (error: any) {
    logger.error({ userId, err: error?.message || error }, '[GEMINI] analisarVoucher erro');
    return null;
  }
}

// Novo método: transcrição e extração de dados financeiros a partir de áudio
export async function transcreverAudioFinanceiro(
  audioBuffer: Buffer,
  mimeType: string,
  userId: string
): Promise<{
  transcricao: string;
  tipo: string;
  valor: number;
  categoria: string;
  formaPagamento: string;
  descricao: string;
  data: string;
} | null> {
  const model = getVisionModel();
  if (!model) return null;

  try {
    const t0 = Date.now();
    const base64Data = audioBuffer.toString('base64');
    const prompt = `Você receberá um áudio (mensagem de voz). Tarefas:
1) Transcreva fielmente o conteúdo em português.
2) A partir da transcrição, extraia uma transação financeira com os seguintes campos e responda APENAS um JSON válido:
{
  "transcricao": string,
  "tipo": "gasto" ou "receita",
  "valor": número (ex.: 123.45),
  "categoria": texto simples (ex.: Mercado, Restaurante, Salário),
  "formaPagamento": "pix" | "credito" | "debito" | "dinheiro" | "boleto" | "outro",
  "descricao": frase curta (ex.: Compra no mercado XYZ),
  "data": "YYYY-MM-DD" (se não houver data explícita na fala, use a data atual)
}

Regras:
- Não inclua texto fora do JSON.
- Valores sem símbolo de moeda.
- Se forma de pagamento não for clara, use "outro".
`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'audio/ogg',
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const textResp = response.text();
    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ userId }, '[GEMINI] transcreverAudio sem JSON na resposta');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !parsed.transcricao || !parsed.valor || !parsed.tipo) {
      logger.warn({ userId }, '[GEMINI] transcreverAudio JSON sem campos essenciais');
      return null;
    }

    const fp = String(parsed.formaPagamento || parsed.forma_pagamento || '').toLowerCase();
    const formaPagamentoNormalizada = fp && ['pix', 'credito', 'debito', 'dinheiro', 'boleto'].includes(fp)
      ? fp
      : 'outro';

    let dataISO = String(parsed.data || '').trim();
    if (!dataISO || dataISO.length !== 10 || !dataISO.includes('-')) {
      const agora = new Date();
      const y = agora.getFullYear();
      const m = String(agora.getMonth() + 1).padStart(2, '0');
      const d = String(agora.getDate()).padStart(2, '0');
      dataISO = `${y}-${m}-${d}`;
    }

    const resultado = {
      transcricao: String(parsed.transcricao || ''),
      tipo: String(parsed.tipo).toLowerCase() === 'receita' ? 'receita' : 'gasto',
      valor: Number(parsed.valor),
      categoria: parsed.categoria || 'Outros',
      formaPagamento: formaPagamentoNormalizada,
      descricao: parsed.descricao || 'Lançamento por áudio',
      data: dataISO,
    };

    logger.info({ userId, latencyMs: Date.now() - t0, tipo: resultado.tipo, valor: resultado.valor, categoria: resultado.categoria, transcricaoLen: resultado.transcricao.length }, '[GEMINI] transcreverAudio');
    return resultado;
  } catch (error: any) {
    logger.error({ userId, err: error?.message || error }, '[GEMINI] transcreverAudio erro');
    return null;
  }
}
