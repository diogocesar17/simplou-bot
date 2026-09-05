import { formatarComMoeda } from '../utils/formatUtils';
import * as db from '../infrastructure/databaseService';
import { logger } from '../infrastructure/logger';

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface DriverProfile {
  id: string;
  user_id: string;
  tipo: 'MOTORISTA_APP' | 'DELIVERY' | 'AMBOS' | null;
  veiculo: string | null;
  consumo_medio_km_l: number | null;
  combustivel_preferido: string | null;
  custo_combustivel_litro: number | null;
  criado_em: Date;
  atualizado_em: Date;
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  tipo_meta: 'DIARIA' | 'SEMANAL' | 'MENSAL';
  valor: number;
  ativa: boolean;
}

export interface FixedCost {
  id: string;
  user_id: string;
  description: string;
  category: string;
  amount: number;
  recurrence: 'MONTHLY' | 'YEARLY';
  active: boolean;
}

export interface DriverResumo {
  receitas: number;
  despesas: number;
  lucro: number;
  custosFixosRateados: number;
  lucroReal: number;
  porPlataforma: { plataforma: string; total: number }[];
  porCategoriaDespesa: { categoria: string; total: number }[];
  meta?: FinancialGoal | null;
  totalLancamentos: number;
}

// ─── Driver Profile ────────────────────────────────────────────────────────

export async function getDriverProfile(userId: string): Promise<DriverProfile | null> {
  try {
    const result = await (db as any).queryDatabase(
      'SELECT * FROM driver_profiles WHERE user_id = $1',
      [userId],
    );
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err }, '[DRIVER] Erro ao buscar perfil');
    return null;
  }
}

export async function upsertDriverProfile(userId: string, dados: Partial<DriverProfile>): Promise<void> {
  try {
    await (db as any).queryDatabase(
      `INSERT INTO driver_profiles (user_id, tipo, veiculo, consumo_medio_km_l, combustivel_preferido, custo_combustivel_litro)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         tipo = COALESCE(EXCLUDED.tipo, driver_profiles.tipo),
         veiculo = COALESCE(EXCLUDED.veiculo, driver_profiles.veiculo),
         consumo_medio_km_l = COALESCE(EXCLUDED.consumo_medio_km_l, driver_profiles.consumo_medio_km_l),
         combustivel_preferido = COALESCE(EXCLUDED.combustivel_preferido, driver_profiles.combustivel_preferido),
         custo_combustivel_litro = COALESCE(EXCLUDED.custo_combustivel_litro, driver_profiles.custo_combustivel_litro),
         atualizado_em = NOW()`,
      [
        userId,
        dados.tipo || null,
        dados.veiculo || null,
        dados.consumo_medio_km_l || null,
        dados.combustivel_preferido || null,
        dados.custo_combustivel_litro || null,
      ],
    );
  } catch (err) {
    logger.error({ err }, '[DRIVER] Erro ao salvar perfil');
    throw err;
  }
}

// ─── Financial Goals ───────────────────────────────────────────────────────

export async function getGoals(userId: string): Promise<FinancialGoal[]> {
  try {
    const result = await (db as any).queryDatabase(
      'SELECT * FROM financial_goals WHERE user_id = $1 AND ativa = true ORDER BY tipo_meta',
      [userId],
    );
    return result.rows;
  } catch (err) {
    logger.error({ err }, '[DRIVER] Erro ao buscar metas');
    return [];
  }
}

export async function getGoal(userId: string, tipo: 'DIARIA' | 'SEMANAL' | 'MENSAL'): Promise<FinancialGoal | null> {
  try {
    const result = await (db as any).queryDatabase(
      'SELECT * FROM financial_goals WHERE user_id = $1 AND tipo_meta = $2 AND ativa = true',
      [userId, tipo],
    );
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err }, '[DRIVER] Erro ao buscar meta');
    return null;
  }
}

export async function upsertGoal(userId: string, tipo: 'DIARIA' | 'SEMANAL' | 'MENSAL', valor: number): Promise<void> {
  await (db as any).queryDatabase(
    `INSERT INTO financial_goals (user_id, tipo_meta, valor, ativa)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (user_id, tipo_meta) DO UPDATE SET valor = EXCLUDED.valor, ativa = true, atualizado_em = NOW()`,
    [userId, tipo, valor],
  );
}

export async function removeGoal(userId: string, tipo: 'DIARIA' | 'SEMANAL' | 'MENSAL'): Promise<boolean> {
  const result = await (db as any).queryDatabase(
    'UPDATE financial_goals SET ativa = false, atualizado_em = NOW() WHERE user_id = $1 AND tipo_meta = $2 AND ativa = true',
    [userId, tipo],
  );
  return result.rowCount > 0;
}

