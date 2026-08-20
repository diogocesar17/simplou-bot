// Card de confirmação exibido ao usuário após a IA (Gemini) analisar um lançamento
// vindo de texto, áudio ou comprovante (voucher). Fonte única da cópia e da lógica de
// interpretação de resposta para manter os três fluxos consistentes entre si.

// Categorias reconhecidas para correção livre — espelha exatamente as categorias que a IA
// pode sugerir (ver prompt em analisarLancamentoComIA, commands/lancamento.ts).
export const CATEGORIAS_VALIDAS = [
  // Receitas de motorista/entregador
  'Uber', '99Pop', 'iFood', 'Rappi', 'Loggi', 'Entrega Particular', 'Corrida Particular', 'Ganhos',
  // Despesas operacionais de motorista/entregador
  'Combustível', 'Manutenção', 'Pedágio', 'Estacionamento', 'Lavagem', 'Taxa do App', 'Seguro Auto', 'Financiamento', 'IPVA', 'Multa', 'Celular',
  // Categorias gerais
  'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Moradia', 'Lazer', 'Vestuário', 'Serviços', 'Casa', 'Trabalho', 'Renda', 'Outros',
];

// Locais com preposição própria — usados na frase de confirmação ("na Uber", "no iFood"...).
// Fora desse mapa, a frase cai no genérico "com {descrição}".
const PREPOSICAO_PLATAFORMA: Record<string, string> = {
  'Uber': 'na Uber',
  '99Pop': 'na 99',
  'iFood': 'no iFood',
  'Rappi': 'na Rappi',
  'Loggi': 'na Loggi',
};

function normalizarTexto(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Resolve um texto livre (sem acento/case) para o valor canônico em CATEGORIAS_VALIDAS,
// ou null se não corresponder a nenhuma categoria reconhecida.
export function resolverCategoriaLivre(textoLivre: string): string | null {
  const alvo = normalizarTexto(textoLivre);
  if (!alvo) return null;
  return CATEGORIAS_VALIDAS.find(c => normalizarTexto(c) === alvo) || null;
}

function formatarValorCard(valor: number): string {
  const num = Number(valor) || 0;
  return `R$${num.toFixed(2).replace('.', ',')}`;
}

// Aceita data em ISO (YYYY-MM-DD) ou BR (DD/MM/AAAA) e devolve ISO — ou null se não reconhecer.
function paraDataISO(data: string): string | null {
  if (!data) return null;
  if (data.includes('-') && data.length === 10) return data;
  const partes = data.split('/');
  if (partes.length === 3) {
    const [dd, mm, aaaa] = partes;
    return `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

function formatarDataCurta(data: string): string {
  const iso = paraDataISO(data);
  if (!iso) return data;
  const [, mm, dd] = iso.split('-');
  return `${dd}/${mm}`;
}

function formatarDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function descreverQuando(data: string): string {
  const iso = paraDataISO(data);
  const hojeISO = formatarDateISO(new Date());
  const ontemISO = formatarDateISO(new Date(Date.now() - 86400000));
  if (iso === hojeISO) return 'hoje';
  if (iso === ontemISO) return 'ontem';
  return `no dia ${formatarDataCurta(data)}`;
}

export interface DadosCardConfirmacaoIA {
  tipo: string;               // 'receita' | 'gasto'
  valor: number;
  descricao: string;
  categoria: string;
  data: string;                // ISO ou BR
  transcricao?: string;        // áudio: o que a IA entendeu ter sido dito
  linhasExtras?: string[];     // ex.: indicação de parcelamento (voucher)
  avisoConfianca?: string;     // ex.: aviso de baixa confiança da IA
}

// Texto da opção 2, conforme o tipo sugerido pela IA (inverte gasto↔receita).
export function textoOpcaoInverterTipo(tipo: string): string {
  return String(tipo).toLowerCase() === 'receita' ? 'Não, foi um GASTO' : 'Não, foi um GANHO';
}

export function montarCardConfirmacaoIA(dados: DadosCardConfirmacaoIA): string {
  const isReceita = String(dados.tipo).toLowerCase() === 'receita';
  const verbo = isReceita ? 'GANHOU' : 'GASTOU';
  const local = PREPOSICAO_PLATAFORMA[dados.categoria] || `com ${dados.descricao}`;
  const quando = descreverQuando(dados.data);

  let corpo = dados.transcricao
    ? `_"${String(dados.transcricao).slice(0, 300)}"_\n\n`
    : '';

  corpo += `Entendi: você ${verbo} ${formatarValorCard(dados.valor)} ${local} ${quando}. Certo?\n\n`;
  corpo += `Categoria: ${dados.categoria}\n`;
  corpo += `Data: ${formatarDataCurta(dados.data)}`;

  if (dados.linhasExtras?.length) {
    corpo += `\n${dados.linhasExtras.join('\n')}`;
  }
  if (dados.avisoConfianca) {
    corpo += `\n\n${dados.avisoConfianca}`;
  }

  corpo += `\n\n1 - Confirmar\n2 - ${textoOpcaoInverterTipo(dados.tipo)}`;
  corpo += `\n\nSe a categoria estiver errada, é só me dizer a certa.`;

  return corpo;
}

export type RespostaConfirmacaoIA =
  | { acao: 'confirmar' }
  | { acao: 'inverter_tipo' }
  | { acao: 'categoria'; valor: string };

const RESPOSTAS_CONFIRMAR = new Set(['1', 'ia_confirmar', 'sim', 's', 'yes', 'y']);
const RESPOSTAS_INVERTER = new Set(['2', 'ia_cancelar', 'não', 'nao', 'n', 'no']);

// Interpreta a resposta do usuário no card de confirmação da IA.
// Qualquer texto que não seja "1"/"2" (ou variações reconhecidas de sim/não) é tratado
// como a categoria correta informada livremente — mantendo compatibilidade com a sintaxe
// antiga "categoria [nome]".
export function interpretarRespostaConfirmacaoIA(textoOriginal: string): RespostaConfirmacaoIA {
  const resposta = (textoOriginal || '').trim();
  const respostaLower = resposta.toLowerCase();

  if (RESPOSTAS_CONFIRMAR.has(respostaLower)) return { acao: 'confirmar' };
  if (RESPOSTAS_INVERTER.has(respostaLower)) return { acao: 'inverter_tipo' };

  if (respostaLower.startsWith('categoria ')) {
    return { acao: 'categoria', valor: resposta.slice('categoria '.length).trim() };
  }

  return { acao: 'categoria', valor: resposta };
}
