// Card de confirmação exibido ao usuário após a IA (Gemini) analisar um lançamento
// vindo de texto, áudio ou comprovante (voucher). Fonte única da cópia e da lógica de
// interpretação de resposta para manter os três fluxos consistentes entre si.
//
// Renderizado como mensagem de botões nativos do WhatsApp (Meta Cloud API) — ver
// WhatsAppButtonMessage em infrastructure/whatsapp/IWhatsAppAdapter.ts.

import type { WhatsAppButtonMessage } from '../infrastructure/whatsapp/IWhatsAppAdapter';

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
// Fora desse mapa, a frase cai no genérico "com {categoria}" (em minúsculas).
const PREPOSICAO_PLATAFORMA: Record<string, string> = {
  'Uber': 'na Uber',
  '99Pop': 'na 99',
  'iFood': 'no iFood',
  'Rappi': 'na Rappi',
  'Loggi': 'na Loggi',
};

// Monta a preposição + local para uma categoria — plataformas conhecidas usam "na"/"no" com o
// nome próprio; qualquer outra categoria cai no genérico "com {categoria em minúsculas}".
// Reaproveitado tanto pelo card de confirmação quanto pelas mensagens de fallback do parser
// local (ver lancamento.ts) para manter a mesma frase em todos os pontos do fluxo.
export function prepararCategoriaLocal(categoria: string): string {
  return PREPOSICAO_PLATAFORMA[categoria] || `com ${String(categoria || '').toLowerCase()}`;
}

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

// Formato "R$254,75" (sem espaço, decimal com vírgula) — usado no card de confirmação e
// reaproveitado nas mensagens de fallback do parser local para manter o mesmo padrão visual.
export function formatarValorCard(valor: number): string {
  const num = Number(valor) || 0;
  return `R$${num.toFixed(2).replace('.', ',')}`;
}

// Trunca com reticências, respeitando os limites de campo da Meta Cloud API
// (header ≤60, body ≤1024, footer ≤60, botão ≤20). Rede de segurança apenas —
// os textos padrão já foram validados para caber nesses limites nos casos comuns.
function limitarTexto(texto: string, max: number): string {
  if (!texto) return texto;
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
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
  linhasExtras?: string[];     // ex.: indicação de parcelamento (voucher)
  avisoConfianca?: string;     // ex.: aviso de baixa confiança da IA
}

// Texto do botão dinâmico, conforme o tipo sugerido (inverte gasto↔receita).
export function textoOpcaoInverterTipo(tipo: string): string {
  return String(tipo).toLowerCase() === 'receita' ? 'Não, foi um GASTO' : 'Não, foi um GANHO';
}

// Estrutura pronta para IWhatsAppAdapter.sendInteractiveMessage(userId, { type: 'button', ... }).
export function montarCardConfirmacaoIA(dados: DadosCardConfirmacaoIA): WhatsAppButtonMessage {
  const isReceita = String(dados.tipo).toLowerCase() === 'receita';
  const verbo = isReceita ? 'GANHOU' : 'GASTOU';
  const local = prepararCategoriaLocal(dados.categoria);
  const quando = descreverQuando(dados.data);

  const header = limitarTexto(
    `Você ${verbo} ${formatarValorCard(dados.valor)} ${local} ${quando}. Certo?`,
    60
  );

  let body = `Categoria: ${dados.categoria}\nData: ${formatarDataCurta(dados.data)}`;
  if (dados.linhasExtras?.length) {
    body += `\n${dados.linhasExtras.join('\n')}`;
  }
  if (dados.avisoConfianca) {
    body += `\n\n${dados.avisoConfianca}`;
  }
  body = limitarTexto(body, 1024);

  const footer = limitarTexto('Se a categoria estiver errada, é só me dizer a certa.', 60);

  return {
    type: 'button',
    header,
    body,
    footer,
    buttons: [
      { id: 'ia_confirmar', title: limitarTexto('Confirmar', 20) },
      { id: 'ia_inverter_tipo', title: limitarTexto(textoOpcaoInverterTipo(dados.tipo), 20) },
    ],
  };
}

export type RespostaConfirmacaoIA =
  | { acao: 'confirmar' }
  | { acao: 'inverter_tipo' }
  | { acao: 'categoria'; valor: string };

const RESPOSTAS_CONFIRMAR = new Set(['1', 'ia_confirmar', 'sim', 's', 'yes', 'y']);
// 'ia_cancelar' mantido por compatibilidade com estados em voo no Redis de antes da migração
// para o id 'ia_inverter_tipo' (botão nativo).
const RESPOSTAS_INVERTER = new Set(['2', 'ia_inverter_tipo', 'ia_cancelar', 'não', 'nao', 'n', 'no']);

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
