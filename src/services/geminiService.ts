import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../infrastructure/logger';
import { registrarChamada, registrarRetry } from '../infrastructure/geminiMonitor';

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
const GEMINI_TEXT_MODEL = 'gemini-3.1-flash-lite';
// Usar o mesmo modelo para multimodal conforme instrução do projeto
const GEMINI_VISION_MODEL = GEMINI_TEXT_MODEL;

// Configuração do Gemini
let gemini: GoogleGenerativeAI | null = null;
let isGeminiAvailable = false;

// Retry com backoff exponencial: 3 tentativas com delays 1s → 3s → 9s
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000];

function isRetryable(err: any): boolean {
  const msg = String(err?.message ?? err).toLowerCase();
  const status = err?.status ?? err?.httpStatus ?? err?.code;
  return (
    status === 429 ||
    status === 503 ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('service unavailable') ||
    msg.includes('unavailable')
  );
}

async function comRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < RETRY_DELAYS_MS.length && isRetryable(err)) {
        registrarRetry(label);
        logger.warn({ label, tentativa: i + 1, proximoDelayMs: RETRY_DELAYS_MS[i] }, '[GEMINI] sobrecarga — aguardando retry');
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[i]));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

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

  const t0 = Date.now();
  try {
    const result = await comRetry(() => model.generateContent(String(prompt || '')), 'gerarJSON');
    const response = await result.response;
    const textResp = response.text();
    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      registrarChamada('gerarJSON', Date.now() - t0, false);
      return null;
    }
    registrarChamada('gerarJSON', Date.now() - t0, true);
    logger.debug({ latencyMs: Date.now() - t0 }, '[GEMINI] gerarJSON');
    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    registrarChamada('gerarJSON', Date.now() - t0, false);
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

  const t0 = Date.now();
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

    const result = await comRetry(() => model.generateContent(prompt), 'analisarTransacao');
    const response = await result.response;
    const textResp = response.text();
    const latencyMs = Date.now() - t0;

    const jsonMatch = textResp.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: AnaliseTransacao = JSON.parse(jsonMatch[0]);
      registrarChamada('analisarTransacao', latencyMs, true);
      logger.info({ userId, latencyMs, tipo: parsed.tipo, categoria: parsed.categoria, confianca: parsed.confianca }, '[GEMINI] analisarTransacao');
      return parsed;
    } else {
      registrarChamada('analisarTransacao', latencyMs, false);
      logger.warn({ userId, latencyMs, respLen: (textResp || '').length }, '[GEMINI] analisarTransacao sem JSON na resposta');
      return null;
    }
  } catch (error: any) {
    registrarChamada('analisarTransacao', Date.now() - t0, false);
    logger.error({ userId, err: error?.message || String(error) }, '[GEMINI] analisarTransacao erro');
    return null;
  }
}

// Função para analisar padrões de gastos
export async function analisarPadroesGastos(
  userId: string,
  dados: any,
  driverContext?: string,
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  const t0 = Date.now();
  try {
    const prompt = `
Você é um assistente financeiro especializado em motoristas e entregadores de aplicativo.
${driverContext ? `\nPERFIL DO USUÁRIO:\n${driverContext}\n` : ''}
Analise os dados de ganhos e custos operacionais do motorista e forneça insights relevantes para o nicho:

Dados dos últimos 3 meses (colunas: id, data, tipo, descricao, valor, categoria, pagamento):
${JSON.stringify(dados, null, 2)}

Forneça uma análise em português brasileiro com:
1. 🚗 Ganhos por plataforma (Uber, iFood, 99, etc.) — qual gera mais receita
2. ⛽ Principais custos operacionais (combustível, manutenção, pedágio) e seu impacto no lucro
3. 📈 Tendência de lucro real nos últimos meses
4. ⚠️ Alertas sobre custos que estão consumindo muita margem
5. 💡 Sugestões práticas para aumentar rentabilidade como motorista/entregador

Use linguagem direta, emojis e valores em reais. Máximo 25 linhas.
`;

    const result = await comRetry(() => model.generateContent(prompt), 'analisarPadroes');
    const response = await result.response;
    registrarChamada('analisarPadroes', Date.now() - t0, true);
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] analisarPadroes');
    return response.text();
  } catch (error: any) {
    registrarChamada('analisarPadroes', Date.now() - t0, false);
    logger.error({ userId, err: error?.message || error }, '[GEMINI] analisarPadroes erro');
    return null;
  }
}

