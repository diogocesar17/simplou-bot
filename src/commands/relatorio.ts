import fs from 'fs';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { logger } from '../infrastructure/logger';

async function relatorioCommand(sock, userId, texto) {
  const partes = texto.trim().split(/\s+/);

  let mesAno: { mes: number; ano: number } | null = null;

  if (partes.length > 1) {
    mesAno = parseMesAno(partes.slice(1).join(' '));
  }

  if (!mesAno) {
    const agora = new Date();
    mesAno = { mes: agora.getMonth() + 1, ano: agora.getFullYear() };
  }

  const agora = new Date();
  const absolutoAtual = agora.getFullYear() * 12 + agora.getMonth() + 1;
  const absolutoSolicitado = mesAno.ano * 12 + mesAno.mes;

  if (absolutoSolicitado > absolutoAtual + 1) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Mês futuro não permitido',
        emojiTitulo: '❌',
        secoes: [{ titulo: 'Solução', itens: ['Use um mês passado ou o atual'], emoji: '💡' }],
        dicas: [
          { texto: 'Relatório do mês atual', comando: 'relatorio' },
          { texto: 'Relatório de agosto', comando: 'relatorio agosto' },
        ],
      }),
    });
    return;
  }

  try {
    const resultado = await lancamentosService.gerarRelatorioCSV(userId, mesAno.mes, mesAno.ano);

    if (!resultado.sucesso) {
      const semLancamentos = resultado.mensagem?.includes('Nenhum lançamento');
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: semLancamentos ? 'Nenhum lançamento encontrado' : 'Erro ao gerar relatório',
          emojiTitulo: semLancamentos ? '📭' : '❌',
          secoes: semLancamentos
            ? [{ titulo: 'Período', itens: [`${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`], emoji: '📅' }]
            : [{ titulo: 'Solução', itens: ['Tente novamente em alguns instantes'], emoji: '💡' }],
          dicas: gerarDicasContextuais('relatorio'),
        }),
      });
      return;
    }

    if (!fs.existsSync(resultado.caminhoArquivo)) {
      logger.error({ caminhoArquivo: resultado.caminhoArquivo }, '[RELATORIO] Arquivo CSV não encontrado');
      await sock.sendMessage(userId, {
        text: '⚠️ Relatório gerado mas arquivo não encontrado. Tente novamente.',
      });
      return;
    }

    const buffer = fs.readFileSync(resultado.caminhoArquivo);
    const nomeMes = getNomeMes(mesAno.mes - 1);

    await sock.sendMessage(userId, {
      document: buffer,
      fileName: resultado.nomeArquivo,
      mimetype: 'text/csv',
      caption: `📊 Relatório de ${nomeMes}/${mesAno.ano} — ${resultado.totalLancamentos} lançamento(s)`,
    });

    // Limpar arquivo temporário após envio
    fs.unlink(resultado.caminhoArquivo, () => {});
  } catch (error) {
    logger.error({ err: (error as any)?.message || error }, '[RELATORIO] Erro ao gerar relatório');
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Erro interno',
        emojiTitulo: '❌',
        secoes: [{ titulo: 'Solução', itens: ['Tente novamente em alguns instantes'], emoji: '💡' }],
        dicas: gerarDicasContextuais('relatorio'),
      }),
    });
  }
}

export default relatorioCommand;
