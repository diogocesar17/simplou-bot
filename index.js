require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const http = require('http');
const { parseMessage, categoriasCadastradas, isDataMuitoDistante } = require('./messageParser');
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
  excluirLancamentoPorId,
  getTotalGastosPorPagamento,
  excluirParcelamentoPorId
} = require('./databaseService');
const { getGastosCategoriaEspecifica, parseMonthYear, getNomeMes } = require('./googleSheetService');

// Função utilitária para formatar valores de forma segura
function formatarValor(valor, casasDecimais = 2) {
  if (valor === null || valor === undefined) return '0.00';
  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico)) return '0.00';
  return valorNumerico.toFixed(casasDecimais);
}

// Função para parsear mês/ano
const meses = ['janeiro','fevereiro','março','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function parseMesAno(input) {
  if (!input) return null;
  input = input.trim().toLowerCase();
  let mes = null, ano = null;
  const match = input.match(/^(\d{1,2})[\/\-\s]?(\d{2,4})?$/);
  if (match) {
    mes = parseInt(match[1]);
    ano = match[2] ? parseInt(match[2]) : (new Date()).getFullYear();
  } else {
    const partes = input.split(/\s+/);
    let nomeMes = partes[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c');
    let idx = meses.findIndex(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c') === nomeMes);
    if (idx === -1 && nomeMes === 'marco') idx = 2; // Aceita 'marco' como 'março'
    if (idx !== -1) {
      mes = idx + 1;
      ano = partes[1] ? parseInt(partes[1]) : (new Date()).getFullYear();
    }
  }
  if (mes && mes >= 1 && mes <= 12) {
    if (!ano || ano < 100) ano = 2000 + (ano || 0);
    return { mes, ano };
  }
  return null;
}

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

    // Persistência local de sessão WhatsApp
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);
        
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('📲 Escaneie o QR Code abaixo:');
        qrcode.generate(qr, { small: true });

        console.log('📲 Escaneie o QR Code com o WhatsApp neste link:');
        console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
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
      const textoLower = texto.toLowerCase().normalize('NFD').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/[\u0300-\u036f]/g, '').replace(/ +/g, ' ').trim();
      const userId = msg.key.remoteJid; // Identificador único do usuário

      // 📌 Comando: total no crédito/débito/pix (super flexível)
      if (/^total( no)? (credito|debito|pix)$/.test(textoLower)) {
        const total = await getTotalGastosPorPagamento(userId, tipoPagamento);
        const now = new Date();
        const nomeMes = now.toLocaleString('pt-BR', { month: 'long' });
        const ano = now.getFullYear();
        await sock.sendMessage(userId, {
          text: `💳 Total de gastos no ${tipoPagamento.charAt(0) + tipoPagamento.slice(1).toLowerCase()} em ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${ano}: R$ ${formatarValor(total)}`
        });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando: total no crédito/débito/pix por mês específico
      if (/^total( no)? (credito|debito|pix)( em| de)? (.+)$/i.test(texto)) {
        const match = texto.match(/^total( no)? (credito|debito|pix)( em| de)? (.+)$/i);
        if (match) {
          const tipoPagamento = match[2].toUpperCase();
          const mesInput = match[4].trim();
          
          let tipoPagamentoFormatado = '';
          if (tipoPagamento === 'CREDITO') tipoPagamentoFormatado = 'CRÉDITO';
          else if (tipoPagamento === 'DEBITO') tipoPagamentoFormatado = 'DÉBITO';
          else if (tipoPagamento === 'PIX') tipoPagamentoFormatado = 'PIX';
          
          const mesInputPadronizado = mesInput.replace(/[\/-]/g, ' ');
          const parsed = parseMonthYear(mesInputPadronizado);
          if (!parsed) {
            await sock.sendMessage(userId, { 
              text: `❌ Formato de mês inválido. Use: "total no crédito janeiro 2024", "total no pix jan 2024", "total no débito 1 2024"` 
            });
            await sock.readMessages([msg.key]);
            return;
          }
          
          try {
            const total = await getTotalGastosPorPagamento(userId, tipoPagamentoFormatado, parsed.mes, parsed.ano);
            const nomeMes = getNomeMes(parsed.mes);
            await sock.sendMessage(userId, {
              text: `💳 Total de gastos no ${tipoPagamentoFormatado.charAt(0) + tipoPagamentoFormatado.slice(1).toLowerCase()} em ${nomeMes}/${parsed.ano}: R$ ${formatarValor(total)}`
            });
          } catch (error) {
            await sock.sendMessage(userId, { 
              text: `❌ Erro ao buscar total: ${error.message}` 
            });
          }
          await sock.readMessages([msg.key]);
          return;
        }
      }

      // 📌 Comando especial: resumo por mês específico
      if (textoLower.startsWith('resumo ')) {
        const mesInput = textoLower.substring(7).trim(); // Remove "resumo " do início
        
        if (mesInput === '') {
          // Resumo do mês atual
          const resumo = await getResumoDoMesAtual(userId);
          const now = new Date();
          const mes = now.toLocaleString('pt-BR', { month: 'long' });
          const ano = now.getFullYear();

          const msgResumo =
            `📊 *Resumo de ${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}*\n\n` +
            `• Receitas: R$ ${formatarValor(resumo.totalReceitas)}\n` +
            `• Despesas: R$ ${formatarValor(resumo.totalDespesas)}\n` +
            `• Saldo: R$ ${formatarValor(resumo.saldo)}\n` +
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
              `• Receitas: R$ ${formatarValor(resumo.totalReceitas)}\n` +
              `• Despesas: R$ ${formatarValor(resumo.totalDespesas)}\n` +
              `• Saldo: R$ ${formatarValor(resumo.saldo)}\n` +
              `• Lançamentos: ${resumo.totalLancamentos}`;

            await sock.sendMessage(userId, { text: msgResumo });
          }
        }
        
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando especial: resumo (mantido para compatibilidade)
      if (textoLower === 'resumo') {
        const resumo = await getResumoDoMesAtual(userId);
        const now = new Date();
        const mes = now.toLocaleString('pt-BR', { month: 'long' });
        const ano = now.getFullYear();

        const msgResumo =
          `📊 *Resumo de ${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}*\n\n` +
          `• Receitas: R$ ${formatarValor(resumo.totalReceitas)}\n` +
          `• Despesas: R$ ${formatarValor(resumo.totalDespesas)}\n` +
          `• Saldo: R$ ${formatarValor(resumo.saldo)}\n` +
          `• Lançamentos: ${resumo.totalLancamentos}`;

        await sock.sendMessage(userId, { text: msgResumo });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Comando de ajuda
      if (textoLower === 'ajuda' || textoLower === 'help') {
        const msgAjuda = 
          `🤖 *FinanceBot - Comandos Disponíveis*\n\n` +
          `📊 *Resumos:*\n` +
          `• \`resumo\` - Resumo do mês atual\n` +
          `• \`resumo janeiro 2024\` - Resumo de mês específico\n` +
          `• \`resumo jan 2024\` - Resumo com abreviação\n` +
          `• \`resumo 1 2024\` - Resumo com número do mês\n` +
          `• \`resumo 2024\` - Resumo do ano (mês atual)\n` +
          `• \`resumo janeiro\` - Resumo do mês no ano atual\n\n` +
          `💳 *Total por Pagamento:*\n` +
          `• \`total no crédito\` - Total no crédito (mês atual)\n` +
          `• \`total no débito\` - Total no débito (mês atual)\n` +
          `• \`total no pix\` - Total no PIX (mês atual)\n` +
          `• \`total no crédito janeiro 2024\` - Total por mês específico\n` +
          `• \`total no pix jan 2024\` - Total com abreviação\n` +
          `• \`total no débito 1 2024\` - Total com número do mês\n\n` +
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
          `• total no crédito janeiro 2024\n` +
          `• total no pix junho 2025\n` +
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
      if (textoLower.startsWith('categorias')) {
        const mesInput = textoLower.substring(10).trim(); // Remove "categorias " do início
        
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
              const percentual = formatarValor((cat.total / resultado.totalGeral) * 100, 1);
              msgCategorias += `${index + 1}. *${cat.nome}*\n`;
              msgCategorias += `   💰 R$ ${formatarValor(cat.total)} (${percentual}%)\n`;
              msgCategorias += `   📊 ${cat.lancamentos} lançamentos\n`;
              msgCategorias += `   📈 Média: R$ ${formatarValor(cat.media)}\n\n`;
            });
            
            msgCategorias += `💰 *Total Geral: R$ ${formatarValor(resultado.totalGeral)}*\n`;
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
      if (textoLower.startsWith('categoria ')) {
        const resto = textoLower.substring(10).trim(); // Remove "categoria " do início
        
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
            msgCategoria += `💰 *Total: R$ ${formatarValor(resultado.totalCategoria)}*\n`;
            msgCategoria += `📊 *Lançamentos: ${resultado.totalLancamentos}*\n`;
            msgCategoria += `📈 *Média: R$ ${formatarValor(resultado.media)}*\n\n`;
            msgCategoria += `🔝 *Top ${resultado.gastos.length} Maiores Gastos:*\n\n`;
            
            resultado.gastos.forEach((gasto, index) => {
              msgCategoria += `${index + 1}. R$ ${formatarValor(gasto.valor)}\n`;
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

      // 📌 Comando: histórico por mês específico OU últimos lançamentos
      if (/^hist[oó]rico(\b|\s)/.test(textoLower)) {
        const resto = textoLower.replace(/^hist[oó]rico(\b|\s)/, '').trim();
        if (!resto) {
          // Só 'histórico' - mostrar últimos lançamentos
          let ultimos = await getUltimosLancamentos(userId, 5);
          // Agrupa parcelamentos
          const vistosParcelamentos = new Set();
          const historicoAgrupado = [];
          for (let l of ultimos) {
            if (l.parcelamento_id) {
              if (vistosParcelamentos.has(l.parcelamento_id)) continue;
              // Agrupa todas as parcelas desse parcelamento
              const grupo = ultimos.filter(x => x.parcelamento_id === l.parcelamento_id);
              const valorTotal = grupo.reduce((soma, x) => soma + parseFloat(x.valor), 0);
              historicoAgrupado.push({
                ...l,
                valor: valorTotal,
                descricao: `${l.descricao.replace(/\(1\/\d+\)/, '').trim()} (Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(grupo[0].valor)})`,
                agrupado: true
              });
              vistosParcelamentos.add(l.parcelamento_id);
            } else {
              historicoAgrupado.push(l);
            }
            if (historicoAgrupado.length >= 5) break;
          }
          if (!historicoAgrupado || historicoAgrupado.length === 0) {
            await sock.sendMessage(userId, { text: '❌ Nenhum lançamento encontrado.' });
            await sock.readMessages([msg.key]);
            return;
          }
          let msgHist = `📜 *Últimos ${historicoAgrupado.length} lançamentos:*
\n`;
          historicoAgrupado.forEach((l, i) => {
            // Exibir data em dd/mm/yyyy
            let dataFormatada = l.data;
            if (l.data instanceof Date) {
              const d = l.data;
              dataFormatada = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
            } else if (typeof l.data === 'string' && l.data.includes('-')) {
              const [ano, mes, dia] = l.data.split('-');
              dataFormatada = `${dia}/${mes}/${ano}`;
            }
            msgHist += `${i + 1}. ${l.tipo === 'Receita' ? '🟢' : l.tipo === 'Gasto' ? '🔴' : '⚪️'} R$ ${formatarValor(parseFloat(l.valor))}\n`;
            msgHist += `   📅 ${dataFormatada} | 📂 ${l.categoria} | 💳 ${l.pagamento}\n`;
            msgHist += `   📝 ${l.descricao.substring(0, 40)}${l.descricao.length > 40 ? '...' : ''}\n\n`;
          });
          msgHist += `\n💡 Para editar ou excluir, use: editar <N> ou excluir <N> (ex: editar 2)`;
          await sock.sendMessage(userId, { text: msgHist });
          await sock.readMessages([msg.key]);
          return;
        }
        // Se tem texto após histórico, tenta filtrar por mês/ano
        const filtro = parseMonthYear(resto.replace(/[\/\-]/g, ' '));
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
            let dia, mes, ano;
            let dataStr = l.data;
            if (l.data instanceof Date) {
              dataStr = l.data.toISOString().slice(0, 10);
            }
            if (typeof dataStr === 'string' && dataStr.includes('/')) {
              [dia, mes, ano] = dataStr.split('/').map(Number);
              mes = mes - 1; // Ajusta para zero-based
            } else if (typeof dataStr === 'string' && dataStr.includes('-')) {
              [ano, mes, dia] = dataStr.split('-').map(Number);
              mes = mes - 1; // Ajusta para zero-based
            } else {
              return false;
            }
            return Number(mes) === Number(filtro.mes) && Number(ano) === Number(filtro.ano);
          });
          if (ultimos.length === 0) {
            await sock.sendMessage(userId, { text: `❌ Nenhum lançamento encontrado para ${resto}.` });
            await sock.readMessages([msg.key]);
            return;
          }
          let msgHist = `📜 *Lançamentos de ${resto}:*\n\n`;
          ultimos.forEach((l, i) => {
            // Exibir data em dd/mm/yyyy
            let dataFormatada = l.data;
            if (l.data instanceof Date) {
              const d = l.data;
              dataFormatada = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
            } else if (typeof l.data === 'string' && l.data.includes('-')) {
              const [ano, mes, dia] = l.data.split('-');
              dataFormatada = `${dia}/${mes}/${ano}`;
            }
            msgHist += `${i + 1}. ${l.tipo === 'Receita' ? '🟢' : l.tipo === 'Gasto' ? '🔴' : '⚪️'} R$ ${formatarValor(parseFloat(l.valor))}\n`;
            msgHist += `   📅 ${dataFormatada} | 📂 ${l.categoria} | 💳 ${l.pagamento}\n`;
            msgHist += `   📝 ${l.descricao.substring(0, 40)}${l.descricao.length > 40 ? '...' : ''}\n\n`;
          });
          await sock.sendMessage(userId, { text: msgHist });
          await sock.readMessages([msg.key]);
          return;
        } catch (error) {
          await sock.sendMessage(userId, { text: `❌ Erro ao buscar lançamentos: ${error.message}` });
          await sock.readMessages([msg.key]);
          return;
        }
      }

      // 📌 Se aguardando edição
      if (aguardandoEdicao[userId] && aguardandoEdicao[userId].lancamento) {
        const { lancamento, campo } = aguardandoEdicao[userId];

        if (!campo) {
          // Aguardando escolha do campo
          const escolha = textoLower.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '');

          if (escolha === 'cancelar') {
            delete aguardandoEdicao[userId];
            await sock.sendMessage(userId, {
              text: '❌ Edição cancelada.'
            });
            await sock.readMessages([msg.key]);
            return;
          }

          // Aceita variações de campo
          const camposValidos = ['valor', 'categoria', 'pagamento', 'descricao', 'descrição'];
          const campoEscolhido = camposValidos.find(c => escolha === c || escolha === c.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
          if (campoEscolhido) {
            aguardandoEdicao[userId].campo = campoEscolhido;
            let msgCampo = '';
            switch (campoEscolhido) {
              case 'valor':
                msgCampo = `💰 Digite o novo valor (ex: 50.00):`;
                break;
              case 'categoria':
                msgCampo = `📂 Digite a nova categoria (ex: Alimentação, Saúde, etc.):`;
                break;
              case 'pagamento':
                msgCampo = `💳 Digite a nova forma de pagamento (ex: PIX, DÉBITO, etc.):`;
                break;
              case 'descricao':
              case 'descrição':
                msgCampo = `📄 Digite a nova descrição:`;
                break;
            }
            await sock.sendMessage(userId, { text: msgCampo });
            return;
          } else {
            await sock.sendMessage(userId, {
              text: '❓ Campo não reconhecido. Digite: valor, categoria, pagamento, descrição ou cancelar.'
            });
            return;
          }
        } else {
          // Aguardando novo valor para o campo
          const novoValor = textoLower.trim();

          try {
            // Sempre manter o tipo original do lançamento
            const lancamentoAtualizado = { ...lancamento, tipo: lancamento.tipo === 'Receita' ? 'receita' : 'gasto' };

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

              case 'descricao':
              case 'descrição':
                lancamentoAtualizado.descricao = novoValor;
                break;
            }

            await atualizarLancamentoPorId(userId, lancamentoAtualizado.id, lancamentoAtualizado);

            // Formatar data para padrão brasileiro
            let dataFormatada = lancamentoAtualizado.data;
            if (lancamentoAtualizado.data instanceof Date) {
              const d = lancamentoAtualizado.data;
              dataFormatada = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
            } else if (typeof lancamentoAtualizado.data === 'string' && lancamentoAtualizado.data.includes('-')) {
              const [ano, mes, dia] = lancamentoAtualizado.data.split('-');
              dataFormatada = `${dia}/${mes}/${ano}`;
            }

            await sock.sendMessage(userId, {
              text: `✅ Lançamento atualizado com sucesso!\n\n` +
                `📅 Data: ${dataFormatada}\n` +
                `💰 Valor: R$ ${formatarValor(lancamentoAtualizado.valor)}\n` +
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
      if (aguardandoExclusao[userId] && (aguardandoExclusao[userId].id || aguardandoExclusao[userId].parcelamento_id)) {
        const resposta = textoLower.trim().toLowerCase();
        const { id, resumo, parcelamento_id, agrupado } = aguardandoExclusao[userId];
        if (resposta === 'sim' || resposta === 's') {
          try {
            if (agrupado && parcelamento_id) {
              // Excluir todas as parcelas do parcelamento
              const count = await excluirParcelamentoPorId(userId, parcelamento_id);
              await sock.sendMessage(userId, { text: `✅ Parcelamento excluído com sucesso! (${count} parcelas removidas)` });
            } else {
              await excluirLancamentoPorId(userId, id);
              await sock.sendMessage(userId, { text: `✅ Lançamento excluído com sucesso!` });
            }
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

      // 📌 Comando: excluir
      if (/^excluir( parcelamento)? (\d+)$/i.test(textoLower)) {
        const match = textoLower.match(/^excluir( parcelamento)? (\d+)$/i);
        if (match) {
          const idx = parseInt(match[2], 10) - 1;
          let ultimos = await getUltimosLancamentos(userId, 5);
          // Agrupa parcelamentos igual ao histórico
          const vistosParcelamentos = new Set();
          const historicoAgrupado = [];
          for (let l of ultimos) {
            if (l.parcelamento_id) {
              if (vistosParcelamentos.has(l.parcelamento_id)) continue;
              historicoAgrupado.push({ ...l, agrupado: true });
              vistosParcelamentos.add(l.parcelamento_id);
            } else {
              historicoAgrupado.push(l);
            }
            if (historicoAgrupado.length >= 5) break;
          }
          const lancamento = historicoAgrupado[idx];
          console.log('DEBUG EXCLUIR:', { idx, lancamento });
          if (!lancamento) {
            await sock.sendMessage(userId, { text: '❌ Lançamento não encontrado.' });
            return;
          }
          if (lancamento.agrupado) {
            // Parcelamento agrupado: pedir confirmação para excluir todas as parcelas
            aguardandoExclusao[userId] = { parcelamento_id: lancamento.parcelamento_id, resumo: lancamento, agrupado: true };
            await sock.sendMessage(userId, {
              text: `⚠️ Tem certeza que deseja excluir todas as parcelas deste parcelamento? (sim/não)`
            });
            return;
          }
          // Fluxo normal de exclusão
          aguardandoExclusao[userId] = { id: lancamento.id, resumo: lancamento };
          await sock.sendMessage(userId, {
            text: `Tem certeza que deseja excluir este lançamento? (sim/não)`
          });
          return;
        }
      }

      // 📌 Comando: editar <N>
      if (/^editar (\d+)$/i.test(textoLower)) {
        const match = textoLower.match(/^editar (\d+)$/i);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          let ultimos = await getUltimosLancamentos(userId, 5);
          // Agrupa parcelamentos igual ao histórico
          const vistosParcelamentos = new Set();
          const historicoAgrupado = [];
          for (let l of ultimos) {
            if (l.parcelamento_id) {
              if (vistosParcelamentos.has(l.parcelamento_id)) continue;
              historicoAgrupado.push({ ...l, agrupado: true });
              vistosParcelamentos.add(l.parcelamento_id);
            } else {
              historicoAgrupado.push(l);
            }
            if (historicoAgrupado.length >= 5) break;
          }
          const lancamento = historicoAgrupado[idx];
          if (!lancamento) {
            await sock.sendMessage(userId, { text: '❌ Lançamento não encontrado.' });
            return;
          }
          if (lancamento.agrupado) {
            await sock.sendMessage(userId, { text: '❌ Não é possível editar um parcelamento agrupado pelo histórico. Para alterar, exclua todas as parcelas manualmente ou utilize um comando específico para parcelamentos.' });
            return;
          }
          // Bloqueia edição se tipo não for receita ou gasto
          if (!['receita', 'gasto'].includes((lancamento.tipo || '').toLowerCase())) {
            await sock.sendMessage(userId, { text: '❌ Não é possível editar este lançamento porque o tipo não é válido (receita/gasto). Exclua e registre novamente.' });
            return;
          }
          // Fluxo normal de edição
          aguardandoEdicao[userId] = { lancamento, campo: null };
          await sock.sendMessage(userId, {
            text: `Qual campo deseja editar? (valor, categoria, pagamento, descrição)\nOu digite 'cancelar' para abortar.`
          });
          return;
        }
      }

      // 📌 Resposta personalizada para comando 'editar' sem número
      if (/^editar\s*$/i.test(textoLower)) {
        await sock.sendMessage(userId, {
          text: 'ℹ️ Para editar um lançamento, primeiro liste o histórico com o comando "Histórico".\nDepois, responda com "Editar <N>", onde <N> é o número do lançamento.'
        });
        await sock.readMessages([msg.key]);
        return;
      }

      // 📌 Registro de lançamento (normal, parcelado ou recorrente)
      const parsed = parseMessage(texto);
      if (parsed && parsed.valor && parsed.tipo && parsed.categoria && parsed.pagamento && parsed.data) {
        // Parcelamento
        if (parsed.parcelamento && parsed.numParcelas > 1) {
          // Gera um id único para o parcelamento
          const parcelamentoId = `${userId}_${Date.now()}`;
          const valorParcela = Math.floor((parsed.valor / parsed.numParcelas) * 100) / 100;
          let valorRestante = parsed.valor;
          let mensagensParcelas = [];
          for (let i = 1; i <= parsed.numParcelas; i++) {
            // Ajusta a última parcela para fechar o valor total
            let valorAtual = (i === parsed.numParcelas) ? valorRestante : valorParcela;
            valorRestante -= valorAtual;
            // Calcula data da parcela (mês seguinte para cada)
            const dataParts = parsed.data.split('/');
            let dia = parseInt(dataParts[0]);
            let mes = parseInt(dataParts[1]) - 1 + (i - 1);
            let ano = parseInt(dataParts[2]);
            while (mes > 11) { mes -= 12; ano += 1; }
            const dataParcela = new Date(ano, mes, dia);
            const dataFormatada = dataParcela.toLocaleDateString('pt-BR');
            await appendRowToDatabase(userId, [
              dataFormatada,
              parsed.tipo,
              `${parsed.descricao} (${i}/${parsed.numParcelas})`,
              valorAtual,
              parsed.categoria,
              parsed.pagamento,
              parcelamentoId,
              i,
              parsed.numParcelas
            ]);
            mensagensParcelas.push(`Parcela ${i}/${parsed.numParcelas}: R$ ${formatarValor(valorAtual)} em ${dataFormatada}`);
          }
          await sock.sendMessage(userId, {
            text: `✅ Parcelamento registrado com sucesso!\n${mensagensParcelas.join('\n')}`
          });
          await sock.readMessages([msg.key]);
          return;
        }
        // Lançamento normal
        await appendRowToDatabase(userId, [
          parsed.data,
          parsed.tipo,
          parsed.descricao,
          parsed.valor,
          parsed.categoria,
          parsed.pagamento
        ]);
        await sock.sendMessage(userId, {
          text: `✅ Lançamento registrado com sucesso!\n\n📅 Data: ${parsed.data}\n💰 Valor: R$ ${formatarValor(parsed.valor)}\n📂 Categoria: ${parsed.categoria}\n💳 Pagamento: ${parsed.pagamento}\n📝 Descrição: ${parsed.descricao}`
        });
        await sock.readMessages([msg.key]);
        return;
      }
      // Resposta padrão para mensagens não reconhecidas
      await sock.sendMessage(userId, {
        text: '❌ Comando não reconhecido ou valor não encontrado na mensagem.\nDigite *ajuda* para ver a lista de comandos disponíveis.'
      });
      await sock.readMessages([msg.key]);
      return;
    });
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
  }
}

startBot();