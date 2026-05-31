import * as databaseService from '../infrastructure/databaseService';
import { formatarValor, formatarComMoeda } from '../utils/formatUtils';

async function quantoGasteiCommand(sock: any, userId: string, texto: string) {
  const textoLower = texto.toLowerCase()
    .replace('quanto gastei', '')
    .replace('quanto eu gastei', '')
    .replace('quanto foi gasto', '')
    .replace('quanto já gastei', '')
    .replace('quanto ja gastei', '')
    .replace(/^[\s,em]+/, '')
    .trim();

  // Detectar período
  const agora = new Date();
  let inicio: Date;
  let fim: Date;
  let labelPeriodo: string;
  let restoCat = textoLower;

  if (restoCat.includes('hoje') || restoCat.includes('dia')) {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
    labelPeriodo = 'hoje';
    restoCat = restoCat.replace('hoje', '').replace('dia', '');
  } else if (restoCat.includes('essa semana') || restoCat.includes('esta semana') || restoCat.includes('na semana')) {
    const dia = agora.getDay();
    inicio = new Date(agora); inicio.setDate(agora.getDate() - dia);
    fim = new Date(agora); fim.setDate(agora.getDate() + (7 - dia));
    labelPeriodo = 'esta semana';
    restoCat = restoCat.replace(/essa semana|esta semana|na semana/g, '');
  } else if (restoCat.includes('esse ano') || restoCat.includes('este ano') || restoCat.includes('no ano')) {
    inicio = new Date(agora.getFullYear(), 0, 1);
    fim = new Date(agora.getFullYear() + 1, 0, 1);
    labelPeriodo = `em ${agora.getFullYear()}`;
    restoCat = restoCat.replace(/esse ano|este ano|no ano/g, '');
  } else {
    // padrão: mês atual
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    labelPeriodo = 'este mês';
    restoCat = restoCat
      .replace('esse mes', '').replace('esse mês', '')
      .replace('este mes', '').replace('este mês', '')
      .replace('no mes', '').replace('no mês', '');
  }

  const categoria = restoCat.replace(/^[\s,em]+/, '').trim();

  if (!categoria) {
    // Sem categoria: resumo geral do período
    const result = await databaseService.queryDatabase(
      `SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd
       FROM lancamentos WHERE user_id = $1 AND tipo = 'gasto' AND data >= $2 AND data < $3`,
      [userId, inicio, fim]
    );
    const total = parseFloat(result.rows[0]?.total || '0');
    const qtd = parseInt(result.rows[0]?.qtd || '0');
    await sock.sendMessage(userId, {
      text: `💸 *Gastos ${labelPeriodo}:* ${formatarComMoeda(total)}\n📦 ${qtd} lançamento${qtd !== 1 ? 's' : ''}\n\nPara ver por categoria: *quanto gastei em alimentação*`
    });
    return;
  }

  // Com categoria
  const result = await databaseService.queryDatabase(
    `SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as qtd, COALESCE(AVG(valor),0) as media
     FROM lancamentos
     WHERE user_id = $1 AND tipo = 'gasto' AND categoria ILIKE $2 AND data >= $3 AND data < $4`,
    [userId, `%${categoria}%`, inicio, fim]
  );
  const total = parseFloat(result.rows[0]?.total || '0');
  const qtd = parseInt(result.rows[0]?.qtd || '0');
  const media = parseFloat(result.rows[0]?.media || '0');

  if (qtd === 0) {
    await sock.sendMessage(userId, {
      text: `Nenhum gasto em *${categoria}* encontrado ${labelPeriodo}.`
    });
    return;
  }

  await sock.sendMessage(userId, {
    text:
      `💸 *${categoria.charAt(0).toUpperCase() + categoria.slice(1)} — ${labelPeriodo}*\n\n` +
      `Total: ${formatarComMoeda(total)}\n` +
      `Lançamentos: ${qtd}\n` +
      `Média por lançamento: ${formatarComMoeda(media)}\n\n` +
      `_Para ver os detalhes: historico ${categoria}_`
  });
}

export default quantoGasteiCommand;
