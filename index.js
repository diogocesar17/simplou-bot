require('dotenv').config();
const { default: makeWASocket } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const http = require('http');
const { parseMessage, categoriasCadastradas } = require('./messageParser');
const { 
  initializeDatabase,
  appendRowToDatabase, 
  getDatabaseData, 
  getResumoDoMesAtual, 
  getResumoPorMes, 
  getGastosPorCategoria, 
  getUltimosLancamentos, 
  getLancamentoPorId, 
  atualizarLancamentoPorId, 
  excluirLancamentoPorId 
} = require('./databaseService');
const { getHybridAuthState } = require('./authRedisStorage');

// Controle de contexto simples em memória
let aguardandoConfirmacaoCategoria = {};
let aguardandoEdicao = {};
let aguardandoConfirmacaoValor = {};
let aguardandoExclusao = {};

async function startBot() {
  try {
    // Inicializar banco de dados
    await initializeDatabase();
    console.log('✅ Banco de dados inicializado');
    
    const { state, saveCreds } = await getHybridAuthState();

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('📲 Escaneie o QR Code abaixo:');
        qrcode.generate(qr, { small: true });

        //console.log('📲 Escaneie o QR Code com o WhatsApp neste link:');
        //console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
      }

      if (connection === 'open') {
        console.log('✅ Conectado ao WhatsApp');
      }

      if (connection === 'close') {
        console.log('⚠️ Conexão encerrada:', lastDisconnect?.error?.message);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      const msg = messages[0];
      if (!msg.message || !msg.message.conversation) return;

      const texto = msg.message.conversation.trim();
      const userId = msg.key.remoteJid; // Identificador único do usuário

      // 📌 Comando especial: resumo por mês específico
      if (texto.toLowerCase().startsWith('resumo ')) {
        const mesInput = texto.substring(7).trim(); // Remove "resumo " do início
        
        if (mesInput === '') {
          // Resumo do mês atual
          const resumo = await getResumoDoMesAtual(userId);
          const now = new Date();
          const mes = now.toLocaleString('pt-BR', { month: 'long' });
          const ano = now.getFullYear();

          const msgResumo =
            `📊 *Resumo de ${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}*\n\n` +
            `• Receitas: R$ ${resumo.totalReceitas.toFixed(2)}\n` +
            `• Despesas: R$ ${resumo.totalDespesas.toFixed(2)}\n` +
            `• Saldo: R$ ${resumo.saldo.toFixed(2)}\n` +
            `• Lançamentos: ${resumo.totalLancamentos}`;

          await sock.sendMessage(userId, { text: msgResumo });
        } else {
          // Resumo de mês específico
          const parsed = parseMonthYear(mesInput);
          if (!parsed) {
            await sock.sendMessage(userId, { 
              text: `❌ Formato inválido. Use: "janeiro 2024", "jan 2024", "1 2024" ou "2024"` 
            });
          } else {
            const resumo = await getResumoPorMes(userId, parsed.mes, parsed.ano);
            const nomeMes = getNomeMes(parsed.mes);
            
            const msgResumo =
              `📊 *Resumo de ${nomeMes}/${parsed.ano}*\n\n` +
              `• Receitas: R$ ${resumo.totalReceitas.toFixed(2)}\n` +
              `• Despesas: R$ ${resumo.totalDespesas.toFixed(2)}\n` +
              `• Saldo: R$ ${resumo.saldo.toFixed(2)}\n` +
              `• Lançamentos: ${resumo.totalLancamentos}`;

            await sock.sendMessage(userId, { text: msgResumo });
          }
        }
        
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando especial: resumo (mantido para compatibilidade)
      if (texto.toLowerCase() === 'resumo') {
        const resumo = await getResumoDoMesAtual(userId);
        const now = new Date();
        const mes = now.toLocaleString('pt-BR', { month: 'long' });
        const ano = now.getFullYear();

        const msgResumo =
          `📊 *Resumo de ${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}*\n\n` +
          `• Receitas: R$ ${resumo.totalReceitas.toFixed(2)}\n` +
          `• Despesas: R$ ${resumo.totalDespesas.toFixed(2)}\n` +
          `• Saldo: R$ ${resumo.saldo.toFixed(2)}\n` +
          `• Lançamentos: ${resumo.totalLancamentos}`;

        await sock.sendMessage(userId, { text: msgResumo });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando de ajuda
      if (texto.toLowerCase() === 'ajuda' || texto.toLowerCase() === 'help') {
        const msgAjuda = 
          `🤖 *FinanceBot - Comandos Disponíveis*\n\n` +
          `📊 *Resumos:*\n` +
          `• \`resumo\` - Resumo do mês atual\n` +
          `• \`resumo janeiro 2024\` - Resumo de mês específico\n` +
          `• \`resumo jan 2024\` - Resumo com abreviação\n` +
          `• \`resumo 1 2024\` - Resumo com número do mês\n` +
          `• \`resumo 2024\` - Resumo do ano (mês atual)\n` +
          `• \`resumo janeiro\` - Resumo do mês no ano atual\n\n` +
          `📂 *Análise por Categoria:*\n` +
          `• \`categorias\` - Gastos por categoria (mês atual)\n` +
          `• \`categorias janeiro 2024\` - Categorias de mês específico\n` +
          `• \`categoria alimentação\` - Detalhes da categoria\n` +
          `• \`categoria alimentação janeiro 2024\` - Categoria + período\n\n` +
          `🔧 *Edição e Exclusão:*\n` +
          `• \`editar <N>\` - Editar lançamento pelo número do histórico\n` +
          `• \`excluir <N>\` - Excluir lançamento pelo número do histórico\n\n` +
          `📜 *Histórico:*\n` +
          `• \`histórico\` ou \`ultimos 5\` - Ver últimos lançamentos\n\n` +
          `💰 *Registrar Lançamentos:*\n` +
          `• "gastei 50 no mercado com pix"\n` +
          `• "recebi 1000 salário com crédito"\n` +
          `• "paguei 120 aluguel com débito"\n\n` +
          `💡 *Exemplos:*\n` +
          `• categorias junho 2025\n` +
          `• categoria alimentação\n` +
          `• categoria transporte janeiro 2024\n` +
          `• editar 2\n` +
          `• excluir 3\n` +
          `• ultimos 10`;

        await sock.sendMessage(userId, { text: msgAjuda });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando: categorias (análise geral por categoria)
      if (texto.toLowerCase().startsWith('categorias')) {
        const mesInput = texto.substring(10).trim(); // Remove "categorias " do início
        
        try {
          let resultado;
          if (mesInput) {
            const parsed = parseMonthYear(mesInput);
            if (!parsed) {
              await sock.sendMessage(userId, { 
                text: `❌ Formato inválido. Use: "janeiro 2024", "jan 2024", "1 2024" ou "2024"` 
              });
              await sock.readMessages([msg.key]);
              return;
            }
            resultado = await getGastosPorCategoria(userId, parsed.mes, parsed.ano);
          } else {
            resultado = await getGastosPorCategoria(userId);
          }
          
          if (resultado.categorias.length === 0) {
            await sock.sendMessage(userId, { 
              text: `📂 *Análise por Categoria*\n\n❌ Nenhum gasto encontrado para este período.` 
            });
          } else {
            let msgCategorias = `📂 *Análise por Categoria*\n\n`;
            
            resultado.categorias.forEach((cat, index) => {
              const percentual = ((cat.total / resultado.totalGeral) * 100).toFixed(1);
              msgCategorias += `${index + 1}. *${cat.nome}*\n`;
              msgCategorias += `   💰 R$ ${cat.total.toFixed(2)} (${percentual}%)\n`;
              msgCategorias += `   📊 ${cat.lancamentos} lançamentos\n`;
              msgCategorias += `   📈 Média: R$ ${cat.media.toFixed(2)}\n\n`;
            });
            
            msgCategorias += `💰 *Total Geral: R$ ${resultado.totalGeral.toFixed(2)}*\n`;
            msgCategorias += `📊 *Total de Lançamentos: ${resultado.totalLancamentos}*`;
            
            await sock.sendMessage(userId, { text: msgCategorias });
          }
        } catch (error) {
          await sock.sendMessage(userId, { 
            text: `❌ Erro ao buscar categorias: ${error.message}` 
          });
        }
        
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando: categoria específica
      if (texto.toLowerCase().startsWith('categoria ')) {
        const resto = texto.substring(10).trim(); // Remove "categoria " do início
        
        // Extrai categoria e período (se houver)
        const partes = resto.split(' ');
        let categoria = '';
        let mesInput = '';
        
        if (partes.length >= 1) {
          categoria = partes[0];
          
          // Verifica se há período (últimas partes podem ser mês/ano)
          if (partes.length >= 3) {
            // Possível formato: "alimentação janeiro 2024"
            const possivelMes = partes.slice(-2).join(' ');
            const parsed = parseMonthYear(possivelMes);
            if (parsed) {
              mesInput = possivelMes;
              categoria = partes.slice(0, -2).join(' ');
            }
          } else if (partes.length === 2) {
            // Possível formato: "alimentação janeiro" ou "alimentação 2024"
            const possivelMes = partes[1];
            const parsed = parseMonthYear(possivelMes);
            if (parsed) {
              mesInput = possivelMes;
              categoria = partes[0];
            }
          }
        }
        
        if (!categoria) {
          await sock.sendMessage(userId, { 
            text: `❌ Categoria não especificada.\n\n💡 Exemplos:\n• categoria alimentação\n• categoria transporte janeiro 2024\n• categoria moradia` 
          });
          await sock.readMessages([msg.key]);
          return;
        }
        
        try {
          const resultado = await getGastosCategoriaEspecifica(categoria, mesInput || null);
          
          if (resultado.gastos.length === 0) {
            const periodo = resultado.periodo;
            await sock.sendMessage(userId, { 
              text: `📂 *Categoria: ${resultado.categoria} - ${periodo}*\n\n❌ Nenhum gasto encontrado nesta categoria.` 
            });
          } else {
            let msgCategoria = `📂 *Categoria: ${resultado.categoria} - ${resultado.periodo}*\n\n`;
            msgCategoria += `💰 *Total: R$ ${resultado.totalCategoria.toFixed(2)}*\n`;
            msgCategoria += `📊 *Lançamentos: ${resultado.totalLancamentos}*\n`;
            msgCategoria += `📈 *Média: R$ ${resultado.media.toFixed(2)}*\n\n`;
            msgCategoria += `🔝 *Top ${resultado.gastos.length} Maiores Gastos:*\n\n`;
            
            resultado.gastos.forEach((gasto, index) => {
              msgCategoria += `${index + 1}. R$ ${gasto.valor.toFixed(2)}\n`;
              msgCategoria += `   📅 ${gasto.data}\n`;
              msgCategoria += `   💳 ${gasto.pagamento}\n`;
              msgCategoria += `   📝 ${gasto.descricao.substring(0, 50)}${gasto.descricao.length > 50 ? '...' : ''}\n\n`;
            });
            
            await sock.sendMessage(userId, { text: msgCategoria });
          }
        } catch (error) {
          await sock.sendMessage(userId, { 
            text: `❌ Erro ao buscar categoria: ${error.message}` 
          });
        }
        
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando: histórico por mês específico (deve vir antes do bloco padrão)
      if (/^hist[oó]rico\s+/.test(texto.toLowerCase())) {
        const resto = texto.trim().substring(9).trim();
        const filtro = parseMesAno(resto);
        if (!filtro) {
          await sock.sendMessage(userId, { text: '❌ Não entendi o mês/ano. Exemplos: histórico junho, histórico dezembro 2024, histórico 01/2024' });
          await sock.readMessages([msg.key]);
          return;
        }
        try {
          // Buscar todos os lançamentos da planilha
          const linhas = await getDatabaseData(userId);
          const ultimos = linhas.map(linha => {
            let offset = linha.length === 7 ? 0 : -1;
            return {
              id: linha[0],
              data: linha[1 + offset],
              tipo: linha[2 + offset],
              descricao: linha[3 + offset],
              valor: parseFloat(linha[4 + offset]),
              categoria: linha[5 + offset],
              pagamento: linha[6 + offset]
            };
          }).filter(l => {
            const [dia, mes, ano] = l.data.split('/').map(Number);
            return mes === filtro.mes && ano === filtro.ano;
          });
          if (ultimos.length === 0) {
            await sock.sendMessage(userId, { text: `❌ Nenhum lançamento encontrado para ${resto}.` });
            await sock.readMessages([msg.key]);
            return;
          }
          // Salva o histórico exibido em memória para referência dos índices
          aguardandoEdicao[userId] = aguardandoEdicao[userId] || {};
          aguardandoEdicao[userId].historico = ultimos.slice().reverse();
          aguardandoExclusao[userId] = aguardandoExclusao[userId] || {};
          aguardandoExclusao[userId].historico = ultimos.slice().reverse();
          let msgHist = `📜 *Lançamentos de ${resto}:*\n\n`;
          aguardandoEdicao[userId].historico.forEach((l, i) => {
            msgHist += `${i + 1}. ${l.tipo === 'Receita' ? '🟢' : l.tipo === 'Gasto' ? '🔴' : '⚪️'} R$ ${l.valor.toFixed(2)}\n`;
            msgHist += `   📅 ${l.data} | 📂 ${l.categoria} | 💳 ${l.pagamento}\n`;
            msgHist += `   📝 ${l.descricao.substring(0, 40)}${l.descricao.length > 40 ? '...' : ''}\n\n`;
          });
          msgHist += `\n💡 Para editar ou excluir, use: editar <N> ou excluir <N> (ex: editar 2)`;
          await sock.sendMessage(userId, { text: msgHist });
          await sock.readMessages([msg.key]);
          return;
        } catch (error) {
          await sock.sendMessage(userId, { text: `❌ Erro ao buscar lançamentos: ${error.message}` });
          await sock.readMessages([msg.key]);
          return;
        }
      }

      // 📌 Comando: histórico ou ultimos N lançamentos (apenas se for exatamente 'histórico' ou 'ultimos N')
      if (/^hist[oó]rico\s*$/i.test(texto.toLowerCase()) || texto.toLowerCase().startsWith('ultimos')) {
        let n = 5;
        const match = texto.match(/ultimos\s*(\d+)/i);
        if (match) {
          n = parseInt(match[1]);
          if (isNaN(n) || n < 1) n = 5;
        }
        try {
          const ultimos = await getUltimosLancamentos(userId, n);
          if (ultimos.length === 0) {
            await sock.sendMessage(userId, { text: '❌ Nenhum lançamento encontrado.' });
            await sock.readMessages([msg.key]);
            return;
          }
          // Salva o histórico exibido em memória para referência dos índices
          aguardandoEdicao[userId] = aguardandoEdicao[userId] || {};
          aguardandoEdicao[userId].historico = ultimos.slice().reverse(); // do mais recente para o mais antigo
          aguardandoExclusao[userId] = aguardandoExclusao[userId] || {};
          aguardandoExclusao[userId].historico = ultimos.slice().reverse();
          let msgHist = `📜 *Últimos ${ultimos.length} lançamentos:*\n\n`;
          aguardandoEdicao[userId].historico.forEach((l, i) => {
            msgHist += `${i + 1}. ${l.tipo === 'Receita' ? '🟢' : l.tipo === 'Gasto' ? '🔴' : '⚪️'} R$ ${l.valor.toFixed(2)}\n`;
            msgHist += `   📅 ${l.data} | 📂 ${l.categoria} | 💳 ${l.pagamento}\n`;
            msgHist += `   📝 ${l.descricao.substring(0, 40)}${l.descricao.length > 40 ? '...' : ''}\n\n`;
          });
          msgHist += `\n💡 Para editar ou excluir, use: editar <N> ou excluir <N> (ex: editar 2)`;
          await sock.sendMessage(userId, { text: msgHist });
          await sock.readMessages([msg.key]);
          return;
        } catch (error) {
          await sock.sendMessage(userId, { text: `❌ Erro ao buscar lançamentos: ${error.message}` });
          await sock.readMessages([msg.key]);
          return;
        }
      }

      // Função utilitária para limpar histórico após 2 minutos
      function limparHistoricoAposTimeout(jid) {
        setTimeout(() => {
          if (aguardandoEdicao[jid]) delete aguardandoEdicao[jid].historico;
          if (aguardandoExclusao[jid]) delete aguardandoExclusao[jid].historico;
        }, 2 * 60 * 1000); // 2 minutos
      }

      // 📌 Comando: editar N
      if (/^editar\s+\d+$/i.test(texto)) {
        const match = texto.match(/^editar\s+(\d+)$/i);
        const n = match ? parseInt(match[1]) : null;
        const historico = aguardandoEdicao[userId]?.historico;
        if (!n || n < 1 || !historico || n > historico.length) {
          await sock.sendMessage(userId, { text: '❌ Para editar um lançamento, primeiro digite "histórico" para ver a lista numerada. Depois use: editar <N>' });
          await sock.readMessages([msg.key]);
          return;
        }
        const lancamento = historico[n - 1];
        aguardandoEdicao[userId] = aguardandoEdicao[userId] || {};
        aguardandoEdicao[userId].lancamento = lancamento;
        aguardandoEdicao[userId].campo = null;
        limparHistoricoAposTimeout(userId);
        const msgEdicao =
          `📝 *Lançamento #${n}:*\n\n` +
          `📅 Data: ${lancamento.data}\n` +
          `💰 Valor: R$ ${lancamento.valor.toFixed(2)}\n` +
          `📂 Categoria: ${lancamento.categoria}\n` +
          `💳 Pagamento: ${lancamento.pagamento}\n` +
          `📄 Descrição: ${lancamento.descricao}\n\n` +
          `🔧 *O que deseja editar?*\n` +
          `• "valor" - Alterar valor\n` +
          `• "categoria" - Alterar categoria\n` +
          `• "pagamento" - Alterar forma de pagamento\n` +
          `• "descrição" - Alterar descrição\n` +
          `• "cancelar" - Cancelar edição`;
        await sock.sendMessage(userId, { text: msgEdicao });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando: excluir N
      if (/^excluir\s+\d+$/i.test(texto)) {
        const match = texto.match(/^excluir\s+(\d+)$/i);
        const n = match ? parseInt(match[1]) : null;
        const historico = aguardandoExclusao[userId]?.historico;
        if (!n || n < 1 || !historico || n > historico.length) {
          await sock.sendMessage(userId, { text: '❌ Para excluir um lançamento, primeiro digite "histórico" para ver a lista numerada. Depois use: excluir <N>' });
          await sock.readMessages([msg.key]);
          return;
        }
        const lancamento = historico[n - 1];
        aguardandoExclusao[userId] = aguardandoExclusao[userId] || {};
        aguardandoExclusao[userId].id = lancamento.id;
        aguardandoExclusao[userId].resumo = lancamento;
        limparHistoricoAposTimeout(userId);
        let msgConf = `⚠️ *Confirma a exclusão do lançamento #${n}?*\n\n`;
        msgConf += `📅 ${lancamento.data}\n💰 R$ ${lancamento.valor.toFixed(2)}\n📂 ${lancamento.categoria}\n💳 ${lancamento.pagamento}\n📝 ${lancamento.descricao.substring(0, 40)}${lancamento.descricao.length > 40 ? '...' : ''}\n\n`;
        msgConf += `Responda "sim" para confirmar ou "não" para cancelar.`;
        await sock.sendMessage(userId, { text: msgConf });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Se aguardando edição
      if (aguardandoEdicao[userId] && aguardandoEdicao[userId].lancamento) {
        const { lancamento, campo } = aguardandoEdicao[userId];

        if (!campo) {
          // Aguardando escolha do campo
          const escolha = texto.toLowerCase().trim();

          if (escolha === 'cancelar') {
            delete aguardandoEdicao[userId];
            await sock.sendMessage(userId, {
              text: '❌ Edição cancelada.'
            });
            await sock.readMessages([msg.key]);
            return;
          }

          if (['valor', 'categoria', 'pagamento', 'descrição', 'descricao'].includes(escolha)) {
            aguardandoEdicao[userId].campo = escolha;

            let msgCampo = '';
            switch (escolha) {
              case 'valor':
                msgCampo = `💰 Digite o novo valor (ex: 50.00):`;
                break;
              case 'categoria':
                msgCampo = `📂 Digite a nova categoria (ex: Alimentação, Saúde, etc.):`;
                break;
              case 'pagamento':
                msgCampo = `💳 Digite a nova forma de pagamento (ex: PIX, DÉBITO, etc.):`;
                break;
              case 'descrição':
              case 'descricao':
                msgCampo = `📄 Digite a nova descrição:`;
                break;
            }

            await sock.sendMessage(userId, { text: msgCampo });
            return;
          } else {
            await sock.sendMessage(userId, {
              text: '❓ Opção inválida. Digite: valor, categoria, pagamento, descrição ou cancelar.'
            });
            return;
          }
        } else {
          // Aguardando novo valor para o campo
          const novoValor = texto.trim();

          try {
            const lancamentoAtualizado = { ...lancamento };

            switch (campo) {
              case 'valor':
                const valorNumerico = parseFloat(novoValor.replace(',', '.'));
                if (isNaN(valorNumerico) || valorNumerico < 0.01) {
                  await sock.sendMessage(userId, {
                    text: '❌ Valor inválido. Digite um valor maior que R$ 0,01.'
                  });
                  return;
                }
                lancamentoAtualizado.valor = valorNumerico;
                break;

              case 'categoria':
                lancamentoAtualizado.categoria = novoValor;
                break;

              case 'pagamento':
                lancamentoAtualizado.pagamento = novoValor.toUpperCase();
                break;

              case 'descrição':
              case 'descricao':
                lancamentoAtualizado.descricao = novoValor;
                break;
            }

            await atualizarLancamentoPorId(userId, lancamentoAtualizado.id, lancamentoAtualizado);

            await sock.sendMessage(userId, {
              text: `✅ Lançamento atualizado com sucesso!\n\n` +
                `📅 Data: ${lancamentoAtualizado.data}\n` +
                `💰 Valor: R$ ${lancamentoAtualizado.valor.toFixed(2)}\n` +
                `📂 Categoria: ${lancamentoAtualizado.categoria}\n` +
                `💳 Pagamento: ${lancamentoAtualizado.pagamento}\n` +
                `📝 Descrição: ${lancamentoAtualizado.descricao}`
            });

            delete aguardandoEdicao[userId];
            await sock.readMessages([msg.key]);
            return;

          } catch (error) {
            await sock.sendMessage(userId, {
              text: `❌ Erro ao atualizar lançamento: ${error.message}`
            });
            delete aguardandoEdicao[userId];
            await sock.readMessages([msg.key]);
            return;
          }
        }
      }

      // 📌 Se aguardando confirmação de exclusão
      if (aguardandoExclusao[userId] && aguardandoExclusao[userId].id) {
        const resposta = texto.trim().toLowerCase();
        const { id, resumo } = aguardandoExclusao[userId];
        if (resposta === 'sim' || resposta === 's') {
          try {
            await excluirLancamentoPorId(userId, id);
            await sock.sendMessage(userId, { text: `✅ Lançamento excluído com sucesso!` });
          } catch (error) {
            await sock.sendMessage(userId, { text: `❌ Erro ao excluir lançamento: ${error.message}` });
          }
          delete aguardandoExclusao[userId];
          await sock.readMessages([msg.key]);
          return;
        } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n') {
          await sock.sendMessage(userId, { text: '❌ Exclusão cancelada.' });
          delete aguardandoExclusao[userId];
          await sock.readMessages([msg.key]);
          return;
        } else {
          await sock.sendMessage(userId, { text: '❓ Responda "sim" para confirmar a exclusão ou "não" para cancelar.' });
          return;
        }
      }

      // 📌 Se aguardando confirmação de categoria
      if (aguardandoConfirmacaoCategoria[userId]) {
        const resposta = texto.trim().toLowerCase();
        const { parsedLancamento } = aguardandoConfirmacaoCategoria[userId];
        if (resposta === 'sim' || resposta === 's') {
          // Adiciona categoria à lista
          if (!categoriasCadastradas.includes(parsedLancamento.categoria)) {
            categoriasCadastradas.push(parsedLancamento.categoria);
          }
          await appendRowToDatabase(userId, [
            parsedLancamento.data,
            parsedLancamento.tipo,
            parsedLancamento.descricao,
            parsedLancamento.valor,
            parsedLancamento.categoria,
            parsedLancamento.pagamento,
          ]);
          await sock.sendMessage(userId, {
            text: `✅ Categoria "${parsedLancamento.categoria}" criada e lançamento salvo com sucesso!`
          });
          delete aguardandoConfirmacaoCategoria[userId];
          await sock.readMessages([msg.key]);
          return;
        } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n') {
          await sock.sendMessage(userId, {
            text: `❌ Lançamento descartado. Você pode tentar novamente informando outra categoria.`
          });
          delete aguardandoConfirmacaoCategoria[userId];
          await sock.readMessages([msg.key]);
          return;
        } else {
          await sock.sendMessage(userId, {
            text: `❓ Responda "sim" para criar a categoria "${parsedLancamento.categoria}" ou "não" para descartar.`
          });
          return;
        }
      }

      // Se aguardando confirmação de valor alto ou data distante
      if (aguardandoConfirmacaoValor[userId]) {
        const resposta = texto.trim().toLowerCase();
        const { parsedLancamento, alertaDataDistante } = aguardandoConfirmacaoValor[userId];
        if (resposta === 'sim' || resposta === 's') {
          await appendRowToDatabase(userId, [
            parsedLancamento.data,
            parsedLancamento.tipo,
            parsedLancamento.descricao,
            parsedLancamento.valor,
            parsedLancamento.categoria,
            parsedLancamento.pagamento,
          ]);
          await sock.sendMessage(userId, {
            text: `✅ ${parsedLancamento.tipo} de R$ ${parsedLancamento.valor.toFixed(2)} salvo com sucesso!\n📂 Categoria: ${parsedLancamento.categoria}\n💳 Pagamento: ${parsedLancamento.pagamento}\n📅 Data: ${parsedLancamento.data}`
          });
          delete aguardandoConfirmacaoValor[userId];
          await sock.readMessages([msg.key]);
          return;
        } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n') {
          await sock.sendMessage(userId, {
            text: '❌ Lançamento cancelado. Você pode tentar novamente com uma data diferente.'
          });
          delete aguardandoConfirmacaoValor[userId];
          await sock.readMessages([msg.key]);
          return;
        } else {
          await sock.sendMessage(userId, {
            text: '❓ Responda "sim" para confirmar o lançamento ou "não" para cancelar.'
          });
          return;
        }
      }

      // Mensagem comum para registro de gasto/receita
      const parsed = parseMessage(texto.toLowerCase());

      // Se parser retornar erro
      if (parsed.error) {
        await sock.sendMessage(userId, { text: `❌ ${parsed.error}` });
        await sock.readMessages([msg.key]);
        return;
      }

      // Se for nova categoria, pedir confirmação
      if (parsed.isNovaCategoria) {
        aguardandoConfirmacaoCategoria[userId] = { parsedLancamento: parsed };
        await sock.sendMessage(userId, {
          text: `⚠️ Categoria "${parsed.categoria}" não existe. Deseja criar? (sim/não)`
        });
        return;
      }

      // Se houver validações (alertas), mostrar e perguntar se confirma
      if (parsed.validacoes && parsed.validacoes.length > 0) {
        let msgValidacoes = `⚠️ *Alertas detectados:*\n\n`;
        parsed.validacoes.forEach(validacao => {
          msgValidacoes += `${validacao}\n`;
        });
        // Validação de data muito distante
        if (isDataMuitoDistante(parsed.data)) {
          msgValidacoes += `\n⚠️ A data informada (${parsed.data}) está muito distante da data atual. Tem certeza que deseja registrar este lançamento para essa data? (sim/não)\n`;
          aguardandoConfirmacaoValor[userId] = { parsedLancamento: parsed, alertaDataDistante: true };
          await sock.sendMessage(userId, { text: msgValidacoes });
          return;
        }
        msgValidacoes += `\n📝 *Resumo do lançamento:*\n`;
        msgValidacoes += `💰 Valor: R$ ${parsed.valor.toFixed(2)}\n`;
        msgValidacoes += `📂 Categoria: ${parsed.categoria}\n`;
        msgValidacoes += `💳 Pagamento: ${parsed.pagamento}\n`;
        msgValidacoes += `📅 Data: ${parsed.data}\n\n`;
        msgValidacoes += `❓ Deseja confirmar este lançamento? (sim/não)`;
        
        aguardandoConfirmacaoValor[userId] = { parsedLancamento: parsed };
        await sock.sendMessage(userId, { text: msgValidacoes });
        return;
      }

      // Validação de data muito distante (caso não haja outros alertas)
      if (isDataMuitoDistante(parsed.data)) {
        let msgDataDistante = `⚠️ A data informada (${parsed.data}) está muito distante da data atual. Tem certeza que deseja registrar este lançamento para essa data? (sim/não)`;
        aguardandoConfirmacaoValor[userId] = { parsedLancamento: parsed, alertaDataDistante: true };
        await sock.sendMessage(userId, { text: msgDataDistante });
        return;
      }

      // Registro normal (sem alertas)
      if (parsed.valor) {
        await appendRowToDatabase(userId, [
          parsed.data,
          parsed.tipo,
          parsed.descricao,
          parsed.valor,
          parsed.categoria,
          parsed.pagamento,
        ]);

        await sock.sendMessage(userId, {
          text: `✅ ${parsed.tipo} de R$ ${parsed.valor.toFixed(2)} salvo com sucesso!\n📂 Categoria: ${parsed.categoria}\n💳 Pagamento: ${parsed.pagamento}`
        });

        await sock.readMessages([msg.key]);
      } else {
        await sock.sendMessage(userId, {
          text: '❌ Não consegui entender o valor. Tente algo como:\n\n"gastei 45 reais no mercado com débito"'
        });
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
  }
}

// Servidor HTTP para health check (Render)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('FinanceBot está funcionando! 🤖');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP rodando na porta ${PORT}`);
});

startBot();