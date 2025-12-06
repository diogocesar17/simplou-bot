// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import * as lembretesService from '../services/lembretesService';
import { formatarMensagem } from '../utils/formatMessages';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';

async function meusLembretesCommand(sock, userId, texto) {
  console.log(`[MEUS_LEMBRETES] Comando iniciado: userId=${userId}, texto="${texto}"`);
  
  // Verificar se há estado pendente
  const estado = await obterEstado(userId);
  
  // Fluxo aguardando ação sobre lembrete específico
  if (estado?.etapa === 'aguardando_acao_lembrete') {
    const acao = texto.trim().toLowerCase();
    const lembreteId = estado.dadosParciais.lembreteId;
    
    try {
      switch (acao) {
        case '1':
        case 'editar':
          await sock.sendMessage(userId, {
            text: '🚧 Funcionalidade de edição em desenvolvimento.\n\n💡 Por enquanto, você pode desativar e criar um novo lembrete.'
          });
          await limparEstado(userId);
          break;
          
        case '2':
        case 'pausar':
        case 'ativar':
          const lembrete = await lembretesService.buscarLembretePorId(userId, lembreteId);
          if (!lembrete) {
            await sock.sendMessage(userId, {
              text: '❌ Lembrete não encontrado.'
            });
            await limparEstado(userId);
            return;
          }
          
          const novoStatus = !lembrete.ativo;
          await lembretesService.alternarStatusLembrete(userId, lembreteId);
          
          const statusTexto = novoStatus ? 'ativado' : 'pausado';
          const emoji = novoStatus ? '✅' : '⏸️';
          
          await sock.sendMessage(userId, {
            text: `${emoji} Lembrete "${lembrete.titulo}" foi ${statusTexto} com sucesso!`
          });
          await limparEstado(userId);
          break;
          
        case '3':
        case 'excluir':
        case 'deletar':
          await definirEstado(userId, 'confirmando_exclusao_lembrete', { lembreteId });
          
          await sock.sendMessage(userId, {
            text: '⚠️ Tem certeza que deseja excluir este lembrete?\n\n1. Sim, excluir\n2. Não, cancelar\n\n💡 Esta ação não pode ser desfeita.'
          });
          break;
          
        case '4':
        case 'voltar':
        case 'cancelar':
          await limparEstado(userId);
          await sock.sendMessage(userId, {
            text: '↩️ Operação cancelada.'
          });
          break;
          
        default:
          await sock.sendMessage(userId, {
            text: '❌ Opção inválida. Digite 1, 2, 3 ou 4:'
          });
          break;
      }
    } catch (error) {
      console.error('[MEUS_LEMBRETES] Erro ao processar ação:', error);
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: '❌ Erro ao processar ação. Tente novamente.'
      });
    }
    return;
  }
  
  // Fluxo confirmando exclusão
  if (estado?.etapa === 'confirmando_exclusao_lembrete') {
    const confirmacao = texto.trim().toLowerCase();
    const lembreteId = estado.dadosParciais.lembreteId;
    
    if (confirmacao === '1' || confirmacao === 'sim') {
      try {
        const lembrete = await lembretesService.buscarLembretePorId(userId, lembreteId);
        if (!lembrete) {
          await sock.sendMessage(userId, {
            text: '❌ Lembrete não encontrado.'
          });
          await limparEstado(userId);
          return;
        }
        
        await lembretesService.excluirLembrete(userId, lembreteId);
        
        await sock.sendMessage(userId, {
          text: `🗑️ Lembrete "${lembrete.titulo}" foi excluído com sucesso!`
        });
        await limparEstado(userId);
        
      } catch (error) {
        console.error('[MEUS_LEMBRETES] Erro ao excluir lembrete:', error);
        await sock.sendMessage(userId, {
          text: '❌ Erro ao excluir lembrete. Tente novamente.'
        });
        await limparEstado(userId);
      }
    } else if (confirmacao === '2' || confirmacao === 'não' || confirmacao === 'nao' || confirmacao === 'cancelar') {
      await sock.sendMessage(userId, {
        text: '↩️ Exclusão cancelada.'
      });
      await limparEstado(userId);
    } else {
      await sock.sendMessage(userId, {
        text: '❌ Resposta inválida. Digite 1 para confirmar ou 2 para cancelar:'
      });
    }
    return;
  }
  
  // Fluxo aguardando seleção de lembrete
  if (estado?.etapa === 'aguardando_selecao_lembrete') {
    const selecao = texto.trim();
    const lembretes = estado.dadosParciais.lembretes;
    
    if (selecao.toLowerCase() === 'voltar' || selecao.toLowerCase() === 'cancelar') {
      await limparEstado(userId);
      await sock.sendMessage(userId, {
        text: '↩️ Operação cancelada.'
      });
      return;
    }
    
    const indice = parseInt(selecao) - 1;
    if (isNaN(indice) || indice < 0 || indice >= lembretes.length) {
      await sock.sendMessage(userId, {
        text: `❌ Número inválido. Digite um número de 1 a ${lembretes.length} ou "voltar":` 
      });
      return;
    }
    
    const lembreteSelecionado = lembretes[indice];
    
    // Mostrar detalhes do lembrete e opções
    const dataFormatada = new Date(lembreteSelecionado.data_vencimento).toLocaleDateString('pt-BR');
    const valorTexto = lembreteSelecionado.valor ? ` - R$ ${formatarValor(lembreteSelecionado.valor)}` : '';
    const categoriaTexto = lembreteSelecionado.categoria ? ` [${lembreteSelecionado.categoria}]` : '';
    const recorrenteTexto = lembreteSelecionado.recorrente ? ` 🔄 ${lembreteSelecionado.tipo_recorrencia}` : '';
    const statusTexto = lembreteSelecionado.ativo ? '✅ Ativo' : '⏸️ Pausado';
    const descricaoTexto = lembreteSelecionado.descricao ? `\n📝 ${lembreteSelecionado.descricao}` : '';
    
    await definirEstado(userId, 'aguardando_acao_lembrete', { lembreteId: lembreteSelecionado.id });
    
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Detalhes do Lembrete',
        emojiTitulo: '📋',
        secoes: [
          {
            titulo: 'Informações',
            itens: [
              `📌 ${lembreteSelecionado.titulo}${valorTexto}${categoriaTexto}`,
              `📅 Vence em: ${dataFormatada}${recorrenteTexto}`,
              `⏰ Lembrar ${lembreteSelecionado.dias_antecedencia} dias antes`,
              `🔔 Status: ${statusTexto}`,
              ...(lembreteSelecionado.descricao ? [`📝 ${lembreteSelecionado.descricao}`] : [])
            ],
            emoji: '📊'
          },
          {
            titulo: 'Ações Disponíveis',
            itens: [
              '1. ✏️ Editar (em breve)',
              `2. ${lembreteSelecionado.ativo ? '⏸️ Pausar' : '▶️ Ativar'}`,
              '3. 🗑️ Excluir',
              '4. ↩️ Voltar'
            ],
            emoji: '⚙️'
          }
        ],
        dicas: [
          { texto: 'Digite o número da ação desejada' }
        ]
      })
    });
    return;
  }
  
  // Comando principal - listar lembretes
  const textoLimpo = texto.toLowerCase().replace(/^meuslembretes\s*/i, '').trim();
  
  try {
    // Determinar filtro
    let apenasAtivos = null;
    if (textoLimpo === 'ativos') {
      apenasAtivos = true;
    } else if (textoLimpo === 'pausados' || textoLimpo === 'inativos') {
      apenasAtivos = false;
    }
    
    const lembretes = await lembretesService.listarLembretes(userId, apenasAtivos);
    
    if (lembretes.length === 0) {
      const mensagemVazia = apenasAtivos === true ? 'Você não tem lembretes ativos.' :
                           apenasAtivos === false ? 'Você não tem lembretes pausados.' :
                           'Você ainda não tem lembretes cadastrados.';
      
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo: 'Nenhum lembrete encontrado',
          emojiTitulo: '📭',
          secoes: [
            {
              titulo: 'Informação',
              itens: [mensagemVazia],
              emoji: 'ℹ️'
            }
          ],
          dicas: [
            { texto: 'Criar primeiro lembrete', comando: 'lembrete' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
      return;
    }
    
    // Mostrar lista de lembretes
    const titulo = apenasAtivos === true ? 'Meus Lembretes Ativos' :
                   apenasAtivos === false ? 'Meus Lembretes Pausados' :
                   'Meus Lembretes';
    
    const itensLista = lembretes.map((lembrete, index) => {
      const dataFormatada = new Date(lembrete.data_vencimento).toLocaleDateString('pt-BR');
      const valorTexto = lembrete.valor ? ` - R$ ${formatarValor(lembrete.valor)}` : '';
      const categoriaTexto = lembrete.categoria ? ` [${lembrete.categoria}]` : '';
      const statusEmoji = lembrete.ativo ? '✅' : '⏸️';
      const recorrenteEmoji = lembrete.recorrente ? ' 🔄' : '';
      
      return `${index + 1}. ${statusEmoji} ${lembrete.titulo}${valorTexto}${categoriaTexto}${recorrenteEmoji}\n   📅 ${dataFormatada}`;
    });
    
    // Se há poucos lembretes, mostrar diretamente
    if (lembretes.length <= 5) {
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo,
          emojiTitulo: '📋',
          secoes: [
            {
              titulo: `${lembretes.length} lembrete(s) encontrado(s)`,
              itens: itensLista,
              emoji: '📊'
            }
          ],
          dicas: [
            { texto: 'Digite o número para ver detalhes' },
            { texto: 'Criar novo lembrete', comando: 'lembrete' },
            { texto: 'Ver apenas ativos', comando: 'meuslembretes ativos' },
            { texto: 'Ver apenas pausados', comando: 'meuslembretes pausados' }
          ]
        }) + '\n\n💡 Digite o número do lembrete para ver detalhes e opções:'
      });
      
      // Definir estado para aguardar seleção
      await definirEstado(userId, 'aguardando_selecao_lembrete', { lembretes });
      
    } else {
      // Muitos lembretes - mostrar lista paginada
      await sock.sendMessage(userId, {
        text: formatarMensagem({
          titulo,
          emojiTitulo: '📋',
          secoes: [
            {
              titulo: `${lembretes.length} lembrete(s) encontrado(s)`,
              itens: itensLista.slice(0, 10), // Mostrar apenas os primeiros 10
              emoji: '📊'
            },
            ...(lembretes.length > 10 ? [{
              titulo: 'Mais lembretes',
              itens: [`... e mais ${lembretes.length - 10} lembrete(s)`],
              emoji: '➕'
            }] : [])
          ],
          dicas: [
            { texto: 'Digite o número para ver detalhes' },
            { texto: 'Filtrar por ativos', comando: 'meuslembretes ativos' },
            { texto: 'Filtrar por pausados', comando: 'meuslembretes pausados' }
          ]
        }) + '\n\n💡 Digite o número do lembrete para ver detalhes:'
      });
      
      // Definir estado para aguardar seleção
      await definirEstado(userId, 'aguardando_selecao_lembrete', { lembretes });
    }
    
  } catch (error) {
    console.error('[MEUS_LEMBRETES] Erro ao listar lembretes:', error);
    await sock.sendMessage(userId, {
      text: formatarMensagem({
        titulo: 'Erro ao carregar lembretes',
        emojiTitulo: '❌',
        secoes: [
          {
            titulo: 'Detalhes do Erro',
            itens: [error.message || 'Erro desconhecido'],
            emoji: '🚨'
          }
        ],
        dicas: [
          { texto: 'Tentar novamente', comando: 'meuslembretes' },
          { texto: 'Ver ajuda', comando: 'ajuda' }
        ]
      })
    });
  }
}

export default meusLembretesCommand;
