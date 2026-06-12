import { queryDatabase, buscarUsuario } from '../infrastructure/databaseService';
import { logger } from '../infrastructure/logger';

function formatarData(data: any): string {
  if (!data) return '';
  if (data instanceof Date) {
    return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }
  if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [ano, mes, dia] = data.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return String(data);
}

function escaparCsv(valor: any): string {
  if (valor === null || valor === undefined) return '';
  const str = String(valor);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function gerarCsvMemoria(userId: string): Promise<{ csv: string; totalLancamentos: number }> {
  const result = await queryDatabase(
    `SELECT
       data, tipo, descricao, valor, categoria, pagamento,
       criado_em, parcelamento_id, parcela_atual, total_parcelas,
       recorrente, recorrente_fim, cartao_nome,
       data_lancamento, data_contabilizacao, mes_fatura, ano_fatura,
       status_fatura, data_vencimento
     FROM lancamentos
     WHERE user_id = $1
       AND data >= CURRENT_DATE - INTERVAL '12 months'
     ORDER BY data DESC, criado_em DESC`,
    [userId]
  );

  const lancamentos = result.rows;

  const cabecalhos = [
    'Data', 'Tipo', 'Descricao', 'Valor', 'Categoria', 'Pagamento',
    'Criado em', 'Parcelamento ID', 'Parcela Atual', 'Total Parcelas',
    'Recorrente', 'Recorrente Fim', 'Cartao', 'Data Lancamento',
    'Data Contabilizacao', 'Mes Fatura', 'Ano Fatura', 'Status Fatura', 'Data Vencimento',
  ];

  const linhas: string[] = [cabecalhos.join(',')];

  for (const l of lancamentos) {
    const linha = [
      escaparCsv(formatarData(l.data)),
      escaparCsv(l.tipo),
      escaparCsv(l.descricao),
      escaparCsv(l.valor),
      escaparCsv(l.categoria),
      escaparCsv(l.pagamento),
      escaparCsv(formatarData(l.criado_em)),
      escaparCsv(l.parcelamento_id),
      escaparCsv(l.parcela_atual),
      escaparCsv(l.total_parcelas),
      escaparCsv(l.recorrente ? 'Sim' : 'Nao'),
      escaparCsv(formatarData(l.recorrente_fim)),
      escaparCsv(l.cartao_nome),
      escaparCsv(formatarData(l.data_lancamento)),
      escaparCsv(formatarData(l.data_contabilizacao)),
      escaparCsv(l.mes_fatura),
      escaparCsv(l.ano_fatura),
      escaparCsv(l.status_fatura),
      escaparCsv(formatarData(l.data_vencimento)),
    ];
    linhas.push(linha.join(','));
  }

  return { csv: linhas.join('\n'), totalLancamentos: lancamentos.length };
}

export async function exportarDadosCommand(sock: any, userId: string): Promise<void> {
  try {
    await sock.sendMessage(userId, {
      text: '⏳ Gerando seu arquivo de dados... Só um instante.',
    });

    const usuario = await buscarUsuario(userId);
    const { csv, totalLancamentos } = await gerarCsvMemoria(userId);

    const nomeUsuario = usuario?.nome && usuario.nome !== 'Usuário' ? usuario.nome : 'usuario';
    const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
    const nomeArquivo = `dados_${nomeUsuario.replace(/\s+/g, '_')}_${dataHoje}.csv`;

    const buffer = Buffer.from('﻿' + csv, 'utf-8');

    if (totalLancamentos === 0) {
      await sock.sendMessage(userId, {
        text:
          '📂 *Exportação de dados (LGPD)*\n\n' +
          'Nenhum lançamento encontrado nos últimos 12 meses.\n\n' +
          'Seus dados cadastrais:\n' +
          `• Nome: ${usuario?.nome || 'Não informado'}\n` +
          `• Plano: ${usuario?.plano || 'gratuito'}\n` +
          `• Cadastrado em: ${usuario?.data_cadastro ? formatarData(usuario.data_cadastro) : 'Não informado'}`,
      });
      return;
    }

    await sock.sendMessage(userId, {
      document: buffer,
      mimetype: 'text/plain',
      fileName: nomeArquivo,
      caption:
        `✅ *Seus dados exportados (LGPD)*\n\n` +
        `📊 Lançamentos: ${totalLancamentos} (últimos 12 meses)\n` +
        `📅 Gerado em: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n` +
        `Este arquivo contém todos os seus registros financeiros no Simplou.`,
    });
  } catch (error: any) {
    logger.error({ err: error?.message || error }, '[EXPORTAR_DADOS] Erro ao exportar dados');
    await sock.sendMessage(userId, {
      text: '❌ Ocorreu um erro ao gerar seus dados. Tente novamente em alguns instantes.',
    });
  }
}