// Função para gerar sugestões de economia
export async function gerarSugestoesEconomia(
  userId: string,
  dados: any,
  driverContext?: string,
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  const t0 = Date.now();
  try {
    const prompt = `
Você é um consultor financeiro especializado em motoristas e entregadores de aplicativo.
${driverContext ? `\nPERFIL DO USUÁRIO:\n${driverContext}\n` : ''}
Com base nos ganhos e custos operacionais do motorista, gere sugestões práticas para aumentar sua rentabilidade:

Dados (colunas: id, data, tipo, descricao, valor, categoria, pagamento):
${JSON.stringify(dados, null, 2)}

Forneça exatamente:
1. 🏆 3 a 5 sugestões concretas para aumentar o lucro líquido (ex: horários mais rentáveis, reduzir custo de combustível, manutenção preventiva)
2. 💰 Estimativa de ganho/economia mensal para cada sugestão
3. ✅ Como implementar cada sugestão na prática
4. ⚠️ Um alerta sobre o custo operacional que mais impacta a margem atual

Use linguagem direta e motivacional. Valores em reais. Máximo 25 linhas.
`;

    const result = await comRetry(() => model.generateContent(prompt), 'gerarSugestoes');
    const response = await result.response;
    registrarChamada('gerarSugestoes', Date.now() - t0, true);
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] gerarSugestoes');
    return response.text();
  } catch (error: any) {
    registrarChamada('gerarSugestoes', Date.now() - t0, false);
    logger.error({ userId, err: error?.message || error }, '[GEMINI] gerarSugestoes erro');
    return null;
  }
}

// Função para prever gastos futuros
export async function preverGastosFuturos(
  userId: string,
  dados: any,
  driverContext?: string,
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  const t0 = Date.now();
  try {
    const prompt = `
Você é um analista financeiro especializado em motoristas e entregadores de aplicativo.
${driverContext ? `\nPERFIL DO USUÁRIO:\n${driverContext}\n` : ''}
Analise o histórico de ganhos e custos do motorista e faça projeções para os próximos meses:

Histórico dos últimos 6 meses (colunas: id, data, tipo, descricao, valor, categoria, pagamento):
${JSON.stringify(dados, null, 2)}

Forneça:
1. 📈 Previsão de ganhos para os próximos 3 meses por plataforma (com base na tendência)
2. ⛽ Projeção de custos operacionais (combustível, manutenção) para os próximos 3 meses
3. 🎯 Lucro real projetado mês a mês
4. 📅 Alertas sobre custos sazonais do veículo (revisão, troca de óleo, pneus) baseados no padrão histórico
5. 💡 Recomendação de quanto reservar por mês para manutenção e emergências

Valores em reais, linguagem clara. Máximo 25 linhas.
`;

    const result = await comRetry(() => model.generateContent(prompt), 'preverGastos');
    const response = await result.response;
    registrarChamada('preverGastos', Date.now() - t0, true);
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] preverGastos');
    return response.text();
  } catch (error: any) {
    registrarChamada('preverGastos', Date.now() - t0, false);
    logger.error({ userId, err: error?.message || error }, '[GEMINI] preverGastos erro');
    return null;
  }
}

// Função para responder perguntas financeiras
export async function responderPerguntaFinanceira(
  userId: string,
  pergunta: string,
  contexto: any = null,
  driverContext?: string,
): Promise<string | null> {
  const model = getTextModel();
  if (!model) return null;

  const t0 = Date.now();
  try {
    let prompt = `Você é um assistente financeiro especializado em motoristas e entregadores de aplicativo no Brasil.
${driverContext ? `\nPERFIL DO USUÁRIO:\n${driverContext}\n` : ''}
Responda à seguinte pergunta de forma clara e objetiva, sempre considerando a realidade de quem trabalha com Uber, iFood, 99, Rappi ou delivery:

Pergunta: "${pergunta}"`;

    if (contexto) {
      prompt += `\n\nHistórico financeiro do usuário (colunas: id, data, tipo, descricao, valor, categoria, pagamento):\n${JSON.stringify(contexto, null, 2)}`;
    }

    prompt += `\n\nResponda de forma prática e útil para um motorista/entregador, usando linguagem simples e emojis. Máximo 20 linhas.`;

    const result = await comRetry(() => model.generateContent(prompt), 'responderPergunta');
    const response = await result.response;
    const texto = response.text();
    registrarChamada('responderPergunta', Date.now() - t0, true);
    logger.info({ userId, latencyMs: Date.now() - t0 }, '[GEMINI] responderPergunta');
    return texto;
  } catch (error: any) {
    registrarChamada('responderPergunta', Date.now() - t0, false);
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

  const t0 = Date.now();
  try {
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

    const result = await comRetry(() => model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'application/octet-stream',
        },
      },
      { text: prompt },
    ]), 'analisarVoucher');
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

    registrarChamada('analisarVoucher', Date.now() - t0, true);
    logger.info({ userId, latencyMs: Date.now() - t0, tipo: resultado.tipo, valor: resultado.valor, categoria: resultado.categoria, parcelado: resultado.parcelado }, '[GEMINI] analisarVoucher');
    return resultado;
  } catch (error: any) {
    registrarChamada('analisarVoucher', Date.now() - t0, false);
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

  const t0 = Date.now();
  try {
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

    const result = await comRetry(() => model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'audio/ogg',
        },
      },
      { text: prompt },
    ]), 'transcreverAudio');

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

    registrarChamada('transcreverAudio', Date.now() - t0, true);
    logger.info({ userId, latencyMs: Date.now() - t0, tipo: resultado.tipo, valor: resultado.valor, categoria: resultado.categoria, transcricaoLen: resultado.transcricao.length }, '[GEMINI] transcreverAudio');
    return resultado;
  } catch (error: any) {
    registrarChamada('transcreverAudio', Date.now() - t0, false);
    logger.error({ userId, err: error?.message || error }, '[GEMINI] transcreverAudio erro');
    return null;
  }
}
