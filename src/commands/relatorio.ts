// @ts-nocheck
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import { formatarValor } from '../utils/formatUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

async function relatorioCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  
  // Extrair mês/ano do comando
  const partes = texto.trim().split(/\s+/);
  
  let mesAno = null;
  
  if (partes.length > 1) {
    const resto = partes.slice(1).join(' ');
    mesAno = parseMesAno(resto);
  }
  
  // Se não especificou mês, usar mês atual
  if (!mesAno) {
    const agora = new Date();
    mesAno = {
      mes: agora.getMonth() + 1,
      ano: agora.getFullYear()
    };
  }
  
  // Validar se não é mês futuro (mais de 1 mês à frente)
  const agora = new Date();
  const mesAtual = agora.getMonth() + 1;
  const anoAtual = agora.getFullYear();
  
  if (mesAno.ano > anoAtual || (mesAno.ano === anoAtual && mesAno.mes > mesAtual + 1)) {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Mês futuro não permitido',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Use um mês passado, atual ou próximo mês'],
          emoji: '💡'
        }],
        dicas: [
          { texto: 'Relatório do mês atual', comando: 'relatorio' },
          { texto: 'Relatório de agosto', comando: 'relatorio agosto' }
        ]
      })
    });
    return;
  }
  
  try {
    // Gerar relatório CSV
    const resultado = await lancamentosService.gerarRelatorioCSV(userId, mesAno.mes, mesAno.ano);
    
    if (resultado.sucesso) {
      // Enviar mensagem de sucesso
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Relatório gerado com sucesso',
          emojiTitulo: '📊',
          secoes: [
            {
              titulo: 'Detalhes do Relatório',
              itens: [
                `Período: ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`,
                `Lançamentos: ${resultado.totalLancamentos}`,
                `Tamanho: ${resultado.tamanho} KB`
              ],
              emoji: '📋'
            }
          ],
          dicas: [
            { texto: 'Ver resumo do mês', comando: `resumo ${getNomeMes(mesAno.mes - 1).toLowerCase()}` },
            { texto: 'Ver histórico do mês', comando: `historico ${getNomeMes(mesAno.mes - 1).toLowerCase()}` }
          ]
        })
      });

      // Enviar arquivo CSV diretamente no chat
      try {
        const fs = require('fs');
        const path = require('path');
        
        if (fs.existsSync(resultado.caminhoArquivo)) {
          await sock.sendMessage(userId, {
            document: fs.readFileSync(resultado.caminhoArquivo),
            fileName: resultado.nomeArquivo,
            mimetype: 'text/csv',
            caption: `📊 Relatório de ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`
          });
        } else {
  logger.error({ caminhoArquivo: resultado.caminhoArquivo }, 'Arquivo CSV não encontrado');
        }
      } catch (fileError) {
  logger.error({ err: (fileError as any)?.message || fileError }, 'Erro ao enviar arquivo CSV');
        await sock.sendMessage(userId, {
          text: formatarMensagem({
            titulo: 'Arquivo não disponível',
            emojiTitulo: '⚠️',
            secoes: [{
              titulo: 'Solução',
              itens: ['Tente gerar o relatório novamente'],
              emoji: '💡'
            }],
            dicas: gerarDicasContextuais('relatorio')
          })
        });
      }
    } else {
      // Tratar caso específico de nenhum lançamento encontrado
      if (resultado.mensagem && resultado.mensagem.includes('Nenhum lançamento encontrado')) {
        await sock.sendMessage(userId, {
          text: formatarMensagem({
            titulo: 'Nenhum lançamento encontrado',
            emojiTitulo: '📭',
            secoes: [{
              titulo: 'Período',
              itens: [`${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`],
              emoji: '📅'
            }, {
              titulo: 'Sugestões',
              itens: [
                'Verifique se há lançamentos registrados neste período',
                'Tente um período diferente',
                'Use o comando "historico" para ver seus últimos lançamentos'
              ],
              emoji: '💡'
            }],
            dicas: [
              { texto: 'Ver histórico geral', comando: 'historico' },
              { texto: 'Ver resumo do mês', comando: `resumo ${getNomeMes(mesAno.mes - 1).toLowerCase()}` },
              { texto: 'Registrar lançamento', comando: 'mercado 50' }
            ]
          })
        });
      } else {
        await sock.sendMessage(userId, {
          text: formatarMensagem({
            titulo: 'Erro ao gerar relatório',
            emojiTitulo: '❌',
            secoes: [{
              titulo: 'Solução',
              itens: ['Tente novamente em alguns instantes'],
              emoji: '💡'
            }],
            dicas: gerarDicasContextuais('relatorio')
          })
        });
      }
    }
  } catch (error) {
  logger.error({ err: (error as any)?.message || error }, 'Erro ao gerar relatório');
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Erro interno',
        emojiTitulo: '❌',
        secoes: [{
          titulo: 'Solução',
          itens: ['Tente novamente em alguns instantes'],
          emoji: '💡'
        }],
        dicas: gerarDicasContextuais('relatorio')
      })
    });
  }
}

export default relatorioCommand; 
import { logger } from '../infrastructure/logger';
