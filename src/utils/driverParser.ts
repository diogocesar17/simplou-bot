// Parser especializado para motoristas de app e entregadores.
// Roda ANTES do parseMessage genérico em lancamento.ts.
// Retorna null se não reconhecer um padrão driver-específico
// (o fluxo então cai no parser genérico normalmente).

export interface DriverParsedResult {
  tipo: 'receita' | 'gasto';
  valor: number;
  categoria: string;
  platform: string | null;
  business_context: 'DRIVER';
  descricao: string;
  pagamento: string;
  data: string;
  faltaFormaPagamento: boolean;
  faltaDataVencimento: boolean;
  parcelamento: boolean;
  recorrente: boolean;
  confiancaCategoria: 'alta';
}

// Plataformas de receita: nome → keywords (sem acento, lowercase)
const PLATAFORMAS_RECEITA: Record<string, string[]> = {
  'Uber': ['uber'],
  '99Pop': ['99pop', '99 pop', '99'],
  'iFood': ['ifood', 'i food'],
  'Rappi': ['rappi'],
  'Loggi': ['loggi'],
  'Entrega Particular': ['entrega particular'],
  'Corrida Particular': ['corrida particular'],
};

// Despesas operacionais: nome → keywords (sem acento, lowercase)
// Apenas keywords inequivocamente driver — não genéricos como "lanche"
const DESPESAS_DRIVER: Record<string, string[]> = {
  'Combustível': ['gasolina', 'etanol', 'diesel', 'abasteci', 'combustivel', 'posto de gasolina', 'coloquei gasolina', 'coloquei etanol', 'coloquei combustivel'],
  'Manutenção': ['troquei oleo', 'troca de oleo', 'pneu', 'borracharia', 'alinhamento', 'balanceamento', 'revisao', 'mecanico', 'freio', 'bateria do carro', 'embreagem', 'correia dentada'],
  'Pedágio': ['pedagio'],
  'Estacionamento': ['estacionamento', 'estacionei'],
  'Lavagem': ['lava jato', 'lavagem do carro', 'lavei o carro'],
  'IPVA': ['ipva', 'licenciamento'],
  'Multa': ['multa de transito', 'multa infrecao'],
};

// Verbos que indicam receita de plataforma
const VERBOS_RECEITA_PLATAFORMA = ['ganhei', 'fiz', 'recebi', 'faturei', 'corrida'];

// Verbos/frases que indicam ganho genérico (sem plataforma específica)
const VERBOS_RECEITA_GENERICA = ['faturei', 'rodei'];