// ─── Fixed Costs ───────────────────────────────────────────────────────────

export async function getFixedCosts(userId: string): Promise<FixedCost[]> {
  try {
    const result = await (db as any).queryDatabase(
      'SELECT * FROM fixed_costs WHERE user_id = $1 AND active = true ORDER BY category, description',
      [userId],
    );
    // amount vem como string do Postgres (coluna DECIMAL) — normaliza na borda,
    // pra nenhum consumidor somar string e virar NaN silenciosamente.
    return result.rows.map((row: any) => ({ ...row, amount: parseFloat(row.amount) }));
  } catch (err) {
    logger.error({ err }, '[DRIVER] Erro ao buscar custos fixos');
    return [];
  }
}

export async function addFixedCost(
  userId: string,
  description: string,
  category: string,
  amount: number,
  recurrence: 'MONTHLY' | 'YEARLY' = 'MONTHLY',
): Promise<void> {
  await (db as any).queryDatabase(
    `INSERT INTO fixed_costs (user_id, description, category, amount, recurrence, active)
     VALUES ($1, $2, $3, $4, $5, true)`,
    [userId, description, category, amount, recurrence],
  );
}

export async function removeFixedCost(userId: string, id: string): Promise<boolean> {
  const result = await (db as any).queryDatabase(
    'UPDATE fixed_costs SET active = false WHERE id = $1 AND user_id = $2 AND active = true',
    [id, userId],
  );
  return result.rowCount > 0;
}

// ─── Driver Resumo Queries ─────────────────────────────────────────────────

function inicioFimDia(): { inicio: Date; fim: Date } {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return { inicio, fim };
}

function inicioFimSemana(): { inicio: Date; fim: Date } {
  const agora = new Date();
  const diaSemana = agora.getDay(); // 0=Dom
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diaSemana);
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return { inicio, fim };
}

function inicioFimMes(): { inicio: Date; fim: Date } {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return { inicio, fim };
}

async function getTotalFixoMensal(userId: string): Promise<number> {
  const costs = await getFixedCosts(userId);
  return costs.reduce((sum, fc) => {
    return sum + (fc.recurrence === 'MONTHLY' ? fc.amount : fc.amount / 12);
  }, 0);
}

// Rateio diário do custo fixo mensal, usando os dias reais do mês de referência —
// única fonte de verdade pra esse cálculo (antes divergia: getLucroDia usava /30
// fixo enquanto queryResumo usava dias reais, mostrando números diferentes pro
// mesmo usuário no mesmo dia).
function calcularRateioDiario(totalFixoMensal: number, dataReferencia: Date): number {
  const diasNoMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0).getDate();
  return totalFixoMensal / diasNoMes;
}

async function queryResumo(
  userId: string,
  inicio: Date,
  fim: Date,
  metaTipo: 'DIARIA' | 'SEMANAL' | 'MENSAL',
): Promise<DriverResumo> {
  // Totais receita/despesa
  const totaisRes = await (db as any).queryDatabase(
    `SELECT tipo, COALESCE(SUM(valor), 0) AS total, COUNT(*) AS qtd
     FROM lancamentos
     WHERE user_id = $1 AND data >= $2 AND data < $3
     GROUP BY tipo`,
    [userId, inicio, fim],
  );

  let receitas = 0;
  let despesas = 0;
  let totalLancamentos = 0;
  for (const row of totaisRes.rows) {
    if (row.tipo === 'receita') receitas = parseFloat(row.total);
    else despesas = parseFloat(row.total);
    totalLancamentos += parseInt(row.qtd);
  }

  // Receitas por plataforma (usa platform quando disponível, senão usa categoria)
  const porPlataformaRes = await (db as any).queryDatabase(
    `SELECT
       COALESCE(platform, categoria) AS plataforma,
       COALESCE(SUM(valor), 0) AS total
     FROM lancamentos
     WHERE user_id = $1 AND data >= $2 AND data < $3 AND tipo = 'receita'
     GROUP BY COALESCE(platform, categoria)
     ORDER BY total DESC`,
    [userId, inicio, fim],
  );

  // Despesas por categoria
  const porCategoriaRes = await (db as any).queryDatabase(
    `SELECT categoria, COALESCE(SUM(valor), 0) AS total
     FROM lancamentos
     WHERE user_id = $1 AND data >= $2 AND data < $3 AND tipo = 'gasto'
     GROUP BY categoria
     ORDER BY total DESC`,
    [userId, inicio, fim],
  );

  const meta = await getGoal(userId, metaTipo);

  const totalFixoMensal = await getTotalFixoMensal(userId);
  const diasPeriodo = Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  const custosFixosRateados = calcularRateioDiario(totalFixoMensal, inicio) * diasPeriodo;
  const lucro = receitas - despesas;

  return {
    receitas,
    despesas,
    lucro,
    custosFixosRateados,
    lucroReal: lucro - custosFixosRateados,
    totalLancamentos,
    porPlataforma: porPlataformaRes.rows.map((r: any) => ({
      plataforma: r.plataforma || 'Outros',
      total: parseFloat(r.total),
    })),
    porCategoriaDespesa: porCategoriaRes.rows.map((r: any) => ({
      categoria: r.categoria || 'Outros',
      total: parseFloat(r.total),
    })),
    meta,
  };
}

