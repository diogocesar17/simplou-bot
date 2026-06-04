interface FuncaoStats {
  chamadas: number;
  erros: number;
  latenciaTotal: number;
}

interface Snapshot {
  desde: Date;
  totalChamadas: number;
  totalErros: number;
  totalRetries: number;
  latenciaTotal: number;
  porFuncao: Record<string, FuncaoStats>;
}

const stats: Snapshot = {
  desde: new Date(),
  totalChamadas: 0,
  totalErros: 0,
  totalRetries: 0,
  latenciaTotal: 0,
  porFuncao: {},
};

function getOrCreate(label: string): FuncaoStats {
  if (!stats.porFuncao[label]) {
    stats.porFuncao[label] = { chamadas: 0, erros: 0, latenciaTotal: 0 };
  }
  return stats.porFuncao[label];
}

export function registrarChamada(label: string, latencyMs: number, sucesso: boolean): void {
  try {
    stats.totalChamadas++;
    stats.latenciaTotal += latencyMs;
    if (!sucesso) stats.totalErros++;

    const fn = getOrCreate(label);
    fn.chamadas++;
    fn.latenciaTotal += latencyMs;
    if (!sucesso) fn.erros++;
  } catch {
    // monitor nunca pode quebrar o bot
  }
}

export function registrarRetry(label: string): void {
  try {
    stats.totalRetries++;
    getOrCreate(label); // garante que a função existe no mapa
  } catch {
    // monitor nunca pode quebrar o bot
  }
}

export function obterEstatisticas(): Snapshot {
  return stats;
}

export function formatarEstatisticas(): string {
  const s = stats;
  const taxaErro = s.totalChamadas > 0
    ? ((s.totalErros / s.totalChamadas) * 100).toFixed(1)
    : '0.0';
  const taxaRetry = s.totalChamadas > 0
    ? ((s.totalRetries / s.totalChamadas) * 100).toFixed(1)
    : '0.0';
  const latenciaMedia = s.totalChamadas > 0
    ? (s.latenciaTotal / s.totalChamadas / 1000).toFixed(1)
    : '0.0';

  const desde = s.desde.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const linhasFuncoes = Object.entries(s.porFuncao)
    .sort((a, b) => b[1].chamadas - a[1].chamadas)
    .map(([nome, fn]) => {
      const ok = fn.chamadas - fn.erros;
      const err = fn.erros;
      const lat = fn.chamadas > 0 ? (fn.latenciaTotal / fn.chamadas / 1000).toFixed(1) : '—';
      return `• ${nome}: ${ok}✅${err > 0 ? ` / ${err}❌` : ''} (${lat}s)`;
    })
    .join('\n');

  return (
    `📊 *Gemini — desde ${desde}*\n\n` +
    `Chamadas: ${s.totalChamadas}\n` +
    `Erros: ${s.totalErros} (${taxaErro}%)\n` +
    `Retries: ${s.totalRetries} (${taxaRetry}%)\n` +
    `Latência média: ${latenciaMedia}s\n` +
    (linhasFuncoes ? `\n*Por função:*\n${linhasFuncoes}` : '')
  );
}