function removerAcentos(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizar(t: string): string {
  return removerAcentos(String(t || '').toLowerCase()).trim();
}

function hoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function extrairValor(norm: string): number | null {
  const match = norm.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})|\d+[.,]?\d*)/);
  if (!match) return null;
  let s = match[1].replace(/\s/g, '');
  if (/\d+\.\d{3},\d{2}/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\d+,\d{2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  const v = parseFloat(s);
  return isNaN(v) || v <= 0 ? null : v;
}

function extrairPagamento(norm: string): { pagamento: string; falta: boolean } {
  if (/\bpix\b/.test(norm)) return { pagamento: 'pix', falta: false };
  if (/\bdinheiro\b/.test(norm)) return { pagamento: 'dinheiro', falta: false };
  if (/\bcredito\b/.test(norm)) return { pagamento: 'credito', falta: false };
  if (/\bdebito\b/.test(norm)) return { pagamento: 'debito', falta: false };
  return { pagamento: 'NÃO INFORMADO', falta: true };
}

function buildReceita(valor: number, categoria: string, platform: string | null, norm: string): DriverParsedResult {
  const { pagamento, falta } = extrairPagamento(norm);
  return {
    tipo: 'receita',
    valor,
    categoria,
    platform,
    business_context: 'DRIVER',
    descricao: categoria,
    pagamento: falta ? 'pix' : pagamento,
    data: hoje(),
    faltaFormaPagamento: false,
    faltaDataVencimento: false,
    parcelamento: false,
    recorrente: false,
    confiancaCategoria: 'alta',
  };
}

function buildDespesa(valor: number, categoria: string, norm: string): DriverParsedResult {
  const { pagamento, falta } = extrairPagamento(norm);
  return {
    tipo: 'gasto',
    valor,
    categoria,
    platform: null,
    business_context: 'DRIVER',
    descricao: categoria,
    pagamento,
    data: hoje(),
    faltaFormaPagamento: falta,
    faltaDataVencimento: false,
    parcelamento: false,
    recorrente: false,
    confiancaCategoria: 'alta',
  };
}

export function parseDriverMessage(texto: string): DriverParsedResult | null {
  const norm = normalizar(texto);

  // --- 1. Receitas de plataforma (verbo + keyword de plataforma) ---
  const temVerboReceita = VERBOS_RECEITA_PLATAFORMA.some(v => norm.includes(v));

  if (temVerboReceita) {
    for (const [platformName, keywords] of Object.entries(PLATAFORMAS_RECEITA)) {
      if (keywords.some(kw => kw === '99' ? /\b99\b/.test(norm) : norm.includes(kw))) {
        const valor = extrairValor(norm);
        if (valor) {
          const platformKey = platformName.toUpperCase().replace(/[^A-Z0-9]/g, '');
          return buildReceita(valor, platformName, platformKey, norm);
        }
      }
    }

    // Receita genérica com "faturei X" ou "rodei X hoje"
    if (VERBOS_RECEITA_GENERICA.some(v => norm.includes(v))) {
      const valor = extrairValor(norm);
      if (valor) return buildReceita(valor, 'Ganhos', null, norm);
    }
  }

  // --- 2. Despesas operacionais driver ---
  for (const [categoria, keywords] of Object.entries(DESPESAS_DRIVER)) {
    if (keywords.some(kw => norm.includes(kw))) {
      const valor = extrairValor(norm);
      if (valor) return buildDespesa(valor, categoria, norm);
    }
  }

  return null;
}

// Detecta se uma mensagem é uma consulta de lucro/resumo driver
// sem precisar resolver o valor — usado para roteamento no index.ts
export function isDriverResumoQuery(texto: string): boolean {
  const norm = normalizar(texto);
  const padroes = [
    /\blucro\b/,
    /\bsobrou\b/,
    /\bcomo foi (meu dia|minha semana|meu mes)\b/,
    /\bcomo foi (o dia|a semana|o mes)\b/,
    /\bquanto (lucrei|sobrou|fiz|ganhei)\s+(hoje|essa semana|essa semana|este mes|esse mes|no mes)\b/,
    /\blucro (do dia|de hoje|da semana|do mes)\b/,
  ];
  return padroes.some(p => p.test(norm));
}

// Detecta se é um comando de meta financeira
export function isMetaQuery(texto: string): boolean {
  const norm = normalizar(texto);
  return (
    /\b(minha\s+)?meta\s+(diaria|semanal|mensal)\b/.test(norm) ||
    /\bdefinir\s+meta\b/.test(norm) ||
    /\bquero\s+(ganhar|lucrar)\s+\d/.test(norm) ||
    /\bquero\s+fazer\s+\d/.test(norm) ||
    /\bremover\s+meta\b/.test(norm) ||
    /\bqual\s+(e\s+)?(minha\s+)?meta\b/.test(norm) ||
    /\bver\s+metas\b/.test(norm) ||
    /\bminha\s+meta\b/.test(norm)
  );
}

// Detecta se é um comando de custo fixo
export function isCustoFixoQuery(texto: string): boolean {
  const norm = normalizar(texto);
  return (
    /\b(meu|minha)\s+seguro\s+(custa|e)\b/.test(norm) ||
    /\bpago\s+\d+.*\bpor\s+mes\b/.test(norm) ||
    /\b(custo|gasto)s?\s+fixos?\b/.test(norm) ||
    /\b(meu|minha)\s+financiamento\s+(custa|e|eh)\b/.test(norm) ||
    /\bcadastrar\s+custo\s+fixo\b/.test(norm)
  );
}

// Detecta se é configuração de perfil driver
export function isDriverPerfilQuery(texto: string): boolean {
  const norm = normalizar(texto);
  return (
    /\bsou\s+motorista\b/.test(norm) ||
    /\btrabalho\s+com\s+delivery\b/.test(norm) ||
    /\bsou\s+entregador\b/.test(norm) ||
    /\bmeu\s+carro\s+faz\b/.test(norm) ||
    /\bconsumo\s+medio\b/.test(norm) ||
    /\bperfil\s+driver\b/.test(norm) ||
    /\bconfigura(r)?\s+perfil\b/.test(norm)
  );
}
