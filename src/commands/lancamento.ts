// Utilitário simples para remover acentos/diacríticos
function removerAcentos(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Formata Date em YYYY-MM-DD sem efeitos de timezone (usando campos locais)
function formatarDateParaISO(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// Comando de lançamento centralizado
import { parseMessage } from '../utils/parseUtils';
import { parseDriverMessage } from '../utils/driverParser';
import * as lancamentosService from '../services/lancamentosService';
import * as cartoesService from '../services/cartoesService';
import * as geminiService from '../services/geminiService';
import * as databaseService from '../infrastructure/databaseService';
import * as driverService from '../services/driverService';
import { formatarValor, formatarComMoeda } from '../utils/formatUtils';
import { converterDataParaISO } from '../utils/dataUtils';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { formatarMensagem } from '../utils/formatMessages';
import { logger } from '../infrastructure/logger';
import { verificarLimiteGeminiDia, incrementarGeminiDia } from '../services/rateLimitService';

// Normaliza frase para uso como chave no parser_cache.
// Substitui o valor monetário por X mas preserva números que são nomes de plataforma (ex: "99").
function normalizarParaCache(texto: string): string {
  let norm = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  // Protege o "99" quando precedido de preposição — é nome de plataforma, não valor
  norm = norm.replace(/\b(no|na|do|da|pelo|pela|com|via|pelo app|no app)\s+99\b/g, '$1 __99__');

  // Substitui valores monetários (decimais e inteiros >= 3 dígitos, ou qualquer decimal)
  norm = norm.replace(/\d{1,3}(?:[.,]\d{3})*[.,]\d{1,2}/g, 'X'); // 1.800,50 ou 180,50
  norm = norm.replace(/\b\d{3,}\b/g, 'X');                        // 100, 1800, …
  norm = norm.replace(/\b\d{1,2}\b(?!\s*__)/g, 'X');              // 1-99, exceto __99__

  // Restaura plataforma protegida
  norm = norm.replace(/__99__/g, '99');

  return norm.replace(/\s+/g, ' ').trim();
}

const DRIVER_CATEGORIAS = new Set([
  'Uber', '99Pop', 'iFood', 'Rappi', 'Loggi', 'Entrega Particular', 'Corrida Particular',
  'Ganhos', 'Combustível', 'Pedágio', 'Estacionamento', 'Lavagem', 'IPVA', 'Multa', 'Manutenção',
]);

// Função para gerar ID único
function gerarIdUnico() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Função para categorização baseada em palavras-chave
function categorizarPorPalavrasChave(texto) {
  logger.debug?.(`[CATEGORIZACAO] Analisando texto: "${texto}"`);
  const textoLower = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  logger.debug?.(`[CATEGORIZACAO] Texto em lowercase: "${textoLower}"`);

  // ── Detecção driver com contexto (precisa de verbo + plataforma/keyword) ──
  // Verifica antes do loop genérico para evitar classificação errada de plataformas como receita
  const verbosReceita = ['ganhei', 'fiz', 'recebi', 'faturei', 'rodei'];
  const temVerboReceita = verbosReceita.some(v => textoLower.includes(v));

  if (temVerboReceita) {
    if (textoLower.includes('uber')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: Uber'); return 'Uber'; }
    if (textoLower.includes('99pop') || /\b99\b/.test(textoLower)) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: 99Pop'); return '99Pop'; }
    if (textoLower.includes('ifood') || textoLower.includes('i food')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: iFood'); return 'iFood'; }
    if (textoLower.includes('rappi')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: Rappi'); return 'Rappi'; }
    if (textoLower.includes('loggi')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: Loggi'); return 'Loggi'; }
    if (textoLower.includes('entrega particular')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: Entrega Particular'); return 'Entrega Particular'; }
    if (textoLower.includes('corrida particular')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver receita: Corrida Particular'); return 'Corrida Particular'; }
  }

  // Despesas inequivocamente operacionais de driver
  if (textoLower.includes('abasteci') || textoLower.includes('gasolina') || textoLower.includes('etanol') || textoLower.includes('diesel')) {
    logger.debug?.('[CATEGORIZACAO] ✅ Driver despesa: Combustivel'); return 'Combustível';
  }
  if (textoLower.includes('pedagio')) { logger.debug?.('[CATEGORIZACAO] ✅ Driver despesa: Pedagio'); return 'Pedágio'; }
  if (textoLower.includes('lava jato') || textoLower.includes('lavagem do carro') || textoLower.includes('lavei o carro')) {
    logger.debug?.('[CATEGORIZACAO] ✅ Driver despesa: Lavagem'); return 'Lavagem';
  }
  if (textoLower.includes('troquei oleo') || textoLower.includes('troca de oleo') || textoLower.includes('borracharia') || textoLower.includes('alinhamento') || textoLower.includes('balanceamento')) {
    logger.debug?.('[CATEGORIZACAO] ✅ Driver despesa: Manutencao'); return 'Manutenção';
  }
  if (textoLower.includes('ipva') || textoLower.includes('licenciamento')) {
    logger.debug?.('[CATEGORIZACAO] ✅ Driver despesa: IPVA'); return 'IPVA';
  }
  if (textoLower.includes('multa de transito')) {
    logger.debug?.('[CATEGORIZACAO] ✅ Driver despesa: Multa'); return 'Multa';
  }

  // ── Mapeamento genérico (comportamento original) ──
  const categorias = {
    'Alimentação': [
      'mercado', 'supermercado', 'restaurante', 'lanche', 'delivery', 'ifood', 'rappi', 'uber eats',
      'comida', 'almoco', 'jantar', 'cafe', 'padaria', 'acougue', 'hortifruti', 'feira'
    ],
    'Transporte': [
      'uber', '99', 'taxi', 'combustivel', 'gasolina', 'etanol', 'onibus', 'metro', 'trem',
      'transporte publico', 'estacionamento', 'pedagio', 'uber eats', 'rappi'
    ],
    'Saúde': [
      'medico', 'farmacia', 'plano de saude', 'consulta', 'exame', 'laboratorio', 'hospital',
      'dentista', 'psicologo', 'fisioterapeuta', 'remedio', 'medicamento'
    ],
    'Educação': [
      'curso', 'faculdade', 'universidade', 'escola', 'livro', 'material escolar', 'mensalidade',
      'matricula', 'apostila', 'workshop', 'treinamento'
    ],
    'Moradia': [
      'aluguel', 'condominio', 'conta de luz', 'energia eletrica', 'agua', 'gas', 'internet',
      'telefone', 'iptu', 'seguro residencial'
    ],
    'Lazer': [
      'cinema', 'teatro', 'show', 'viagem', 'passeio', 'entretenimento', 'bar', 'balada',
      'academia', 'esporte', 'hobby', 'jogo', 'netflix', 'spotify'
    ],
    'Vestuário': [
      'roupa', 'calcado', 'acessorio', 'loja de roupas', 'sapato', 'tenis', 'camisa', 'calca',
      'vestido', 'bolsa', 'carteira', 'relogio'
    ],
    'Serviços': [
      'manutencao', 'conserto', 'limpeza', 'beleza', 'barbearia', 'salao', 'cabeleireiro',
      'manicure', 'pedicure', 'lavanderia', 'oficina'
    ],
    'Casa': [
      'moveis', 'eletrodomesticos', 'decoracao', 'material de construcao', 'construcao',
      'reforma', 'ferramenta', 'tinta', 'cimento', 'areia', 'tijolo', 'telha', 'canos',
      'fiacao', 'lampada', 'sofa', 'cama', 'mesa', 'geladeira', 'fogao', 'microondas',
      'tv', 'computador', 'notebook', 'celular', 'smartphone'
    ],
    'Trabalho': [
      'material de escritorio', 'equipamento profissional', 'ferramenta profissional',
      'computador', 'notebook', 'impressora', 'papel', 'caneta', 'lapis', 'mochila',
      'uniforme', 'epi', 'equipamento de protecao'
    ],
    'Renda': [
      'salario', 'freela', 'bonus', 'comissao', 'renda extra', 'pagamento', 'recebimento',
      'transferencia recebida', 'deposito'
    ]
  };

  // Verificar cada categoria
  for (const [categoria, palavrasChave] of Object.entries(categorias)) {
    logger.debug?.(`[CATEGORIZACAO] Verificando categoria: ${categoria}`);
    for (const palavra of palavrasChave) {
      if (textoLower.includes(palavra)) {
        logger.debug?.(`[CATEGORIZACAO] ✅ Encontrou palavra-chave: "${palavra}" → Categoria: ${categoria}`);
        return categoria;
      }
    }
  }

  logger.debug?.(`[CATEGORIZACAO] ❌ Nenhuma palavra-chave encontrada`);
  return null;
}

// Função para análise inteligente com IA
// TODO: Migrar análise de IA para fila de background (BullMQ em Redis),
// evitando bloqueio do fluxo principal e melhorando escalabilidade.
async function analisarLancamentoComIA(userId, texto) {
  try {
    const TIMEOUT_MS = Math.max(3000, Number(process.env.GEMINI_TIMEOUT_MS || 7000));
    logger.info({ textoLen: (texto || '').length, timeoutMs: TIMEOUT_MS }, '[IA_ANALISE] Iniciando análise');
    
    // Primeiro, tentar categorizar por palavras-chave
    const categoriaPorPalavrasChave = categorizarPorPalavrasChave(texto);
    logger.debug?.(`[IA_ANALISE] Categoria por palavras-chave: ${categoriaPorPalavrasChave}`);
    
    const prompt = `
Analise a seguinte mensagem e extraia informações de um lançamento financeiro.
Retorne APENAS um JSON válido com a seguinte estrutura:

{
  "tipo": "gasto" ou "receita",
  "valor": número (apenas números, sem R$),
  "descricao": "descrição do lançamento",
  "categoria": "categoria mais apropriada",
  "pagamento": "pix", "dinheiro", "credito", "debito", "boleto", "transferencia" ou "NÃO INFORMADO",
  "data": "dd/mm/aaaa" (data atual se não especificada),
  "confianca": número de 0 a 1 (confiança na análise)
}

CATEGORIAS DISPONÍVEIS (use exatamente estas):

RECEITAS DE MOTORISTA/ENTREGADOR (tipo = "receita"):
- Uber (ganhos como motorista na plataforma Uber)
- 99Pop (ganhos como motorista na plataforma 99)
- iFood (ganhos como entregador no iFood)
- Rappi (ganhos como entregador no Rappi)
- Loggi (ganhos como entregador na Loggi)
- Entrega Particular (entregas fora de plataforma)
- Corrida Particular (corridas fora de plataforma)
- Ganhos (receita de trabalho autônomo sem plataforma específica)

DESPESAS OPERACIONAIS DE MOTORISTA/ENTREGADOR (tipo = "gasto"):
- Combustível (gasolina, etanol, diesel, abastecimento)
- Manutenção (óleo, pneu, mecânico, freio, bateria, alinhamento, borracharia)
- Pedágio (pedágio de rodovia ou pista)
- Estacionamento (estacionamento pago)
- Lavagem (lava-jato, lavagem do carro)
- Seguro Auto (seguro do veículo)
- Financiamento (parcela do financiamento do carro/moto)
- IPVA (IPVA, licenciamento do veículo)
- Multa (multa de trânsito)
- Celular (plano de celular, internet móvel)

CATEGORIAS GERAIS:
- Alimentação (comida, restaurante, mercado, lanche — não usar para ganhos de delivery)
- Transporte (passagem de ônibus, metrô, taxi de passageiro)
- Saúde (médico, farmácia, plano de saúde, consulta, exame)
- Educação (curso, faculdade, escola, livro, material escolar)
- Moradia (aluguel, condomínio, conta de luz, água, gás)
- Lazer (cinema, teatro, show, viagem, passeio, entretenimento)
- Vestuário (roupa, calçado, acessórios)
- Serviços (limpeza, beleza, barbearia, salão)
- Casa (móveis, eletrodomésticos, decoração, material de construção)
- Trabalho (material de escritório, equipamentos, ferramentas)
- Renda (salário, freela, bônus, comissão, renda extra)
- Outros (quando não se encaixa nas categorias acima)

REGRAS CRÍTICAS PARA MOTORISTAS/ENTREGADORES:
1. "ganhei X no uber" / "fiz X na 99" / "recebi X no ifood" → tipo="receita", categoria=plataforma (Uber/99Pop/iFood)
2. "abasteci X" / "coloquei X de gasolina" → tipo="gasto", categoria="Combustível"
3. "paguei pedágio X" / "X de pedágio" → tipo="gasto", categoria="Pedágio"
4. "troquei óleo X" / "pneu X" / "mecânico X" → tipo="gasto", categoria="Manutenção"
5. "lava jato X" / "lavagem X" → tipo="gasto", categoria="Lavagem"
6. Uber/99/iFood/Rappi como RECEITA nunca usam categoria "Transporte" ou "Alimentação"
7. "faturei X" / "rodei X hoje" sem plataforma → tipo="receita", categoria="Ganhos"

Exemplos driver:
- "ganhei 280 no uber" → {"tipo": "receita", "valor": 280, "descricao": "Uber", "categoria": "Uber", "pagamento": "pix", "confianca": 0.97}
- "fiz 150 na 99 hoje" → {"tipo": "receita", "valor": 150, "descricao": "99Pop", "categoria": "99Pop", "pagamento": "pix", "confianca": 0.97}
- "recebi 90 no ifood" → {"tipo": "receita", "valor": 90, "descricao": "iFood", "categoria": "iFood", "pagamento": "pix", "confianca": 0.97}
- "abasteci 180" → {"tipo": "gasto", "valor": 180, "descricao": "Combustível", "categoria": "Combustível", "pagamento": "NÃO INFORMADO", "confianca": 0.95}
- "paguei 18 de pedágio" → {"tipo": "gasto", "valor": 18, "descricao": "Pedágio", "categoria": "Pedágio", "pagamento": "NÃO INFORMADO", "confianca": 0.95}
- "troquei óleo 220" → {"tipo": "gasto", "valor": 220, "descricao": "Manutenção", "categoria": "Manutenção", "pagamento": "NÃO INFORMADO", "confianca": 0.95}
- "lavagem 35" → {"tipo": "gasto", "valor": 35, "descricao": "Lavagem", "categoria": "Lavagem", "pagamento": "NÃO INFORMADO", "confianca": 0.9}
- "faturei 320 hoje" → {"tipo": "receita", "valor": 320, "descricao": "Ganhos do dia", "categoria": "Ganhos", "pagamento": "pix", "confianca": 0.9}

Exemplos gerais:
- "Gasto de 2619,92 com Plano de Saúde no pix" → {"tipo": "gasto", "valor": 2619.92, "descricao": "Plano de Saúde", "categoria": "Saúde", "pagamento": "pix", "confianca": 0.95}
- "Gastei 78,80 na loja de materiais de construção no pix" → {"tipo": "gasto", "valor": 78.80, "descricao": "Loja de Materiais de Construção", "categoria": "Casa", "pagamento": "pix", "confianca": 0.95}
- "Recebi 5000 de salário" → {"tipo": "receita", "valor": 5000, "descricao": "Salário", "categoria": "Renda", "pagamento": "transferencia", "confianca": 0.95}

OUTRAS REGRAS:
- Materiais de construção, móveis, eletrodomésticos → "Casa"
- Material de escritório, equipamentos profissionais → "Trabalho"

DATAS RELATIVAS: "ontem" = data de ontem. "anteontem" = 2 dias atrás. "segunda", "terça" etc = o dia mais recente dessa semana. "semana passada" = 7 dias atrás. "dia 15" = dia 15 do mês atual (ou anterior se já passou). Sem referência de data → use a data atual.

${categoriaPorPalavrasChave ? `CATEGORIA DETECTADA: "${categoriaPorPalavrasChave}" — Use esta categoria se for apropriada para o contexto.` : ''}

Mensagem para analisar: "${texto}"

Data atual: ${new Date().toLocaleDateString('pt-BR')}
Dia da semana atual: ${['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'][new Date().getDay()]}
Ontem: ${new Date(Date.now() - 86400000).toLocaleDateString('pt-BR')}
Anteontem: ${new Date(Date.now() - 2*86400000).toLocaleDateString('pt-BR')}
`;

    // Abstração de timeout para a chamada de IA
    const withTimeout = (promise, ms) => {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('IA_TIMEOUT')), ms);
        promise.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
      });
    };

    if (!(await verificarLimiteGeminiDia(userId))) {
      logger.info({ userId }, '[IA_ANALISE] Limite diário Gemini atingido — abortando fallback');
      return null;
    }
    incrementarGeminiDia(userId).catch(() => {});
    const analiseGemini = await withTimeout(
      geminiService.gerarJSONComGemini(prompt),
      TIMEOUT_MS
    ) as any;
    if (analiseGemini) {
  logger.info({ tipo: analiseGemini.tipo, valor: analiseGemini.valor, categoria: analiseGemini.categoria, formaPagamento: analiseGemini.formaPagamento }, '[IA_ANALISE] OK');
    } else {
  logger.info('[IA_ANALISE] ❌ IA retornou nulo (sem resposta útil)');
    }
    if (!analiseGemini) {
  logger.info('[IA_ANALISE] ❌ IA indisponível/sem resposta. Abortando fallback.');
      return null;
    }
    
    // Validar se tem os campos essenciais
    if (!analiseGemini.tipo || !analiseGemini.valor || !analiseGemini.descricao) {
  logger.info('[IA_ANALISE] ❌ Campos essenciais faltando');
      return null;
    }
    
    // Normalizar forma de pagamento retornada pela IA
    const normalizar = (v) => {
      if (!v) return null;
      const s = removerAcentos(String(v).trim().toLowerCase());
      if (['nao informado', 'não informado', 'nao especificado', 'não especificado', 'indefinido', 'desconhecido'].includes(s)) {
        return null;
      }
      if (s.includes('pix')) return 'pix';
      if (s.includes('dinheiro') || s.includes('cash')) return 'dinheiro';
      if (s.includes('credito') || s.includes('cartao de credito') || s.includes('cartao') || s.includes('cartão')) return 'credito';
      if (s.includes('debito') || s.includes('cartao de debito')) return 'debito';
      if (s.includes('boleto')) return 'boleto';
      if (s.includes('transferencia') || s.includes('transferencia bancaria') || s.includes('transferencia bancária') || s.includes('ted') || s.includes('doc') || s.includes('transfer')) return 'transferencia';
      return null;
    };
    const pagamentoNormalizado = normalizar(analiseGemini.pagamento ?? analiseGemini.formaPagamento);

    const categoriaFinal = categoriaPorPalavrasChave || analiseGemini.categoria || 'Outros';
    const PLATAFORMAS_RECEITA = new Set(['Uber', '99Pop', 'iFood', 'Rappi', 'Loggi', 'Entrega Particular', 'Corrida Particular', 'Ganhos']);
    const tipoFinal = PLATAFORMAS_RECEITA.has(categoriaFinal) ? 'receita' : analiseGemini.tipo;

    const resultado = {
      tipo: tipoFinal,
      valor: analiseGemini.valor,
      descricao: analiseGemini.descricao,
      categoria: categoriaFinal,
      pagamento: pagamentoNormalizado || 'NÃO INFORMADO',
      data: new Date().toLocaleDateString('pt-BR'),
      faltaFormaPagamento: !pagamentoNormalizado,
      faltaDataVencimento: false,
      parcelamento: false,
      recorrente: false
    };
    
  logger.info({ tipo: resultado.tipo, valor: resultado.valor, categoria: resultado.categoria, pagamento: resultado.pagamento }, '[IA_ANALISE] Resultado final resumido');
  logger.info({ categoriaFinal: resultado.categoria, chave: categoriaPorPalavrasChave || 'nenhuma', ia: analiseGemini.categoria || 'n/a' }, '[IA_ANALISE] Categoria final');
    
    return resultado;
  } catch (error) {
    if (String(error && (error as any).message) === 'IA_TIMEOUT') {
  logger.warn('[IA_ANALISE] ⏱️ Timeout atingido na análise de IA');
    } else {
  logger.error({ err: (error as any)?.message || error }, '[IA_ANALISE] Erro tratado na análise de IA');
    }
    return null;
  }
}

// Função para calcular data futura
function calcularDataFutura(dataInicial: Date, mesesAdicionar: number) {
  // Evitar efeito de timezone ao usar Date com string ISO
  const data = new Date(dataInicial.getFullYear(), dataInicial.getMonth(), dataInicial.getDate());
  data.setMonth(data.getMonth() + mesesAdicionar);
  // Retorna em dd/mm/aaaa
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Função para criar parcelamento
async function criarParcelamento(userId, parsed, cartaoInfo: any = null) {
  const parcelamentoId = gerarIdUnico();
  const valorParcela = parsed.valor / parsed.numParcelas;
  // Evitar timezone: construir Date com componentes locais dd/mm/aaaa
  const [diaStr, mesStr, anoStr] = parsed.data.split('/');
  const dataInicial = new Date(parseInt(anoStr, 10), parseInt(mesStr, 10) - 1, parseInt(diaStr, 10));
  
  let lancamentosCriados: any[] = [];

  for (let i = 0; i < parsed.numParcelas; i++) {
    const dataParcela = calcularDataFutura(dataInicial, i);
    const descricaoParcela = `${parsed.descricao} (${i + 1}/${parsed.numParcelas})`;
    
    // Calcular data de contabilização se for cartão
    let resultadoContabilizacao = null;
    if (cartaoInfo) {
      resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(
        dataParcela.split('/').reverse().join('-'),
        cartaoInfo.dia_vencimento
      );
    }
    
    const dados = {
      data: dataParcela.split('/').reverse().join('-'),
      tipo: parsed.tipo.toLowerCase(),
      descricao: descricaoParcela,
      valor: valorParcela,
      categoria: parsed.categoria,
      pagamento: parsed.pagamento,
      parcelamento_id: parcelamentoId,
      parcela_atual: i + 1,
      total_parcelas: parsed.numParcelas,
      recorrente: null,
      recorrente_fim: null,
      recorrente_id: null,
      cartao_nome: cartaoInfo ? cartaoInfo.nome_cartao : null,
      data_lancamento: cartaoInfo ? formatarDateParaISO(new Date()) : null,
      data_contabilizacao: cartaoInfo ? formatarDateParaISO((resultadoContabilizacao as any).dataContabilizacao) : null,
      mes_fatura: cartaoInfo ? (resultadoContabilizacao as any).mesFatura : null,
      ano_fatura: cartaoInfo ? (resultadoContabilizacao as any).anoFatura : null,
      dia_vencimento: cartaoInfo ? cartaoInfo.dia_vencimento : null,
      status_fatura: cartaoInfo ? 'pendente' : null,
      data_vencimento: converterDataParaISO(parsed.dataVencimento)
    };

    await lancamentosService.salvarLancamento(userId, dados as any);
    lancamentosCriados.push({ data: dataParcela, valor: valorParcela, parcela: i + 1 } as any);
  }
  
  return { parcelamentoId, lancamentosCriados };
}

// Função para criar recorrente
async function criarRecorrente(userId, parsed, cartaoInfo: any = null) {
  const recorrenteId = gerarIdUnico();
  const dataInicial = new Date(parsed.data.split('/').reverse().join('-'));
  const dataFim = calcularDataFutura(dataInicial, parsed.recorrenteMeses - 1);

  let lancamentosCriados: any[] = [];

  for (let i = 0; i < parsed.recorrenteMeses; i++) {
    const dataRecorrente = calcularDataFutura(dataInicial, i);
    
    // Calcular data de contabilização se for cartão
    let resultadoContabilizacao = null;
    if (cartaoInfo) {
      resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(dataRecorrente.split('/').reverse().join('-'), cartaoInfo.dia_vencimento);
    }
    
    const dados = {
      data: dataRecorrente.split('/').reverse().join('-'),
      tipo: parsed.tipo.toLowerCase(),
      descricao: parsed.descricao,
      valor: parsed.valor,
      categoria: parsed.categoria,
      pagamento: parsed.pagamento,
      parcelamento_id: null,
      parcela_atual: null,
      total_parcelas: null,
      recorrente: true,
      recorrente_fim: dataFim.split('/').reverse().join('-'),
      recorrente_id: recorrenteId,
      cartao_nome: cartaoInfo ? cartaoInfo.nome_cartao : null,
      data_lancamento: cartaoInfo ? formatarDateParaISO(new Date()) : null,
      data_contabilizacao: cartaoInfo ? formatarDateParaISO((resultadoContabilizacao as any).dataContabilizacao) : null,
      mes_fatura: cartaoInfo ? (resultadoContabilizacao as any).mesFatura : null,
      ano_fatura: cartaoInfo ? (resultadoContabilizacao as any).anoFatura : null,
      dia_vencimento: cartaoInfo ? cartaoInfo.dia_vencimento : null,
      status_fatura: cartaoInfo ? 'pendente' : null,
      data_vencimento: converterDataParaISO(parsed.dataVencimento)
    };

    await lancamentosService.salvarLancamento(userId, dados as any);
    lancamentosCriados.push({ data: dataRecorrente, valor: parsed.valor, mes: i + 1 });
  }
  
  return { recorrenteId, lancamentosCriados };
}

// Função para gerar mensagem de sucesso
async function gerarMensagemSucesso(userId: string, parsed, cartao: any = null) {
  const isReceita = parsed.tipo && parsed.tipo.toLowerCase() === 'receita';

  const [lucroReal, metaDiaria, resumoDia] = await Promise.all([
    driverService.getLucroDia(userId),
    driverService.getGoal(userId, 'DIARIA'),
    driverService.getResumoDia(userId),
  ]);

  const emojiLucro = lucroReal >= 0 ? '🟢' : '🔴';
  const tipo = isReceita ? 'Receita' : 'Custo';
  let msg = `✅ *${tipo} registrado:*\n${parsed.categoria} — ${formatarComMoeda(parsed.valor)}`;
  const temFixo = resumoDia.custosFixosRateados > 0;

  if (metaDiaria && lucroReal >= metaDiaria.valor) {
    msg += `\n\n🎯 *Meta diária atingida!* Lucro real hoje: ${formatarComMoeda(lucroReal)}. Parabéns! 🏆`;
  } else {
    msg += `\n\n${emojiLucro} Lucro real hoje: ${formatarComMoeda(lucroReal)}`;
    if (temFixo) msg += `\n📌 (já descontados ${formatarComMoeda(resumoDia.custosFixosRateados)} de custos fixos)`;
    if (metaDiaria) {
      const faltam = metaDiaria.valor - lucroReal;
      if (faltam > 0) msg += `\n💡 Faltam ${formatarComMoeda(faltam)} para sua meta diária`;
    }
  }

  return msg;
}

async function enviarConfirmacaoInterativa(sock, userId, lancamentoId: any, parsed: any, mensagemSucesso: string) {
  const lancamentoParaEstado = {
    id: lancamentoId,
    data: parsed.data ? parsed.data.split('/').reverse().join('-') : new Date().toISOString().slice(0, 10),
    tipo: parsed.tipo,
    descricao: parsed.descricao,
    valor: parsed.valor,
    categoria: parsed.categoria,
    pagamento: parsed.pagamento,
  };
  await sock.sendInteractiveMessage(userId, {
    type: 'button',
    body: mensagemSucesso,
    buttons: [
      { id: 'pos_editar', title: '✏️ Editar' },
      { id: 'pos_ok', title: '👍 OK' },
    ],
  });
  await definirEstado(userId, 'aguardando_pos_lancamento', { lancamentoId, lancamento: lancamentoParaEstado });
}

async function lancamentoCommand(sock, userId, texto) {
  logger.info({ userId, textoLen: (texto || '').length }, '[LANCAMENTO] Comando iniciado');
  try {
    return await _lancamentoCommandImpl(sock, userId, texto);
  } catch (e: any) {
    if (e?.message === 'LIMITE_LANCAMENTOS_DIA') {
      await sock.sendMessage(userId, {
        text: '⚠️ *Limite diário atingido*\n\nVocê atingiu o limite de 100 lançamentos por dia. Tente novamente amanhã.',
      });
      return;
    }
    throw e;
  }
}

async function _lancamentoCommandImpl(sock, userId, texto) {

  // 0. Fluxo aguardando ação pós-lançamento (botão Editar / OK)
  const estadoInicial = await obterEstado(userId);
  if (estadoInicial?.etapa === 'aguardando_pos_lancamento') {
    const { lancamentoId, lancamento } = estadoInicial.dadosParciais as any;
    const resposta = texto.trim();
    if (resposta === 'pos_ok' || resposta === '2' || resposta.toLowerCase() === 'ok') {
      await limparEstado(userId);
      return;
    }
    if (resposta === 'pos_editar' || resposta === '1' || resposta.toLowerCase() === 'editar') {
      await definirEstado(userId, 'aguardando_campo_edicao_lancamento', {
        lancamentoId,
        lancamento,
        campo: null
      });
      const dataExibir = new Date(lancamento.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '📝 Editar Lançamento',
        body:
          `📅 ${dataExibir}  💰 ${formatarComMoeda(lancamento.valor)}\n` +
          `📂 ${lancamento.categoria}  💳 ${lancamento.pagamento}\n` +
          `📝 ${lancamento.descricao}\n\nQual campo deseja editar?`,
        buttonLabel: 'Ver campos',
        sections: [{
          rows: [
            { id: '1', title: '💰 Valor' },
            { id: '2', title: '📂 Categoria' },
            { id: '3', title: '📝 Descrição' },
            { id: '4', title: '💳 Forma de pagamento' },
            { id: '5', title: '📅 Data' },
            { id: '0', title: '❌ Cancelar' },
          ],
        }],
      });
      return;
    }
    // Input não reconhecido como botão — limpa estado e processa como novo lançamento
    await limparEstado(userId);
  }

  // 1. Fluxo aguardando confirmação da IA
  const estado = await obterEstado(userId);
  if (estado?.etapa === 'aguardando_confirmacao_ia') {
    const parsed = estado.dadosParciais as any;
    // Tratamento específico para áudio
    if (parsed?.origem === 'audio') {
      const resposta = texto.toLowerCase().trim();

      // Permitir ajuste de categoria também para áudios
      if (resposta.startsWith('categoria ')) {
        const novaCategoria = resposta.replace('categoria ', '').trim();
        const categoriasValidas = [
          'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Moradia',
          'Lazer', 'Vestuário', 'Serviços', 'Casa', 'Trabalho', 'Renda', 'Outros'
        ];

        if (categoriasValidas.includes(novaCategoria)) {
          parsed.categoria = novaCategoria;
          const pagamentoView = parsed.formaPagamento || parsed.pagamento || 'NÃO INFORMADO';
          await sock.sendInteractiveMessage(userId, {
            type: 'button',
            header: '🤖 Interpretação do áudio',
            body:
              `🗣️ _${String(parsed.transcricao || '').slice(0, 300)}_\n\n` +
              `💰 Valor: ${formatarComMoeda(parsed.valor)}\n` +
              `📝 Descrição: ${parsed.descricao}\n` +
              `📂 Categoria: ${parsed.categoria}\n` +
              `💳 Pagamento: ${pagamentoView}\n` +
              `📅 Data: ${parsed.data}`,
            footer: 'Para ajustar a categoria, digite: categoria [nome]',
            buttons: [
              { id: 'ia_confirmar', title: '✅ Confirmar' },
              { id: 'ia_cancelar', title: '❌ Cancelar' },
            ],
          });
          return;
        } else {
          await sock.sendMessage(userId, {
            text: `❌ Categoria inválida. Categorias disponíveis:\n\n${categoriasValidas.map(cat => `• ${cat}`).join('\n')}\n\n💡 Digite: "categoria [nome_da_categoria]"`
          });
          return;
        }
      }

      const opcaoConfirmacao = parseInt(resposta, 10);
      const confirmou = resposta === 'ia_confirmar' || (!isNaN(opcaoConfirmacao) && opcaoConfirmacao === 1) || ['s', 'sim', 'y', 'yes'].includes(resposta);
      const negou = resposta === 'ia_cancelar' || (!isNaN(opcaoConfirmacao) && opcaoConfirmacao === 2) || ['n', 'nao', 'não', 'no'].includes(resposta);

      if (confirmou) {
        const dataBR = (() => {
          try {
            const [yy, mm, dd] = String(parsed.data || '').split('-');
            if (yy && mm && dd) return `${dd}/${mm}/${yy}`;
          } catch {}
          return new Date().toLocaleDateString('pt-BR');
        })();

        const parsedCompat = {
          tipo: parsed.tipo || 'gasto',
          valor: parsed.valor,
          descricao: parsed.descricao,
          categoria: parsed.categoria || 'Outros',
          pagamento: parsed.formaPagamento || parsed.pagamento || 'NÃO INFORMADO',
          data: dataBR,
          faltaFormaPagamento: false,
          faltaDataVencimento: false,
          parcelamento: parsed.parcelado || false,
          numParcelas: parsed.parcelas || 1,
          parcelas_totais: parsed.parcelas || 1,
          parcela_atual: 1,
          recorrente: false,
        };

        await limparEstado(userId);
        return await processarLancamento(sock, userId, parsedCompat, texto);
      }

      if (negou) {
        await limparEstado(userId);
        await sock.sendMessage(userId, { text: '❌ Lançamento cancelado.' });
        return;
      }

      await sock.sendMessage(userId, { text: '❌ Opção inválida. Responda com 1 (Sim) ou 2 (Não), ou "S"/"N".' });
      return;
    }
    // Tratamento específico para voucher
    if (parsed?.origem === 'voucher') {
      const resposta = texto.toLowerCase().trim();

      // Permitir ajuste de categoria também para vouchers
      if (resposta.startsWith('categoria ')) {
        const novaCategoria = resposta.replace('categoria ', '').trim();
        const categoriasValidas = [
          'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Moradia',
          'Lazer', 'Vestuário', 'Serviços', 'Casa', 'Trabalho', 'Renda', 'Outros'
        ];

        if (categoriasValidas.includes(novaCategoria)) {
          parsed.categoria = novaCategoria;
          const pagamentoView = parsed.formaPagamento || parsed.pagamento || 'NÃO INFORMADO';
          const parceladoTexto = parsed.parcelado ? `\n🔢 Parcelado: Sim (${parsed.parcelas}x)` : '';
          await sock.sendInteractiveMessage(userId, {
            type: 'button',
            header: '🤖 Análise do comprovante',
            body:
              `💰 Valor: ${formatarComMoeda(parsed.valor)}\n` +
              `📝 Descrição: ${parsed.descricao}\n` +
              `📂 Categoria: ${parsed.categoria}\n` +
              `💳 Pagamento: ${pagamentoView}\n` +
              `📅 Data: ${parsed.data}` +
              parceladoTexto,
            footer: 'Para ajustar a categoria, digite: categoria [nome]',
            buttons: [
              { id: 'ia_confirmar', title: '✅ Confirmar' },
              { id: 'ia_cancelar', title: '❌ Cancelar' },
            ],
          });
          return;
        } else {
          await sock.sendMessage(userId, {
            text: `❌ Categoria inválida. Categorias disponíveis:\n\n${categoriasValidas.map(cat => `• ${cat}`).join('\n')}\n\n💡 Digite: "categoria [nome_da_categoria]"`
          });
          return;
        }
      }

      const opcaoConfirmacao = parseInt(resposta, 10);
      const confirmou = resposta === 'ia_confirmar' || (!isNaN(opcaoConfirmacao) && opcaoConfirmacao === 1) || ['s', 'sim', 'y', 'yes'].includes(resposta);
      const negou = resposta === 'ia_cancelar' || (!isNaN(opcaoConfirmacao) && opcaoConfirmacao === 2) || ['n', 'nao', 'não', 'no'].includes(resposta);

      if (confirmou) {
        // Montar parsed compatível com processarLancamento para reaproveitar fluxo (cartão, parcelamento, etc.)
        const dataBR = (() => {
          try {
            const [yy, mm, dd] = String(parsed.data || '').split('-');
            if (yy && mm && dd) return `${dd}/${mm}/${yy}`;
          } catch {}
          return new Date().toLocaleDateString('pt-BR');
        })();

        const parsedCompat = {
          tipo: parsed.tipo || 'gasto',
          valor: parsed.valor,
          descricao: parsed.descricao,
          categoria: parsed.categoria || 'Outros',
          pagamento: parsed.formaPagamento || parsed.pagamento || 'NÃO INFORMADO',
          data: dataBR,
          faltaFormaPagamento: false,
          faltaDataVencimento: false,
          parcelamento: parsed.parcelado || false,
          numParcelas: parsed.parcelas || 1,
          parcelas_totais: parsed.parcelas || 1,
          parcela_atual: 1,
          recorrente: false,
        };

        await limparEstado(userId);
        return await processarLancamento(sock, userId, parsedCompat, texto);
      }

      if (negou) {
        await limparEstado(userId);
        await sock.sendMessage(userId, { text: '❌ Lançamento cancelado.' });
        return;
      }

      await sock.sendMessage(userId, { text: '❌ Opção inválida. Responda com 1 (Sim) ou 2 (Não), ou "S"/"N".' });
      return;
    }

    const resposta = texto.toLowerCase().trim();
    
    // Verificar se quer alterar categoria
    if (resposta.startsWith('categoria ')) {
      const novaCategoria = resposta.replace('categoria ', '').trim();
      const categoriasValidas = [
        'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Moradia', 
        'Lazer', 'Vestuário', 'Serviços', 'Casa', 'Trabalho', 'Renda', 'Outros'
      ];
      
      if (categoriasValidas.includes(novaCategoria)) {
        parsed.categoria = novaCategoria;
        await sock.sendInteractiveMessage(userId, {
          type: 'button',
          header: '🤖 Análise da IA',
          body:
            `💰 Valor: ${formatarComMoeda(parsed.valor)}\n` +
            `📝 Descrição: ${parsed.descricao}\n` +
            `📂 Categoria: ${parsed.categoria}\n` +
            `💳 Pagamento: ${parsed.pagamento === 'NÃO INFORMADO' ? 'Não informado' : parsed.pagamento}\n` +
            `📅 Data: ${parsed.data}`,
          footer: 'Para ajustar a categoria, digite: categoria [nome]',
          buttons: [
            { id: 'ia_confirmar', title: '✅ Confirmar' },
            { id: 'ia_cancelar', title: '❌ Cancelar' },
          ],
        });
        return;
      } else {
        await sock.sendMessage(userId, {
          text: `❌ Categoria inválida. Categorias disponíveis:\n\n${categoriasValidas.map(cat => `• ${cat}`).join('\n')}\n\n💡 Digite: "categoria [nome_da_categoria]"`
        });
        return;
      }
    }
    
    const opcaoConfirmacao = parseInt(resposta, 10);
    if (!isNaN(opcaoConfirmacao) || resposta === 'ia_confirmar' || resposta === 'ia_cancelar') {
      if (opcaoConfirmacao === 1 || resposta === 'ia_confirmar') {
        // Usuário confirmou; se forma de pagamento não informada, solicitar antes de processar
        if (String(parsed.tipo || '').toLowerCase() === 'gasto' && (!parsed.pagamento || parsed.pagamento === 'NÃO INFORMADO' || parsed.faltaFormaPagamento)) {
          await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
          await sock.sendInteractiveMessage(userId, {
            type: 'list',
            header: '💳 Como pagou?',
            body: 'Selecione a forma de pagamento:',
            buttonLabel: 'Ver opções',
            sections: [{ rows: [
              { id: '1', title: '💠 Pix' },
              { id: '2', title: '💵 Dinheiro' },
              { id: '3', title: '💳 Cartão de crédito' },
              { id: '4', title: '🏦 Débito' },
              { id: '5', title: '📋 Boleto' },
              { id: '6', title: '🔄 Transferência' },
            ]}],
          });
          return;
        }
        // Forma de pagamento presente, processar lançamento
        await limparEstado(userId);
        return await processarLancamento(sock, userId, parsed, texto);
      }
      if (opcaoConfirmacao === 2 || resposta === 'ia_cancelar') {
        await limparEstado(userId);
        await sock.sendMessage(userId, {
          text: '❌ Lançamento cancelado. Tente novamente com um formato mais claro.'
        });
        return;
      }
      // Opção inválida
      await sock.sendMessage(userId, { text: '❌ Opção inválida. Digite 1 para Sim ou 2 para Não.' });
      return;
    }
    // Backward compatibility: aceitar textos
    if (resposta === 'sim' || resposta === 's' || resposta === 'yes' || resposta === 'y') {
      // Usuário confirmou; se forma de pagamento não informada, solicitar antes de processar
      if (String(parsed.tipo || '').toLowerCase() === 'gasto' && (!parsed.pagamento || parsed.pagamento === 'NÃO INFORMADO' || parsed.faltaFormaPagamento)) {
        await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
        await sock.sendInteractiveMessage(userId, {
          type: 'list',
          header: '💳 Como pagou?',
          body: 'Selecione a forma de pagamento:',
          buttonLabel: 'Ver opções',
          sections: [{ rows: [
            { id: '1', title: '💠 Pix' },
            { id: '2', title: '💵 Dinheiro' },
            { id: '3', title: '💳 Cartão de crédito' },
            { id: '4', title: '🏦 Débito' },
            { id: '5', title: '📋 Boleto' },
            { id: '6', title: '🔄 Transferência' },
          ]}],
        });
        return;
      }
      // Forma de pagamento presente, processar lançamento
      await limparEstado(userId);
      return await processarLancamento(sock, userId, parsed, texto);
    } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n' || resposta === 'no') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: '❌ Lançamento cancelado. Tente novamente com um formato mais claro.' 
      });
      return;
    } else {
      await sock.sendMessage(userId, { text: '❌ Opção inválida. Digite 1 para Sim ou 2 para Não.' });
      return;
    }
  }

  // 2. Fluxo aguardando forma de pagamento
  if (estado?.etapa === 'aguardando_forma_pagamento') {
    const parsed = estado.dadosParciais as any;
    await limparEstado(userId);

    const textoNorm = texto.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    const mapaFormas: Record<string, string> = {
      '1': 'pix', 'pix': 'pix',
      '2': 'dinheiro', 'dinheiro': 'dinheiro',
      '3': 'credito', 'credito': 'credito', 'cartao': 'credito',
      '4': 'debito', 'debito': 'debito',
      '5': 'boleto', 'boleto': 'boleto',
      '6': 'transferencia', 'transferencia': 'transferencia', 'ted': 'transferencia', 'doc': 'transferencia',
    };

    const formaPagamento = mapaFormas[textoNorm];
    if (!formaPagamento) {
      await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '❌ Opção inválida',
        body: 'Selecione uma das formas de pagamento disponíveis:',
        buttonLabel: 'Ver opções',
        sections: [{ rows: [
          { id: '1', title: '💠 Pix' },
          { id: '2', title: '💵 Dinheiro' },
          { id: '3', title: '💳 Cartão de crédito' },
          { id: '4', title: '🏦 Débito' },
          { id: '5', title: '📋 Boleto' },
          { id: '6', title: '🔄 Transferência' },
        ]}],
      });
      return;
    }

    parsed.pagamento = formaPagamento;
    return await processarLancamento(sock, userId, parsed, texto);
  }

  // 2. Fluxo aguardando data de vencimento
  if (estado?.etapa === 'aguardando_data_vencimento') {
    const parsed = estado.dadosParciais as any;
    await limparEstado(userId);
    
    // Validar data
    const dataRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    if (!dataRegex.test(texto)) {
      await sock.sendMessage(userId, { 
        text: '❌ Data inválida. Use o formato dd/mm/aaaa (ex: 25/10/2025)' 
      });
      return;
    }
    
    parsed.dataVencimento = texto;
    return await processarLancamento(sock, userId, parsed, texto);
  }

  // 3. Fluxo aguardando escolha de cartão
  if (estado?.etapa === 'aguardando_escolha_cartao') {
    const parsed = estado.dadosParciais as any;
    await limparEstado(userId);
    
    // Verificar se o usuário quer cancelar
    if (texto.toLowerCase() === 'cancelar' || texto === '0') {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Operação cancelada',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Status',
            itens: ['Seleção de cartão cancelada pelo usuário'],
            emoji: '🛑'
          }],
          dicas: [
            { texto: 'Registrar novo lançamento', comando: 'gastei 50 no mercado no pix' },
            { texto: 'Ver ajuda', comando: 'ajuda' },
            { texto: 'Ver cartões', comando: 'cartoes' }
          ]
        })
      });
      return;
    }
    
    const cartoes = await cartoesService.listarCartoesConfigurados(userId);
    const escolha = parseInt(texto) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= cartoes.length) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Opção inválida',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: [`Digite um número entre 1 e ${cartoes.length} ou "0" para cancelar`],
            emoji: '💡'
          }],
          dicas: [
            { texto: 'Ver cartões disponíveis', comando: 'cartoes' },
            { texto: 'Cancelar operação', comando: '0 ou cancelar' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
      return;
    }
    
    const cartaoEscolhido = cartoes[escolha];
  logger.debug?.({ cartaoEscolhido }, '🔔 Cartão escolhido');
    
    // Processar com base em parcelamento/recorrente ou simples
    if (parsed.parcelamento && parsed.numParcelas > 1) {
      const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed, cartaoEscolhido);
      await limparEstado(userId);
      let msg = `✅ Parcelamento registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n`;
      msg += `💰 Valor total: ${formatarComMoeda(parsed.valor)}\n`;
      msg += `📦 ${parsed.numParcelas}x de ${formatarComMoeda(parsed.valor / parsed.numParcelas)}\n`;
      msg += `📂 Categoria: ${parsed.categoria}\n`;
      msg += `📝 Descrição: ${parsed.descricao}`;
      await sock.sendMessage(userId, { text: msg });
      return;
    }

    if (parsed.recorrente && parsed.recorrenteMeses > 1) {
      const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartaoEscolhido);
      await limparEstado(userId);
      let msg = `✅ Lançamento recorrente registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n`;
      msg += `💰 Valor: ${formatarComMoeda(parsed.valor)}\n`;
      msg += `📅 ${parsed.recorrenteMeses} meses\n`;
      msg += `📂 Categoria: ${parsed.categoria}\n`;
      msg += `📝 Descrição: ${parsed.descricao}`;
      await sock.sendMessage(userId, { text: msg });
      return;
    }

    // Gasto simples no cartão
    const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(
      parsed.data.split('/').reverse().join('-'),
      cartaoEscolhido.dia_vencimento
    );
    const dados = {
      data: parsed.data.split('/').reverse().join('-'),
      tipo: parsed.tipo.toLowerCase(),
      descricao: parsed.descricao,
      valor: parsed.valor,
      categoria: parsed.categoria,
      pagamento: parsed.pagamento,
      cartao_nome: cartaoEscolhido.nome_cartao,
      data_lancamento: formatarDateParaISO(new Date()),
      data_contabilizacao: formatarDateParaISO(resultadoContabilizacao.dataContabilizacao),
      mes_fatura: resultadoContabilizacao.mesFatura,
      ano_fatura: resultadoContabilizacao.anoFatura,
      dia_vencimento: cartaoEscolhido.dia_vencimento,
      status_fatura: 'pendente',
      data_vencimento: converterDataParaISO(parsed.dataVencimento),
      mensagemOriginal: texto,
    };
  logger.info({ tipo: dados.tipo, valor: dados.valor, categoria: dados.categoria, pagamento: dados.pagamento, cartao: dados.cartao_nome }, '🔔 Dados do lançamento (resumo)');
    const novoIdEscolhido = await lancamentosService.salvarLancamento(userId, dados as any);
    await limparEstado(userId);
    const msgEscolhido = await gerarMensagemSucesso(userId, parsed, cartaoEscolhido);
    await enviarConfirmacaoInterativa(sock, userId, novoIdEscolhido, parsed, msgEscolhido);

    // Verificar orçamento da categoria
    if (parsed.tipo === 'gasto' && parsed.categoria) {
      const orcamento = await databaseService.buscarOrcamento(userId, parsed.categoria);
      if (orcamento) {
        const totalMes = await databaseService.getTotalCategoriaNoMes(userId, parsed.categoria);
        const pct = Math.round((totalMes / orcamento.limite) * 100);
        if (pct >= 100) {
          await sock.sendMessage(userId, {
            text: `🔴 *Orçamento estourado!* ${parsed.categoria}: ${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)} (${pct}%)`
          });
        } else if (pct >= 80) {
          await sock.sendMessage(userId, {
            text: `🟡 *Atenção!* Orçamento de ${parsed.categoria}: ${pct}% usado (${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)})`
          });
        }
      }
    }
    return;
  }

  // 4. Guardar contra inputs de seleção de menu sem estado Redis ativo.
  // Números simples (1, 2, 3...) chegam aqui quando o estado expirou enquanto o
  // usuário estava no meio de um fluxo (ex: onboarding). Sem contexto, não há como
  // saber o que "1" significa — gravar R$ 1,00 seria silenciosamente errado.
  const textoTrimmed = (texto || '').trim();
  if (/^\d{1,2}$/.test(textoTrimmed)) {
    logger.warn({ userId, texto: textoTrimmed }, '[LANCAMENTO] Número solto sem estado ativo — abortando para evitar lançamento espúrio');
    await sock.sendMessage(userId, {
      text: 'Não entendi. Quer registrar um ganho, um gasto ou ver seu resumo?\n\n• _ganhei 280 no uber_\n• _abasteci 150 de gasolina_\n• _resumo_\n\nDigite *ajuda* para ver tudo que posso fazer.',
    });
    return;
  }

  // 5. Parsear mensagem — tenta driver parser primeiro (mais específico)
  const driverParsed = parseDriverMessage(texto);
  if (driverParsed) {
    logger.info({ tipo: driverParsed.tipo, valor: driverParsed.valor, categoria: driverParsed.categoria, platform: driverParsed.platform }, '[LANCAMENTO] Driver parser detectou frase driver-específica');
    // Converte para o formato esperado por processarLancamento
    const parsedDriver = {
      tipo: driverParsed.tipo,
      valor: driverParsed.valor,
      descricao: driverParsed.descricao,
      categoria: driverParsed.categoria,
      pagamento: driverParsed.pagamento,
      data: driverParsed.data,
      dataVencimento: null,
      faltaFormaPagamento: driverParsed.faltaFormaPagamento,
      faltaDataVencimento: false,
      parcelamento: false,
      recorrente: false,
      numParcelas: 1,
      recorrenteMeses: 0,
      confiancaCategoria: 'alta' as const,
      platform: driverParsed.platform,
      business_context: driverParsed.business_context,
    };

    if (parsedDriver.faltaFormaPagamento && parsedDriver.tipo === 'gasto') {
      await definirEstado(userId, 'aguardando_forma_pagamento', parsedDriver as any);
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '💳 Como pagou?',
        body: 'Selecione a forma de pagamento:',
        buttonLabel: 'Ver opções',
        sections: [{ rows: [
          { id: '1', title: '💠 Pix' },
          { id: '2', title: '💵 Dinheiro' },
          { id: '3', title: '💳 Cartão de crédito' },
          { id: '4', title: '🏦 Débito' },
          { id: '5', title: '📋 Boleto' },
          { id: '6', title: '🔄 Transferência' },
        ]}],
      });
      return;
    }

    return await processarLancamento(sock, userId, parsedDriver, texto);
  }

  let parsed = parseMessage(texto);
  const parsedNormal = parsed;
  logger.info({ valor: parsed?.valor ?? 'n/a', categoria: parsed?.categoria ?? 'n/a', pagamento: parsed?.pagamento ?? 'n/a' }, '[LANCAMENTO] Parse normal resumo');
  
  // Se o parse normal falhou ou categoria é incerta, tentar cache e depois IA
  if (!parsed || !parsed.valor || parsed.categoria === 'Outros' || parsed.confiancaCategoria === 'nenhuma') {
    // 1. Consultar cache de padrões confirmados antes de chamar a IA
    if (parsed?.valor) {
      const padrao = normalizarParaCache(texto);
      const cacheHit = await databaseService.buscarParserCache(padrao);
      if (cacheHit) {
        logger.info({ padrao, categoria: cacheHit.categoria }, '[LANCAMENTO] Cache hit — IA não necessária');
        const parsedFromCache = {
          tipo: cacheHit.tipo,
          categoria: cacheHit.categoria,
          pagamento: cacheHit.pagamento ?? 'NÃO INFORMADO',
          valor: parsed.valor,
          descricao: texto,
          data: parsed.data,
          faltaFormaPagamento: !cacheHit.pagamento || cacheHit.pagamento === 'NÃO INFORMADO',
          faltaDataVencimento: false,
          parcelamento: false,
          recorrente: false,
          numParcelas: 1,
          confiancaCategoria: 'alta' as const,
        };
        return await processarLancamento(sock, userId, parsedFromCache, texto);
      }
    }

  logger.info('[LANCAMENTO] Parse normal falhou, tentando com IA...');
    // Aviso imediato ao usuário para reduzir latência percebida
    await sock.sendMessage(userId, {
      text: '⌛ Estou analisando sua mensagem, só um instante.'
    });

    const parsedIA = await analisarLancamentoComIA(userId, texto);

    // Registrar fallback para análise posterior (reduzir dependência da IA)
    databaseService.registrarIAFallback(
      userId,
      texto,
      parsedIA?.categoria ?? null,
      parsedIA?.tipo ?? null,
      parsedIA?.valor ?? null
    ).catch(() => {});

    if (parsedIA && parsedIA.valor) {
  logger.info('[LANCAMENTO] ✅ IA fallback retornou um parsed válido.');

      // Confirmar com o usuário se a IA entendeu corretamente
      const avisoConfianca = (parsedIA as any).confianca < 0.6
        ? '\n\n⚠️ _Não tenho certeza sobre este lançamento — revise os dados antes de confirmar._'
        : '';
      await sock.sendInteractiveMessage(userId, {
        type: 'button',
        header: '🤖 Análise da IA',
        body:
          `💰 Valor: ${formatarComMoeda(parsedIA.valor)}\n` +
          `📝 Descrição: ${parsedIA.descricao}\n` +
          `📂 Categoria: ${parsedIA.categoria}\n` +
          `💳 Pagamento: ${parsedIA.pagamento === 'NÃO INFORMADO' ? 'Não informado' : parsedIA.pagamento}\n` +
          `📅 Data: ${parsedIA.data}` +
          avisoConfianca,
        footer: 'Para ajustar a categoria, digite: categoria [nome]',
        buttons: [
          { id: 'ia_confirmar', title: '✅ Confirmar' },
          { id: 'ia_cancelar', title: '❌ Cancelar' },
        ],
      });

      // Salva texto original no estado para gravar no cache ao confirmar
      await definirEstado(userId, 'aguardando_confirmacao_ia', { ...parsedIA, textoOriginal: texto });
      return;
    } else {
  logger.warn('[LANCAMENTO] ❌ IA falhou ou atingiu timeout. Comunicando usuário e seguindo padrão.');
      // Resposta amigável ao usuário (evitar duplicidade posteriormente)
      await sock.sendMessage(userId, { 
        text: '⏱️ A análise inteligente demorou demais ou não foi possível entender.\n\nTente um formato mais simples, por exemplo:\n• "mercado 50 pix"\n• "gasto 100 com uber credito"\n• "receita 5000 salario"' 
      });
      parsed = parsedNormal;
      // Se o parse normal também não tiver valor, encerrar aqui para não duplicar mensagens
      if (!parsed || !parsed.valor) {
        return;
      }
      // Caso contrário, prossegue para o fluxo normal abaixo
    }
  }
  
  // Se após fallback o parsed ainda não tiver valor, orientar o usuário e interromper
  if (!parsed || !parsed.valor) {
    await sock.sendMessage(userId, { 
      text: '❌ Não consegui entender. Tente usar um formato mais claro:\n\n💡 *Exemplos:*\n• "mercado 50 pix"\n• "gasto 100 com uber no credito"\n• "receita 5000 salario"\n\nDigite *ajuda* para ver todos os comandos.' 
    });
    return;
  }

  // Se chegou aqui, o parser normal funcionou e a IA não será usada
  logger.info('[LANCAMENTO] Parser normal entendeu a mensagem. IA não será usada.');

  // 5. Falta forma de pagamento
  if (String(parsed.tipo || '').toLowerCase() === 'gasto' && (parsed.faltaFormaPagamento || parsed.pagamento === 'NÃO INFORMADO')) {
    await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
    await sock.sendInteractiveMessage(userId, {
      type: 'list',
      header: '💳 Como pagou?',
      body: 'Selecione a forma de pagamento:',
      buttonLabel: 'Ver opções',
      sections: [{ rows: [
        { id: '1', title: '💠 Pix' },
        { id: '2', title: '💵 Dinheiro' },
        { id: '3', title: '💳 Cartão de crédito' },
        { id: '4', title: '🏦 Débito' },
        { id: '5', title: '📋 Boleto' },
        { id: '6', title: '🔄 Transferência' },
      ]}],
    });
    return;
  }

  // 6. Boleto sem data de vencimento
  if (parsed.faltaDataVencimento) {
    await definirEstado(userId, 'aguardando_data_vencimento', parsed);
    await sock.sendMessage(userId, { 
      text: '📄 Qual a data de vencimento do boleto? (ex: 25/10/2025)' 
    });
    return;
  }

  // Processar lançamento
  await processarLancamento(sock, userId, parsed, texto);
}

