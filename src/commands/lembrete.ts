import { formatarValor } from '../utils/formatUtils';
import * as lembretesService from '../services/lembretesService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { converterDataParaISO } from '../utils/dataUtils';

async function lembreteCommand(sock, userId, texto) {
  logger.info({ userId, trecho: String(texto || '').slice(0, 80) }, '[LEMBRETE] Comando iniciado');
  
  // Verificar se há estado pendente
  const estado = await obterEstado(userId);
  
  // Fluxo aguardando título
  if (estado?.etapa === 'aguardando_titulo_lembrete') {
    const titulo = texto.trim();
    
    // Verificar se o usuário quer cancelar
    if (titulo.toLowerCase() === 'cancelar' || titulo === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: '❌ Criação de lembrete cancelada.'
      });
      return;
    }
    
    if (!titulo || titulo.length === 0) {
      await sock.sendMessage(userId, {
        text: '❌ Título não pode estar vazio. Digite o título do lembrete:\n\n💡 Digite `0` ou `cancelar` para cancelar'
      });
      return;
    }
    
    estado.dadosParciais.titulo = titulo;
    await definirEstado(userId, 'aguardando_data_vencimento_lembrete', estado.dadosParciais);
    
    await sock.sendMessage(userId, {
      text: '📅 Qual a data de vencimento? (formato: dd/mm/aaaa)\n\n💡 Exemplo: 25/12/2024'
    });
    return;
  }
  
  // Fluxo aguardando data de vencimento
  if (estado?.etapa === 'aguardando_data_vencimento_lembrete') {
    const dataTexto = texto.trim();
    
    // Verificar se o usuário quer cancelar
    if (dataTexto.toLowerCase() === 'cancelar' || dataTexto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: '❌ Criação de lembrete cancelada.'
      });
      return;
    }
    
    // Validar formato da data
    const regexData = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dataTexto.match(regexData);
    
    if (!match) {
      await sock.sendMessage(userId, {
        text: '❌ Data inválida. Use o formato dd/mm/aaaa\n\n💡 Exemplo: 25/12/2024\n💡 Digite `0` ou `cancelar` para cancelar'
      });
      return;
    }
    
    const [, dia, mes, ano] = match;
    const dataVencimento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    
    // Verificar se a data é válida e não é no passado
    if (isNaN(dataVencimento.getTime())) {
      await sock.sendMessage(userId, {
        text: '❌ Data inválida. Verifique se a data existe.\n\n💡 Exemplo: 25/12/2024'
      });
      return;
    }
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (dataVencimento < hoje) {
      await sock.sendMessage(userId, {
        text: '❌ A data de vencimento não pode ser no passado.\n\n💡 Digite uma data futura.'
      });
      return;
    }
    
    estado.dadosParciais.data_vencimento = dataVencimento;
    await definirEstado(userId, 'aguardando_valor_lembrete', estado.dadosParciais);
    
    await sock.sendMessage(userId, {
      text: '💰 Qual o valor? (opcional)\n\n💡 Digite o valor ou "pular" para continuar sem valor\n\n📝 Exemplo: 150.50 ou pular'
    });
    return;
  }
  
  // Fluxo aguardando valor
  if (estado?.etapa === 'aguardando_valor_lembrete') {
    const valorTexto = texto.trim().toLowerCase();
    
    // Verificar se o usuário quer cancelar
    if (valorTexto === 'cancelar' || valorTexto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: '❌ Criação de lembrete cancelada.'
      });
      return;
    }
    
    if (valorTexto === 'pular' || valorTexto === 'skip') {
      estado.dadosParciais.valor = null;
    } else {
      const valor = parseFloat(valorTexto.replace(',', '.'));
      if (isNaN(valor) || valor <= 0) {
        await sock.sendMessage(userId, {
          text: '❌ Valor inválido. Digite um número positivo ou "pular"\n\n💡 Exemplo: 150.50 ou pular\n💡 Digite `0` ou `cancelar` para cancelar'
        });
        return;
      }
      estado.dadosParciais.valor = valor;
    }
    
    await definirEstado(userId, 'aguardando_antecedencia_lembrete', estado.dadosParciais);

    await sock.sendMessage(userId, {
      text: '⏰ Quantos dias antes você quer ser lembrado?\n\n💡 Digite um número de 0 a 30 ou "pular" para usar o padrão (1 dia)'
    });
    return;
  }
  
  // Fluxo aguardando antecedência (etapa 4)
  if (estado?.etapa === 'aguardando_antecedencia_lembrete') {
    const diasTexto = texto.trim().toLowerCase();

    // Verificar se o usuário quer cancelar
    if (diasTexto === 'cancelar' || diasTexto === '0') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: '❌ Criação de lembrete cancelada.'
      });
      return;
    }

    let dias = 1; // padrão

    if (diasTexto !== 'pular' && diasTexto !== 'skip' && diasTexto !== '') {
      dias = parseInt(diasTexto);
      if (isNaN(dias) || dias < 0 || dias > 30) {
        await sock.sendMessage(userId, {
          text: '❌ Número inválido. Digite um número de 0 a 30 ou "pular" para usar o padrão (1 dia):\n💡 Digite `cancelar` para cancelar'
        });
        return;
      }
    }

    (estado.dadosParciais as any).dias_antecedencia = dias;
    // Definir valores padrão para campos removidos do wizard
    (estado.dadosParciais as any).categoria = null;
    (estado.dadosParciais as any).descricao = null;
    (estado.dadosParciais as any).recorrente = true;
    (estado.dadosParciais as any).tipo_recorrencia = 'mensal';
    
    // Criar o lembrete
    try {
      const lembrete = await lembretesService.criarLembrete(userId, estado.dadosParciais as any);
      await limparEstado(userId);
      
      const dataFormatada = lembrete.data_vencimento.toLocaleDateString('pt-BR');
      const valorTexto = lembrete.valor ? ` - R$ ${formatarValor(lembrete.valor)}` : '';
      const categoriaTexto = lembrete.categoria ? ` [${lembrete.categoria}]` : '';
      const recorrenteTexto = lembrete.recorrente ? ` 🔄 ${lembrete.tipo_recorrencia}` : '';
      const descricaoTexto = lembrete.descricao ? `\n📝 ${lembrete.descricao}` : '';
      
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Lembrete criado com sucesso!',
          emojiTitulo: '✅',
          secoes: [
            {
              titulo: 'Detalhes do Lembrete',
              itens: [
                `📌 ${lembrete.titulo}${valorTexto}${categoriaTexto}`,
                `📅 Vence em: ${dataFormatada}${recorrenteTexto}`,
                `⏰ Lembrar ${lembrete.dias_antecedencia} dias antes`,
                ...(lembrete.descricao ? [`📝 ${lembrete.descricao}`] : [])
              ],
              emoji: '📋'
            }
          ],
          dicas: [
            { texto: 'Ver meus lembretes', comando: 'meuslembretes' },
            { texto: 'Criar outro lembrete', comando: 'lembrete' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
      
    } catch (error) {
      await limparEstado(userId);
  logger.error({ err: (error as any)?.message || error }, '[LEMBRETE] Erro ao criar lembrete');
      
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Erro ao criar lembrete',
          emojiTitulo: '❌',
          secoes: [
            {
              titulo: 'Detalhes do Erro',
              itens: [(error as any)?.message || 'Erro desconhecido'],
              emoji: '🚨'
            }
          ],
          dicas: [
            { texto: 'Tentar novamente', comando: 'lembrete' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
    }
    return;
  }
  
  // Comando inicial - verificar se há parâmetros
  let textoLimpo = texto.toLowerCase().trim();
  
  // Remover "criar lembrete" ou "lembrete" do início
  if (textoLimpo === 'criar lembrete') {
    textoLimpo = '';
  } else {
    textoLimpo = textoLimpo.replace(/^lembrete\s*/i, '').trim();
  }
  
  if (textoLimpo === '' || textoLimpo === 'novo' || textoLimpo === 'criar') {
    // Iniciar fluxo de criação de lembrete
    try {
      await definirEstado(userId, 'aguardando_titulo_lembrete', {});

      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Criar Novo Lembrete',
          emojiTitulo: '📝',
          secoes: [
            {
              titulo: 'Informações',
              itens: [
                'Vamos criar seu lembrete passo a passo'
              ],
              emoji: '📊'
            }
          ],
          dicas: [
            { texto: 'Cancelar criação', comando: 'cancelar' }
          ]
        }) + '\n\n📌 Digite o título do lembrete:'
      });

    } catch (error) {
      logger.error({ err: (error as any)?.message || error }, '[LEMBRETE] Erro ao iniciar criação');
      await sock.sendMessage(userId, {
        text: '❌ Erro interno. Tente novamente mais tarde.'
      });
    }
    return;
  }
  
  // Comando de ajuda
  if (textoLimpo === 'ajuda' || textoLimpo === 'help') {
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Ajuda - Lembretes',
        emojiTitulo: '❓',
        secoes: [
          {
            titulo: 'Comandos Disponíveis',
            itens: [
              'lembrete - Criar novo lembrete',
              'meuslembretes - Ver todos os lembretes',
              'lembrete ajuda - Esta ajuda'
            ],
            emoji: '📋'
          },
          {
            titulo: 'Funcionalidades',
            itens: [
              '📅 Lembretes com data de vencimento',
              '💰 Valores opcionais',
              '📂 Categorização',
              '🔄 Recorrência (semanal, mensal, anual)',
              '⏰ Antecedência configurável (0-30 dias)',
              '🔔 Notificações automáticas'
            ],
            emoji: '✨'
          }
        ],
        dicas: [
          { texto: 'Criar lembrete', comando: 'lembrete' },
          { texto: 'Ver meus lembretes', comando: 'meuslembretes' }
        ]
      })
    });
    return;
  }
  
  // Comando não reconhecido
  await sock.sendMessage(userId, {
    text: '❌ Comando não reconhecido.\n\n💡 Use:\n• "lembrete" - Criar novo lembrete\n• "lembrete ajuda" - Ver ajuda\n• "meuslembretes" - Ver lembretes'
  });
}

export default lembreteCommand;
import { logger } from '../infrastructure/logger';