export async function getResumoDia(userId: string): Promise<DriverResumo> {
  const { inicio, fim } = inicioFimDia();
  return queryResumo(userId, inicio, fim, 'DIARIA');
}

export async function getResumoSemana(userId: string): Promise<DriverResumo> {
  const { inicio, fim } = inicioFimSemana();
  return queryResumo(userId, inicio, fim, 'SEMANAL');
}

export async function getResumoMes(userId: string): Promise<DriverResumo> {
  const { inicio, fim } = inicioFimMes();
  return queryResumo(userId, inicio, fim, 'MENSAL');
}

export async function getResumoPorMesAno(userId: string, mes: number, ano: number): Promise<DriverResumo> {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);
  return queryResumo(userId, inicio, fim, 'MENSAL');
}

export async function getLucroDia(userId: string): Promise<number> {
  const { inicio, fim } = inicioFimDia();
  const res = await (db as any).queryDatabase(
    `SELECT tipo, COALESCE(SUM(valor), 0) AS total
     FROM lancamentos WHERE user_id = $1 AND data >= $2 AND data < $3
     GROUP BY tipo`,
    [userId, inicio, fim],
  );
  let receitas = 0;
  let despesas = 0;
  for (const row of res.rows) {
    if (row.tipo === 'receita') receitas = parseFloat(row.total);
    else despesas = parseFloat(row.total);
  }
  const totalFixoMensal = await getTotalFixoMensal(userId);
  const custoFixoDiario = calcularRateioDiario(totalFixoMensal, inicio);
  return receitas - despesas - custoFixoDiario;
}

export async function buildDriverContext(userId: string): Promise<string | undefined> {
  const [profile, fixedCosts, goals] = await Promise.all([
    getDriverProfile(userId),
    getFixedCosts(userId),
    getGoals(userId),
  ]);
  if (!profile) return undefined;

  const tipos: Record<string, string> = {
    MOTORISTA_APP: 'Motorista de app (Uber, 99)',
    DELIVERY: 'Entregador/delivery (iFood, Rappi, Loggi)',
    AMBOS: 'Motorista e entregador',
  };

  const totalFixo = fixedCosts.reduce((s, fc) =>
    s + (fc.recurrence === 'MONTHLY' ? fc.amount : fc.amount / 12), 0);

  const linhas: string[] = [
    `- Tipo: ${tipos[profile.tipo || ''] || 'Motorista/entregador'}`,
  ];
  if (profile.veiculo) linhas.push(`- Veículo: ${profile.veiculo}`);
  if (profile.consumo_medio_km_l) linhas.push(`- Consumo médio: ${profile.consumo_medio_km_l} km/L`);
  if (profile.combustivel_preferido) linhas.push(`- Combustível: ${profile.combustivel_preferido}`);
  if (totalFixo > 0) {
    linhas.push(`- Custos fixos mensais: ${formatarComMoeda(totalFixo.toFixed(2))} (${fixedCosts.map(f => f.description).join(', ')})`);
  }
  const metaMensal = goals.find(g => g.tipo_meta === 'MENSAL');
  if (metaMensal) linhas.push(`- Meta mensal de ganhos: ${formatarComMoeda(metaMensal.valor.toFixed(2))}`);

  return linhas.join('\n');
}

// Gasto total de uma categoria num período
export async function getGastoPorCategoria(
  userId: string,
  categoria: string,
  inicio: Date,
  fim: Date,
): Promise<number> {
  const res = await (db as any).queryDatabase(
    `SELECT COALESCE(SUM(valor), 0) AS total FROM lancamentos
     WHERE user_id = $1 AND tipo = 'gasto' AND categoria = $2 AND data >= $3 AND data < $4`,
    [userId, categoria, inicio, fim],
  );
  return parseFloat(res.rows[0]?.total || '0');
}