async function processarLancamento(sock, userId, parsed, mensagemOriginal?: string) {
  // Se veio de confirmação da IA e tem texto original, gravar padrão no cache
  if (parsed.textoOriginal && parsed.categoria && parsed.tipo) {
    const padrao = normalizarParaCache(parsed.textoOriginal);
    databaseService.salvarParserCache(
      padrao,
      parsed.tipo,
      parsed.categoria,
      parsed.pagamento && parsed.pagamento !== 'NÃO INFORMADO' ? parsed.pagamento : null
    ).catch(() => {});
  }

  const tipoNormalizado = String(parsed?.tipo || 'gasto').toLowerCase();
  if (tipoNormalizado !== 'gasto' && tipoNormalizado !== 'receita') {
    parsed.tipo = 'gasto';
  }

  // Detectar gasto no cartão de crédito
  const pagamentoNormalizado = removerAcentos((parsed.pagamento || '').toLowerCase());
  
  if (parsed.tipo && parsed.tipo.toLowerCase() === 'gasto' && 
      (pagamentoNormalizado.includes('credito') || pagamentoNormalizado.includes('cartao'))) {
    
    const cartoes = await cartoesService.listarCartoesConfigurados(userId);
    
    if (cartoes.length === 0) {
      // Nenhum cartão configurado, registrar como gasto comum
      const dados = {
        data: parsed.data.split('/').reverse().join('-'),
        tipo: parsed.tipo.toLowerCase(),
        descricao: parsed.descricao,
        valor: parsed.valor,
        categoria: parsed.categoria,
        pagamento: parsed.pagamento,
        data_vencimento: converterDataParaISO(parsed.dataVencimento),
        mensagemOriginal: mensagemOriginal ?? parsed.textoOriginal,
      };

      const novoIdSemCartao = await lancamentosService.salvarLancamento(userId, dados);
      logger.info({ userId, tipo: parsed.tipo, valor: parsed.valor, categoria: parsed.categoria, pagamento: parsed.pagamento, origem: 'sem_cartao' }, '[LANCAMENTO] Salvo');
      const msgSemCartao = await gerarMensagemSucesso(userId, parsed);
      await enviarConfirmacaoInterativa(sock, userId, novoIdSemCartao, parsed, msgSemCartao);

      // Verificar orçamento da categoria
      if (parsed.tipo === 'gasto' && parsed.categoria) {
        const orcamento = await databaseService.buscarOrcamento(userId, parsed.categoria);
        if (orcamento) {
          const totalMes = await databaseService.getTotalCategoriaNoMes(userId, parsed.categoria);
          const pct = Math.round((totalMes / orcamento.limite) * 100);
          if (pct >= 100) {
            await sock.sendMessage(userId, {
              text: `🔴 *Orçamento estourado!* ${parsed.categoria}: ${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)} (${pct}%)`
            });
          } else if (pct >= 80) {
            await sock.sendMessage(userId, {
              text: `🟡 *Atenção!* Orçamento de ${parsed.categoria}: ${pct}% usado (${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)})`
            });
          }
        }
      }
      return;
    }

    if (cartoes.length === 1) {
      // Apenas um cartão, usar automaticamente
      const cartao = cartoes[0];
      
      // Parcelamento
      if (parsed.parcelamento && parsed.numParcelas > 1) {
        const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed, cartao);
        logger.info({ userId, tipo: 'gasto', valor: parsed.valor, categoria: parsed.categoria, cartao: cartao.nome_cartao, parcelas: parsed.numParcelas, origem: 'parcelamento_cartao' }, '[LANCAMENTO] Salvo');
        let msg = `✅ Parcelamento registrado no cartão ${cartao.nome_cartao}!\n\n`;
        msg += `💰 Valor total: ${formatarComMoeda(parsed.valor)}\n`;
        msg += `📦 ${parsed.numParcelas}x de ${formatarComMoeda(parsed.valor / parsed.numParcelas)}\n`;
        msg += `📂 Categoria: ${parsed.categoria}\n`;
        msg += `📝 Descrição: ${parsed.descricao}`;
        await sock.sendMessage(userId, { text: msg });
        return;
      }

      // Recorrente
      if (parsed.recorrente && parsed.recorrenteMeses > 1) {
        const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartao);
        logger.info({ userId, tipo: 'gasto', valor: parsed.valor, categoria: parsed.categoria, cartao: cartao.nome_cartao, meses: parsed.recorrenteMeses, origem: 'recorrente_cartao' }, '[LANCAMENTO] Salvo');
        let msg = `✅ Lançamento recorrente registrado no cartão ${cartao.nome_cartao}!\n\n`;
        msg += `💰 Valor: ${formatarComMoeda(parsed.valor)}\n`;
        msg += `📅 ${parsed.recorrenteMeses} meses\n`;
        msg += `📂 Categoria: ${parsed.categoria}\n`;
        msg += `📝 Descrição: ${parsed.descricao}`;
        await sock.sendMessage(userId, { text: msg });
        return;
      }

      // Gasto simples no cartão
      const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(parsed.data.split('/').reverse().join('-'), cartao.dia_vencimento);

      const dados = {
        data: parsed.data.split('/').reverse().join('-'),
        tipo: parsed.tipo.toLowerCase(),
        descricao: parsed.descricao,
        valor: parsed.valor,
        categoria: parsed.categoria,
        pagamento: parsed.pagamento,
        cartao_nome: cartao.nome_cartao,
        data_lancamento: formatarDateParaISO(new Date()),
        data_contabilizacao: formatarDateParaISO(resultadoContabilizacao.dataContabilizacao),
        mes_fatura: resultadoContabilizacao.mesFatura,
        ano_fatura: resultadoContabilizacao.anoFatura,
        dia_vencimento: cartao.dia_vencimento,
        status_fatura: 'pendente',
        data_vencimento: converterDataParaISO(parsed.dataVencimento),
        mensagemOriginal: mensagemOriginal ?? parsed.textoOriginal,
      };

      const novoIdCartao = await lancamentosService.salvarLancamento(userId, dados);
      logger.info({ userId, tipo: parsed.tipo, valor: parsed.valor, categoria: parsed.categoria, cartao: cartao.nome_cartao, origem: 'simples_cartao' }, '[LANCAMENTO] Salvo');
      const msgCartao = await gerarMensagemSucesso(userId, parsed, cartao);
      await enviarConfirmacaoInterativa(sock, userId, novoIdCartao, parsed, msgCartao);

      // Verificar orçamento da categoria
      if (parsed.tipo === 'gasto' && parsed.categoria) {
        const orcamento = await databaseService.buscarOrcamento(userId, parsed.categoria);
        if (orcamento) {
          const totalMes = await databaseService.getTotalCategoriaNoMes(userId, parsed.categoria);
          const pct = Math.round((totalMes / orcamento.limite) * 100);
          if (pct >= 100) {
            await sock.sendMessage(userId, {
              text: `🔴 *Orçamento estourado!* ${parsed.categoria}: ${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)} (${pct}%)`
            });
          } else if (pct >= 80) {
            await sock.sendMessage(userId, {
              text: `🟡 *Atenção!* Orçamento de ${parsed.categoria}: ${pct}% usado (${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)})`
            });
          }
        }
      }
      return;
    }

    if (cartoes.length > 1) {
      // Múltiplos cartões, pedir para escolher
  logger.info('🔔 Múltiplos cartões, pedir para escolher');
      await definirEstado(userId, 'aguardando_escolha_cartao', parsed);
      await sock.sendInteractiveMessage(userId, {
        type: 'list',
        header: '💳 Escolha o cartão',
        body: 'Selecione o cartão para registrar o lançamento:',
        buttonLabel: 'Ver cartões',
        sections: [{
          rows: [
            ...cartoes.map((cartao: any, index: number) => ({
              id: String(index + 1),
              title: cartao.nome_cartao,
            })),
            { id: '0', title: '❌ Cancelar' },
          ],
        }],
      });
      return;
    }
  }
  
  // Parcelamento sem cartão
  if (parsed.parcelamento && parsed.numParcelas > 1) {
    const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed);
    logger.info({ userId, tipo: parsed.tipo, valor: parsed.valor, categoria: parsed.categoria, parcelas: parsed.numParcelas, origem: 'parcelamento' }, '[LANCAMENTO] Salvo');
    let msg = `✅ Parcelamento registrado!\n\n`;
    msg += `💰 Valor total: ${formatarComMoeda(parsed.valor)}\n`;
    msg += `📦 ${parsed.numParcelas}x de ${formatarComMoeda(parsed.valor / parsed.numParcelas)}\n`;
    msg += `📂 Categoria: ${parsed.categoria}\n`;
    msg += `📝 Descrição: ${parsed.descricao}`;
    await sock.sendMessage(userId, { text: msg });
    return;
  }

  // Recorrente sem cartão
  if (parsed.recorrente && parsed.recorrenteMeses > 1) {
    const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed);
    logger.info({ userId, tipo: parsed.tipo, valor: parsed.valor, categoria: parsed.categoria, meses: parsed.recorrenteMeses, origem: 'recorrente' }, '[LANCAMENTO] Salvo');
    let msg = `✅ Lançamento recorrente registrado!\n\n`;
    msg += `💰 Valor: ${formatarComMoeda(parsed.valor)}\n`;
    msg += `📅 ${parsed.recorrenteMeses} meses\n`;
    msg += `📂 Categoria: ${parsed.categoria}\n`;
    msg += `📝 Descrição: ${parsed.descricao}`;
    await sock.sendMessage(userId, { text: msg });
    return;
  }

  // Lançamento simples
  const dados = {
    data: parsed.data.split('/').reverse().join('-'),
    tipo: parsed.tipo.toLowerCase(),
    descricao: parsed.descricao,
    valor: parsed.valor,
    categoria: parsed.categoria,
    pagamento: parsed.pagamento,
    data_vencimento: converterDataParaISO(parsed.dataVencimento),
    platform: parsed.platform || null,
    business_context: parsed.business_context || null,
    mensagemOriginal: mensagemOriginal ?? parsed.textoOriginal,
  };

  const novoId = await lancamentosService.salvarLancamento(userId, dados);
  logger.info({ userId, tipo: parsed.tipo, valor: parsed.valor, categoria: parsed.categoria, pagamento: parsed.pagamento, platform: parsed.platform || null, origem: 'simples' }, '[LANCAMENTO] Salvo');
  const msgSimples = await gerarMensagemSucesso(userId, parsed);
  await enviarConfirmacaoInterativa(sock, userId, novoId, parsed, msgSimples);

  // Verificar orçamento da categoria
  if (parsed.tipo === 'gasto' && parsed.categoria) {
    const orcamento = await databaseService.buscarOrcamento(userId, parsed.categoria);
    if (orcamento) {
      const totalMes = await databaseService.getTotalCategoriaNoMes(userId, parsed.categoria);
      const pct = Math.round((totalMes / orcamento.limite) * 100);
      if (pct >= 100) {
        await sock.sendMessage(userId, {
          text: `🔴 *Orçamento estourado!* ${parsed.categoria}: ${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)} (${pct}%)`
        });
      } else if (pct >= 80) {
        await sock.sendMessage(userId, {
          text: `🟡 *Atenção!* Orçamento de ${parsed.categoria}: ${pct}% usado (${formatarComMoeda(totalMes)} de ${formatarComMoeda(orcamento.limite)})`
        });
      }
    }
  }

  // Alerta se gasto > R$ 500 (threshold configurável)
  const THRESHOLD_GASTO_ALTO = Number(process.env.THRESHOLD_GASTO_ALTO || 500);
  if (parsed.tipo === 'gasto' && parsed.valor > THRESHOLD_GASTO_ALTO) {
    await sock.sendMessage(userId, {
      text: `⚠️ *Gasto alto registrado!*\n\nVocê acabou de registrar um gasto de ${formatarComMoeda(parsed.valor)}.\n\nDigite *resumo* para ver como está seu mês.`
    });
  }
}

export { lancamentoCommand as default };
