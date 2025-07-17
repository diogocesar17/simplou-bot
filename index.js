require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const http = require('http');
const { ADMIN_USERS, AUTHORIZED_USERS, SYSTEM_CONFIG, listUsers } = require('./config.js');
const { parseMessage, categoriasCadastradas, isDataMuitoDistante, formasPagamento, mapeamentoFormasPagamento } = require('./messageParser');
const { analisarMensagemInteligente } = require('./intelligentParser');
const { 
  initializeDatabase,
  appendRowToDatabase, 
  getDatabaseData, 
  getResumoDoMesAtual, 
  getResumoDoDia,
  getResumoPorMes, 
  getGastosPorCategoria, 
  getUltimosLancamentos, 
  getLancamentoPorId, 
  atualizarLancamentoPorId, 
  excluirLancamentoPorId,
  getTotalGastosPorPagamento,
  excluirParcelamentoPorId,
  listarLancamentos,
  excluirRecorrentePorId,
  buscarLancamentosParaExclusao,
  salvarConfiguracaoCartao,
  buscarConfiguracaoCartao,
  listarCartoesConfigurados,
  calcularDataContabilizacao,
  buscarFaturaCartao,
  getResumoReal,
  atualizarCartaoConfigurado,
  formatarDataParaISO,
  buscarAlertasDoDia,
  gerarMensagemAlertas
} = require('./databaseService');
const { verificarEEnviarAlertas } = require('./alertasService');
const { 
  initializeGemini, 
  analisarTransacaoComGemini, 
  analisarPadroesGastos, 
  gerarSugestoesEconomia, 
  preverGastosFuturos, 
  responderPerguntaFinanceira,
  testarConexaoGemini,
  isGeminiAvailable 
} = require('./geminiService');

// Função utilitária para formatar valores de forma segura
function formatarValor(valor, casasDecimais = 2) {
  if (valor === null || valor === undefined) return '0.00';
  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico)) return '0.00';
  return valorNumerico.toFixed(casasDecimais);
}

// Função para parsear mês/ano
const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function parseMesAno(input) {
  if (!input) return null;
  input = input.trim().toLowerCase();
  let mes = null, ano = null;
  const match = input.match(/^([0-9]{1,2})[\/\-\s]?(\d{2,4})?$/);
  if (match) {
    mes = parseInt(match[1]);
    ano = match[2] ? parseInt(match[2]) : (new Date()).getFullYear();
  } else {
    const partes = input.split(/\s+/);
    let nomeMes = partes[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c');
    let idx = meses.findIndex(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ç','c') === nomeMes);
    console.log('[PARSE MESANO DEBUG] input:', input, 'partes[0]:', partes[0], 'nomeMes:', nomeMes, 'idx:', idx);
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

// Função para gerar ID único
function gerarIdUnico() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Função para calcular data futura
function calcularDataFutura(dataInicial, mesesAdicionar) {
  const data = new Date(dataInicial);
  data.setMonth(data.getMonth() + mesesAdicionar);
  return data.toLocaleDateString('pt-BR');
}

// Função para criar parcelamentos
async function criarParcelamento(userId, parsed, cartaoInfo = null) {
  const parcelamentoId = gerarIdUnico();
  const valorParcela = parsed.valor / parsed.numParcelas;
  const dataInicial = new Date(parsed.data.split('/').reverse().join('-'));
  
  let lancamentosCriados = [];
  
  for (let i = 0; i < parsed.numParcelas; i++) {
    const dataParcela = calcularDataFutura(dataInicial, i); // string dd/mm/yyyy
    const descricaoParcela = `${parsed.descricao} (${i + 1}/${parsed.numParcelas})`;
    
    // Converter data para formato ISO (YYYY-MM-DD) para o PostgreSQL
    const dataParcelaISO = dataParcela.split('/').reverse().join('-');
    
    let valores = [
      dataParcelaISO,
      parsed.tipo.toLowerCase(),
      descricaoParcela,
      valorParcela,
      parsed.categoria,
      parsed.pagamento,
      parcelamentoId,
      i + 1,
      parsed.numParcelas
    ];
    
    if (cartaoInfo) {
      // Converter dataParcela para objeto Date corretamente
      const partes = dataParcela.split('/');
      const dataParcelaObj = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
      const dataContabilizacaoInfo = calcularDataContabilizacao(dataParcelaObj, cartaoInfo.dia_vencimento, cartaoInfo.dia_fechamento);
      valores = valores.concat([
        null, // recorrente
        null, // recorrente_fim
        null, // recorrente_id
        cartaoInfo.nome_cartao,
        dataParcelaObj.toISOString().split('T')[0], // data_lancamento
        dataContabilizacaoInfo.dataContabilizacao.toISOString().split('T')[0],
        dataContabilizacaoInfo.mesFatura,
        dataContabilizacaoInfo.anoFatura,
        cartaoInfo.dia_vencimento,
        'pendente',
        parsed.dataVencimento // data_vencimento
      ]);
    } else {
      valores = valores.concat([null, null, null, null, null, null, null, null, null, null, parsed.dataVencimento]);
    }
    
    await appendRowToDatabase(userId, valores);
    lancamentosCriados.push({ data: dataParcela, valor: valorParcela, parcela: i + 1 });
  }
  
  return { parcelamentoId, lancamentosCriados };
}

// Função para criar recorrentes
async function criarRecorrente(userId, parsed, cartaoInfo = null) {
  const recorrenteId = gerarIdUnico();
  const dataInicial = new Date(parsed.data.split('/').reverse().join('-'));
  const dataFim = calcularDataFutura(dataInicial, parsed.recorrenteMeses - 1);
  
  // Converter dataFim para formato ISO (YYYY-MM-DD) para o PostgreSQL
  const dataFimISO = dataFim.split('/').reverse().join('-');
  
  let lancamentosCriados = [];
  
  for (let i = 0; i < parsed.recorrenteMeses; i++) {
    const dataRecorrente = calcularDataFutura(dataInicial, i);
    
    // Converter data para formato ISO (YYYY-MM-DD) para o PostgreSQL
    const dataRecorrenteISO = dataRecorrente.split('/').reverse().join('-');
    
    let valores = [
      dataRecorrenteISO,
      parsed.tipo.toLowerCase(),
      parsed.descricao,
      parsed.valor,
      parsed.categoria,
      parsed.pagamento,
      null, // parcelamento_id
      null, // parcela_atual
      null, // total_parcelas
      true, // recorrente
      dataFimISO,
      recorrenteId
    ];
    
    // Adicionar campos de cartão se aplicável
    if (cartaoInfo) {
      // Usar a data do recorrente para calcular a contabilização correta
      const dataRecorrenteObj = new Date(dataRecorrente.split('/').reverse().join('-'));
      const dataContabilizacaoInfo = calcularDataContabilizacao(dataRecorrenteObj, cartaoInfo.dia_vencimento, cartaoInfo.dia_fechamento);
      valores = valores.concat([
        cartaoInfo.nome_cartao,
        dataRecorrenteObj.toISOString().split('T')[0], // data_lancamento = data do recorrente
        dataContabilizacaoInfo.dataContabilizacao.toISOString().split('T')[0],
        dataContabilizacaoInfo.mesFatura,
        dataContabilizacaoInfo.anoFatura,
        cartaoInfo.dia_vencimento,
        'pendente',
        parsed.dataVencimento // data_vencimento
      ]);
    } else {
      valores = valores.concat([null, null, null, null, null, null, null, parsed.dataVencimento]);
    }
    
    await appendRowToDatabase(userId, valores);
    lancamentosCriados.push({ data: dataRecorrente, valor: parsed.valor, mes: i + 1 });
  }
  
  return { recorrenteId, lancamentosCriados };
}

// Função para processar lançamento (usada após escolha de forma de pagamento)
async function processarLancamento(userId, parsed, sock) {
  console.log('[DEBUG] processarLancamento iniciado com:', parsed);
  
  // --- VERIFICAÇÃO DE FALTA DE DATA DE VENCIMENTO PARA BOLETOS ---
  if (parsed && parsed.faltaDataVencimento) {
    console.log('[DEBUG] Falta data de vencimento para boleto, solicitando ao usuário');
    aguardandoDataVencimento[userId] = { parsed: parsed };
    await sock.sendMessage(userId, {
      text: `📄 *Boleto detectado*\n\n` +
        `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
        `📂 Categoria: ${parsed.categoria}\n` +
        `📝 Descrição: ${parsed.descricao}\n\n` +
        `❓ *Qual é a data de vencimento do boleto?*\n` +
        `Digite no formato dd/mm/aaaa (ex: 25/10/2025) ou "cancelar"`
    });
    return;
  }
  
  // --- VERIFICAÇÃO DE FALTA DE FORMA DE PAGAMENTO ---
  if (parsed && parsed.faltaFormaPagamento) {
    console.log('[DEBUG] Falta forma de pagamento, solicitando ao usuário');
    aguardandoFormaPagamento[userId] = { parsed: parsed };
    let msgFormaPagamento = `💳 *Forma de pagamento não informada*\n\n`;
    msgFormaPagamento += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
    msgFormaPagamento += `📂 Categoria: ${parsed.categoria}\n`;
    msgFormaPagamento += `📝 Descrição: ${parsed.descricao}\n\n`;
    msgFormaPagamento += `❓ *Qual forma de pagamento você usou?*\n\n`;
    formasPagamento.forEach((forma, index) => {
      msgFormaPagamento += `${index + 1}. ${forma}\n`;
    });
    msgFormaPagamento += `\nDigite o número da opção ou "cancelar"`;
    await sock.sendMessage(userId, { text: msgFormaPagamento });
    return;
  }
  
  // --- DETECÇÃO DE GASTOS NO CARTÃO DE CRÉDITO (PRIORITÁRIO) ---
  const pagamentoNormalizado = (parsed.pagamento || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  console.log('[DEBUG] pagamentoNormalizado:', pagamentoNormalizado);
  
  if (
    parsed &&
    parsed.tipo &&
    parsed.tipo.toLowerCase() === 'gasto' &&
    pagamentoNormalizado.includes('credito')
  ) {
    console.log('[DEBUG] Detecção de gasto no crédito');
    const cartoes = await listarCartoesConfigurados(userId);
    console.log('[DEBUG] Cartões encontrados:', cartoes.length, cartoes);
    
    if (cartoes.length === 0) {
      console.log('[DEBUG] Nenhum cartão configurado, registrando como gasto comum');
      try {
        const tipoNormalizado = (parsed.tipo || '').toLowerCase();
        await appendRowToDatabase(userId, [
          parsed.data.split('/').reverse().join('-'),
          tipoNormalizado,
          parsed.descricao,
          parsed.valor,
          parsed.categoria,
          parsed.pagamento,
          null, // parcelamento_id
          null, // parcela_atual
          null, // total_parcelas
          null, // recorrente
          null, // recorrente_fim
          null, // recorrente_id
          null, // cartao_nome
          null, // data_lancamento
          null, // data_contabilizacao
          null, // mes_fatura
          null, // ano_fatura
          null, // dia_vencimento
          null, // status_fatura
          parsed.dataVencimento // data_vencimento
        ]);
        await sock.sendMessage(userId, {
          text: `✅ Gasto registrado com sucesso!\n\n` +
            `📅 Data: ${parsed.data}\n` +
            `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
            `📂 Categoria: ${parsed.categoria}\n` +
            `💳 Pagamento: ${parsed.pagamento}\n` +
            `📝 Descrição: ${parsed.descricao}\n\n` +
            `💡 *Dica:* Para controlar faturas e ter resumos por cartão, use o comando "configurar cartao"!`
        });
        return;
      } catch (error) {
        await sock.sendMessage(userId, { 
          text: `❌ Erro ao registrar gasto: ${error.message}` 
        });
        return;
      }
    }
    
    if (cartoes.length === 1) {
      console.log('[DEBUG] Apenas um cartão configurado, vinculando automaticamente:', cartoes[0]);
      const cartao = cartoes[0];
      const dataLancamento = new Date();
      const dataContabilizacaoInfo = calcularDataContabilizacao(dataLancamento, cartao.dia_vencimento, cartao.dia_fechamento);
      const dataContabilizacao = dataContabilizacaoInfo.dataContabilizacao;
      const mesFatura = dataContabilizacaoInfo.mesFatura;
      const anoFatura = dataContabilizacaoInfo.anoFatura;
      
      try {
        // Verificar se é parcelamento
        if (parsed.parcelamento && parsed.numParcelas > 1) {
          console.log('[DEBUG] Criando parcelamento no cartão:', parsed.numParcelas, 'parcelas');
          const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed, cartao);
          // Calcular datas de contabilização das parcelas
          const datasFatura = [];
          for (let i = 0; i < parsed.numParcelas; i++) {
            const dataParcela = new Date();
            dataParcela.setMonth(dataParcela.getMonth() + i);
            const infoFatura = calcularDataContabilizacao(dataParcela, cartao.dia_vencimento, cartao.dia_fechamento);
            datasFatura.push(infoFatura.dataContabilizacao.toLocaleDateString('pt-BR'));
          }
          let msgParcelamento = `✅ Parcelamento registrado no cartão ${cartao.nome_cartao}!\n\n`;
          msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
          msgParcelamento += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
          msgParcelamento += `📅 Primeira parcela na fatura: ${datasFatura[0]}\n`;
          msgParcelamento += `📅 Última parcela na fatura: ${datasFatura[datasFatura.length - 1]}\n`;
          msgParcelamento += `📂 Categoria: ${parsed.categoria}\n`;
          msgParcelamento += `💳 Pagamento: ${parsed.pagamento}\n`;
          msgParcelamento += `📝 Descrição: ${parsed.descricao}\n`;
          msgParcelamento += `Contabiliza: ${datasFatura[0]} (fatura inicial)`;
          await sock.sendMessage(userId, { text: msgParcelamento });
          return;
        }
        
        // Verificar se é recorrente
        if (parsed.recorrente && parsed.recorrenteMeses > 1) {
          console.log('[DEBUG] Criando recorrente no cartão:', parsed.recorrenteMeses, 'meses');
          const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartao);
          
          let msgRecorrente = `✅ Lançamento recorrente registrado no cartão ${cartao.nome_cartao}!\n\n`;
          msgRecorrente += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
          msgRecorrente += `🔄 ${parsed.recorrenteMeses} meses (${parsed.recorrenteMeses}x)\n`;
          msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
          msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
          // Adicionar informação de confiança da categoria para recorrente
          let msgCategoriaRecorrente = `📂 Categoria: ${parsed.categoria}`;
          if (parsed.confiancaCategoria) {
            const iconesConfianca = {
              'alta': '🟢',
              'media': '🟡', 
              'baixa': '🟠',
              'nenhuma': '🔴'
            };
            const icone = iconesConfianca[parsed.confiancaCategoria] || '⚪';
            msgCategoriaRecorrente += ` ${icone} (${parsed.confiancaCategoria})`;
          }
          msgRecorrente += `${msgCategoriaRecorrente}\n`;
          msgRecorrente += `💳 Pagamento: ${parsed.pagamento}\n`;
          msgRecorrente += `📝 Descrição: ${parsed.descricao}`;
          
          await sock.sendMessage(userId, { text: msgRecorrente });
          return;
        }
        
        // Gasto normal no cartão (não parcelado, não recorrente)
        console.log('[DEBUG] Criando gasto normal no cartão');
        await appendRowToDatabase(userId, [
          parsed.data.split('/').reverse().join('-'),
          parsed.tipo.toLowerCase(),
          parsed.descricao,
          parsed.valor,
          parsed.categoria,
          parsed.pagamento,
          null, // parcelamento_id
          null, // parcela_atual
          null, // total_parcelas
          null, // recorrente
          null, // recorrente_fim
          null, // recorrente_id
          cartao.nome_cartao, // cartao_nome
          dataLancamento.toISOString().split('T')[0], // data_lancamento
          dataContabilizacao.toISOString().split('T')[0], // data_contabilizacao
          mesFatura, // mes_fatura
          anoFatura, // ano_fatura
          cartao.dia_vencimento, // dia_vencimento
          'pendente', // status_fatura
          parsed.dataVencimento // data_vencimento
        ]);
        const dataContabilizacaoBR = dataContabilizacao.toLocaleDateString('pt-BR');
        const nomeMes = getNomeMes(mesFatura - 1);
        await sock.sendMessage(userId, {
          text: `✅ Gasto registrado no cartão ${cartao.nome_cartao}!\n\n` +
            `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
            `📅 Lançamento: ${parsed.data}\n` +
            `📂 Categoria: ${parsed.categoria}\n` +
            `💳 Pagamento: ${parsed.pagamento}\n` +
            `📝 Descrição: ${parsed.descricao}\n` +
            `Contabiliza: ${dataContabilizacaoBR} (fatura ${nomeMes}/${anoFatura})`
        });
        return;
      } catch (error) {
        console.log('[DEBUG] Erro ao registrar gasto no cartão:', error);
        await sock.sendMessage(userId, { 
          text: `❌ Erro ao registrar gasto no cartão: ${error.message}` 
        });
        return;
      }
    } else if (cartoes.length > 1) {
      console.log('[DEBUG] Múltiplos cartões configurados, solicitando escolha do usuário');
      let msgCartoes = `💳 Qual cartão você usou?\n\n`;
      cartoes.forEach((cartao, index) => {
        msgCartoes += `${index + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento})\n`;
      });
      msgCartoes += `\nDigite o número do cartão ou "cancelar"`;
      aguardandoConfiguracaoCartao[userId] = { 
        parsed: parsed, 
        cartoes,
        aguardandoEscolha: true 
      };
      await sock.sendMessage(userId, { text: msgCartoes });
      return;
    }
  }

  // --- PARSER DE LANÇAMENTO NORMAL ---
  console.log('[DEBUG] Processando lançamento normal');
  
  // Verificar se há erro de validação mas ainda temos os dados necessários
  if (parsed && parsed.error && parsed.valorExtraido) {
    // Tentar processar mesmo com erro de validação, usando o valor extraído
    const parsedComValor = {
      ...parsed,
      valor: Number(parsed.valorExtraido) || 0,
      tipo: parsed.tipo || 'gasto',
      categoria: parsed.categoria || 'Outros',
      pagamento: parsed.pagamento || 'NÃO INFORMADO',
      data: parsed.data || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      descricao: parsed.descricao || 'Lançamento'
    };
    
    // Processar o lançamento com aviso sobre o valor alto
    try {
      const tipoNormalizado = (parsedComValor.tipo || '').toLowerCase();
      
      // Verificar se é parcelamento
      if (parsedComValor.parcelamento && parsedComValor.numParcelas > 1) {
        console.log('[DEBUG] Criando parcelamento com aviso de valor alto:', parsedComValor.numParcelas, 'parcelas');
        const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsedComValor);
        
        let msgParcelamento = `⚠️ ${parsed.error}\n\n✅ Parcelamento registrado com sucesso!\n\n`;
        msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsedComValor.valor)}\n`;
        msgParcelamento += `📦 ${parsedComValor.numParcelas}x de R$ ${formatarValor(parsedComValor.valor / parsedComValor.numParcelas)}\n`;
        msgParcelamento += `📅 Primeira parcela: ${lancamentosCriados[0].data}\n`;
        msgParcelamento += `📅 Última parcela: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
        msgParcelamento += `📂 Categoria: ${parsedComValor.categoria}\n`;
        msgParcelamento += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
        msgParcelamento += `📝 Descrição: ${parsedComValor.descricao}`;
        
        await sock.sendMessage(userId, { text: msgParcelamento });
        return;
      }
      
      // Verificar se é recorrente
      if (parsedComValor.recorrente && parsedComValor.recorrenteMeses > 1) {
        console.log('[DEBUG] Criando recorrente com aviso de valor alto:', parsedComValor.recorrenteMeses, 'meses');
        const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsedComValor);
        
        let msgRecorrente = `⚠️ ${parsed.error}\n\n✅ Lançamento recorrente registrado com sucesso!\n\n`;
        msgRecorrente += `💰 Valor: R$ ${formatarValor(parsedComValor.valor)}\n`;
        msgRecorrente += `🔄 ${parsedComValor.recorrenteMeses} meses (${parsedComValor.recorrenteMeses}x)\n`;
        msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
        msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
        msgRecorrente += `📂 Categoria: ${parsedComValor.categoria}\n`;
        msgRecorrente += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
        msgRecorrente += `📝 Descrição: ${parsedComValor.descricao}`;
        
        await sock.sendMessage(userId, { text: msgRecorrente });
        return;
      }
      
      // Lançamento normal com aviso
      await appendRowToDatabase(userId, [
        parsedComValor.data.split('/').reverse().join('-'),
        tipoNormalizado,
        parsedComValor.descricao,
        parsedComValor.valor,
        parsedComValor.categoria,
        parsedComValor.pagamento,
        null, // parcelamento_id
        null, // parcela_atual
        null, // total_parcelas
        null, // recorrente
        null, // recorrente_fim
        null, // recorrente_id
        null, // cartao_nome
        null, // data_lancamento
        null, // data_contabilizacao
        null, // mes_fatura
        null, // ano_fatura
        null, // dia_vencimento
        null, // status_fatura
        parsedComValor.dataVencimento // data_vencimento
      ]);
      
      let msg = `⚠️ ${parsed.error}\n\n✅ Lançamento registrado com sucesso!\n\n`;
      msg += `📅 Data: ${parsedComValor.data}\n`;
      msg += `💰 Valor: R$ ${formatarValor(parsedComValor.valor)}\n`;
      msg += `📂 Categoria: ${parsedComValor.categoria}\n`;
      msg += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
      msg += `📝 Descrição: ${parsedComValor.descricao}`;
      
      await sock.sendMessage(userId, { text: msg });
      return;
    } catch (error) {
      await sock.sendMessage(userId, { 
        text: `❌ Erro ao registrar lançamento: ${error.message}` 
      });
      return;
    }
  }

  // --- LANÇAMENTO NORMAL SEM ERROS ---
  if (parsed && !parsed.error) {
    // --- VERIFICAÇÃO DE FALTA DE DATA DE VENCIMENTO PARA BOLETOS ---
    if (parsed.faltaDataVencimento) {
      console.log('[DEBUG] Falta data de vencimento para boleto, solicitando ao usuário');
      aguardandoDataVencimento[userId] = { parsed: parsed };
      await sock.sendMessage(userId, {
        text: `📄 *Boleto detectado*\n\n` +
          `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
          `📂 Categoria: ${parsed.categoria}\n` +
          `📝 Descrição: ${parsed.descricao}\n\n` +
          `❓ *Qual é a data de vencimento do boleto?*\n` +
          `Digite no formato dd/mm/aaaa (ex: 25/10/2025) ou "cancelar"`
      });
      return;
    }

    try {
      const tipoNormalizado = (parsed.tipo || '').toLowerCase();
      
      // Verificar se é parcelamento
      if (parsed.parcelamento && parsed.numParcelas > 1) {
        console.log('[DEBUG] Criando parcelamento normal:', parsed.numParcelas, 'parcelas');
        const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed);
        
        let msgParcelamento = `✅ Parcelamento registrado com sucesso!\n\n`;
        msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
        msgParcelamento += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
        msgParcelamento += `📅 Primeira parcela: ${lancamentosCriados[0].data}\n`;
        msgParcelamento += `📅 Última parcela: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
        msgParcelamento += `📂 Categoria: ${parsed.categoria}\n`;
        msgParcelamento += `💳 Pagamento: ${parsed.pagamento}\n`;
        msgParcelamento += `📝 Descrição: ${parsed.descricao}`;
        
        // Adicionar validações se houver
        if (parsed.validacoes && parsed.validacoes.length > 0) {
          msgParcelamento += `\n\n⚠️ *Avisos:*\n${parsed.validacoes.join('\n')}`;
        }
        
        await sock.sendMessage(userId, { text: msgParcelamento });
        return;
      }
      
      // Verificar se é recorrente
      if (parsed.recorrente && parsed.recorrenteMeses > 1) {
        console.log('[DEBUG] Criando recorrente normal:', parsed.recorrenteMeses, 'meses');
        const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed);
        
        let msgRecorrente = `✅ Lançamento recorrente registrado com sucesso!\n\n`;
        msgRecorrente += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
        msgRecorrente += `🔄 ${parsed.recorrenteMeses} meses (${parsed.recorrenteMeses}x)\n`;
        msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
        msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
        msgRecorrente += `📂 Categoria: ${parsed.categoria}\n`;
        msgRecorrente += `💳 Pagamento: ${parsed.pagamento}\n`;
        msgRecorrente += `📝 Descrição: ${parsed.descricao}`;
        
        // Adicionar validações se houver
        if (parsed.validacoes && parsed.validacoes.length > 0) {
          msgRecorrente += `\n\n⚠️ *Avisos:*\n${parsed.validacoes.join('\n')}`;
        }
        
        await sock.sendMessage(userId, { text: msgRecorrente });
        return;
      }
      
      // Lançamento normal
      await appendRowToDatabase(userId, [
        parsed.data.split('/').reverse().join('-'),
        tipoNormalizado,
        parsed.descricao,
        parsed.valor,
        parsed.categoria,
        parsed.pagamento,
        null, // parcelamento_id
        null, // parcela_atual
        null, // total_parcelas
        null, // recorrente
        null, // recorrente_fim
        null, // recorrente_id
        null, // cartao_nome
        null, // data_lancamento
        null, // data_contabilizacao
        null, // mes_fatura
        null, // ano_fatura
        null, // dia_vencimento
        null, // status_fatura
        parsed.dataVencimento // data_vencimento
      ]);
      
      let msg = `✅ Lançamento registrado com sucesso!\n\n`;
      msg += `📅 Data: ${parsed.data}\n`;
      msg += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
      msg += `📂 Categoria: ${parsed.categoria}\n`;
      msg += `💳 Pagamento: ${parsed.pagamento}\n`;
      msg += `📝 Descrição: ${parsed.descricao}`;
      
      // Adicionar validações se houver
      if (parsed.validacoes && parsed.validacoes.length > 0) {
        msg += `\n\n⚠️ *Avisos:*\n${parsed.validacoes.join('\n')}`;
      }
      
      await sock.sendMessage(userId, { text: msg });
      return;
    } catch (error) {
      await sock.sendMessage(userId, { 
        text: `❌ Erro ao registrar lançamento: ${error.message}` 
      });
      return;
    }
  }

  // Dentro do bloco de resposta padrão (mensagem não reconhecida):
  console.log('[DEBUG] Nenhum comando reconhecido, enviando resposta padrão.');
  await sock.sendMessage(userId, {
    text: '❌ Comando não reconhecido ou valor não encontrado na mensagem.\nDigite *ajuda* para ver a lista de comandos disponíveis.'
  });
  return;
}

// Controle de contexto simples em memória
let aguardandoConfirmacaoCategoria = {};
let aguardandoEdicao = {};
let aguardandoConfirmacaoValor = {};
let aguardandoExclusao = {};
let aguardandoConfirmacaoRecorrente = {};
let aguardandoConfiguracaoCartao = {};
let aguardandoDiaVencimento = {};
let aguardandoEdicaoCartao = {};
let aguardandoFormaPagamento = {};
let aguardandoDataVencimento = {};
let aguardandoPerguntaInteligente = {};

// Função utilitária para obter o nome do mês em português
function getNomeMes(mes) {
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return nomes[mes] || '';
}

async function startBot() {
  try {
    // Inicializar banco de dados
    await initializeDatabase();
    console.log('✅ Banco de dados inicializado');

    // Inicializar Gemini AI
    const geminiInicializado = initializeGemini();
    if (geminiInicializado) {
      console.log('🤖 Gemini AI inicializado com sucesso!');
    } else {
      console.log('⚠️ Gemini AI não disponível - funcionalidades inteligentes desabilitadas');
    }

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
      const textoLower = texto.toLowerCase().trim();
      const userId = msg.key.remoteJid; // Identificador único do usuário

      // LOGS DE DEBUG PARA DIAGNÓSTICO DE CONTEXTO
      console.log('[DEBUG] Mensagem recebida de userId:', userId);
      console.log('[DEBUG] aguardandoDiaVencimento:', JSON.stringify(aguardandoDiaVencimento));
      console.log('[DEBUG] aguardandoConfiguracaoCartao:', JSON.stringify(aguardandoConfiguracaoCartao));

      // --- TRATAMENTO DE RESPOSTA DE FORMA DE PAGAMENTO ---
      if (aguardandoFormaPagamento[userId]) {
        console.log('[DEBUG] Processando resposta de forma de pagamento');
        const contexto = aguardandoFormaPagamento[userId];
        
        if (textoLower === 'cancelar') {
          delete aguardandoFormaPagamento[userId];
          await sock.sendMessage(userId, { text: '❌ Operação cancelada.' });
      return;
    }

        const numeroEscolhido = parseInt(texto.trim());
        if (isNaN(numeroEscolhido) || numeroEscolhido < 1 || numeroEscolhido > formasPagamento.length) {
          await sock.sendMessage(userId, { 
            text: `❌ Opção inválida. Digite um número de 1 a ${formasPagamento.length} ou "cancelar".` 
          });
          return;
        }
        
        const formaPagamentoEscolhida = mapeamentoFormasPagamento[numeroEscolhido];
        console.log('[DEBUG] Forma de pagamento escolhida:', formaPagamentoEscolhida);
        
        // Atualizar o parsed com a forma de pagamento escolhida
        const parsedComPagamento = {
          ...contexto.parsed,
          pagamento: formaPagamentoEscolhida,
          faltaFormaPagamento: false
        };
        
        // Limpar o contexto
        delete aguardandoFormaPagamento[userId];
        
        // Verificar se agora é um boleto e se falta data de vencimento
        const pagamentoNormalizado = formaPagamentoEscolhida.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (pagamentoNormalizado.includes('boleto') && !parsedComPagamento.dataVencimento) {
          console.log('[DEBUG] Boleto selecionado sem data de vencimento, solicitando ao usuário');
          parsedComPagamento.faltaDataVencimento = true;
          aguardandoDataVencimento[userId] = { parsed: parsedComPagamento };
          await sock.sendMessage(userId, {
            text: `📄 *Boleto detectado*\n\n` +
              `💰 Valor: R$ ${formatarValor(parsedComPagamento.valor)}\n` +
              `📂 Categoria: ${parsedComPagamento.categoria}\n` +
              `📝 Descrição: ${parsedComPagamento.descricao}\n\n` +
              `❓ *Qual é a data de vencimento do boleto?*\n` +
              `Digite no formato dd/mm/aaaa (ex: 25/10/2025) ou "cancelar"`
          });
          return;
        }
        
        // Reprocessar o lançamento com a forma de pagamento
        console.log('[DEBUG] Reprocessando lançamento com forma de pagamento:', formaPagamentoEscolhida);
        
        // Continuar com o processamento normal usando parsedComPagamento
        // Vou criar uma função auxiliar para processar o lançamento
        await processarLancamento(userId, parsedComPagamento, sock);
        return;
      }

      // --- TRATAMENTO DE RESPOSTA DE DATA DE VENCIMENTO ---
      if (aguardandoDataVencimento[userId]) {
        console.log('[DEBUG] Processando resposta de data de vencimento');
        const contexto = aguardandoDataVencimento[userId];
        
        if (textoLower === 'cancelar') {
          delete aguardandoDataVencimento[userId];
          await sock.sendMessage(userId, { text: '❌ Operação cancelada.' });
          return;
        }
        
        // Validar formato da data (dd/mm/aaaa)
        const dataMatch = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (!dataMatch) {
          await sock.sendMessage(userId, { 
            text: '❌ Formato inválido. Digite a data no formato dd/mm/aaaa (ex: 25/10/2025) ou "cancelar".' 
          });
          return;
        }
        
        const dia = parseInt(dataMatch[1]);
        const mes = parseInt(dataMatch[2]);
        const ano = parseInt(dataMatch[3]);
        
        // Validar se a data é válida
        const dataVencimentoObj = new Date(ano, mes - 1, dia);
        if (isNaN(dataVencimentoObj.getTime()) || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
          await sock.sendMessage(userId, { 
            text: '❌ Data inválida. Digite uma data válida no formato dd/mm/aaaa ou "cancelar".' 
          });
          return;
        }
        
        const dataVencimento = dataVencimentoObj.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
        // Atualizar o parsed com a data de vencimento
        const parsedComVencimento = {
          ...contexto.parsed,
          dataVencimento: dataVencimento,
          faltaDataVencimento: false
        };
        
        // Limpar o contexto
        delete aguardandoDataVencimento[userId];
        
        // Reprocessar o lançamento com a data de vencimento
        console.log('[DEBUG] Reprocessando lançamento com data de vencimento:', dataVencimento);
        await processarLancamento(userId, parsedComVencimento, sock);
        return;
      }

      // --- TRATAMENTO DE COMANDOS GLOBAIS ---
      if (["ajuda", "menu", "help"].includes(textoLower)) {
        await sock.sendMessage(userId, {
          text:
            "🤖 *SIMPLOU - SEU ASSISTENTE FINANCEIRO*\n\n" +
            "📋 *COMANDOS PRINCIPAIS*\n\n" +
            "📊 *Consultas e Resumos*\n" +
            "• `resumo` - Resumo do mês atual\n" +
            "• `resumo hoje` - Resumo do dia atual\n" +
            "• `resumo [mês/ano]` - Resumo específico (ex: resumo 03/2024)\n" +
            "• `historico` - Últimos lançamentos\n" +
            "• `historico [mês/ano]` - Lançamentos do mês (ex: historico julho 2025)\n" +
            "• `fatura [cartão] [mês/ano]` - Fatura de cartão (ex: fatura nubank 08/2025)\n\n" +
            "💳 *Gestão de Cartões*\n" +
            "• `configurar cartao` - Cadastrar cartão de crédito\n" +
            "• `editar cartao` - Editar vencimento/fechamento\n" +
            "• `cartoes` - Listar cartões configurados\n\n" +
            "📝 *Gestão de Lançamentos*\n" +
            "• `editar [número]` - Editar lançamento específico\n" +
            "• `excluir [número]` - Excluir lançamento específico\n" +
            "• `cancelar` - Cancela operação em andamento\n\n" +
            "🧠 *Comandos Inteligentes (Gemini AI)*\n" +
            "• `analisar` - Análise de padrões de gastos\n" +
            "• `sugestões` - Dicas de economia personalizadas\n" +
            "• `previsão` - Previsões de gastos futuros\n" +
            "• `ajuda inteligente` - Assistente financeiro IA\n\n" +
            "🔧 *Comandos Administrativos*\n" +
            "• `status` - Status do sistema (apenas admin)\n" +
            "• `limpar` - Limpar dados antigos (apenas admin)\n" +
            "• `backup` - Gerar backup dos dados\n" +
            "• `logs` - Logs de auditoria (apenas admin)\n" +
            "• `meuid` - Descobrir ID do WhatsApp\n" +
            "• `quemsou` - Verificar permissões\n\n" +
            "📚 *Ajuda e Informações*\n" +
            "• `ajuda` / `menu` / `help` - Este menu\n" +
            "• `oi` / `olá` - Mensagem de boas-vindas\n\n" +
            "🎯 *EXEMPLOS DE LANÇAMENTOS*\n\n" +
            "📝 *Formatos Suportados*\n" +
            "• **Gasto simples**: `gastei 50 no mercado no crédito`\n" +
            "• **Receita**: `recebi 1000 salário`\n" +
            "• **Parcelado**: `gastei 1200 no notebook em 12x no crédito`\n" +
            "• **Fixo/mensal**: `gastei 100 aluguel todo mês`\n" +
            "• **Recorrente**: `gastei 50 Netflix por 6 meses`\n" +
            "• **Com data**: `gastei 50 no mercado dia 15/08/2025`\n" +
            "• **Data textual**: `gastei 50 no mercado dia 19 de outubro`\n\n" +
            "🏷️ *Categorias Automáticas*\n" +
            "Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, etc.\n\n" +
            "💳 *Formas de Pagamento*\n" +
            "PIX, CRÉDITO, DÉBITO, DINHEIRO, BOLETO\n\n" +
            "💡 *Dúvidas? Digite `ajuda` a qualquer momento!*"
        });
        return;
      }

      // --- MENSAGENS DE BOAS-VINDAS ---
      if (["oi", "olá", "ola", "hello", "hi", "ei", "opa"].includes(textoLower)) {
        await sock.sendMessage(userId, {
          text: `�� *Olá! Bem-vindo ao Simplou!*\n\n` +
                `💰 *Seu assistente financeiro pessoal*\n\n` +
                `📊 *Comandos principais:*\n` +
                `• resumo: ver resumo do mês\n` +
                `• gastei 50 no mercado: registrar gasto\n` +
                `• recebi 1000 salário: registrar receita\n` +
                `• histórico: ver últimos lançamentos\n` +
                `• ajuda: menu completo\n\n` +
                `💡 *Dica:* Digite *ajuda* para ver todos os comandos disponíveis!`
        });
        return;
      }
      if (["cartoes", "cartões"].includes(textoLower)) {
        const cartoes = await listarCartoesConfigurados(userId);
        if (!cartoes || cartoes.length === 0) {
          await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado.\n\nUse "configurar cartao" para cadastrar seu primeiro cartão.' });
          return;
        }
        let msgCartoes = '💳 *Cartões configurados:*\n\n';
        cartoes.forEach((cartao, idx) => {
          msgCartoes += `${idx + 1}. *${cartao.nome_cartao}*\n`;
          msgCartoes += `   📅 Vencimento: dia ${cartao.dia_vencimento}\n`;
          msgCartoes += `   📋 Fechamento: dia ${cartao.dia_fechamento || 'NÃO INFORMADO'}\n\n`;
        });
        msgCartoes += '💡 Use "editar cartao" para modificar vencimento ou fechamento.';
        await sock.sendMessage(userId, { text: msgCartoes });
        return;
      }
      if (textoLower.startsWith("resumo")) {
        let mesAno = textoLower.replace("resumo", "").trim();
        let resumo;
        
        // Verificar se é resumo do dia
        if (mesAno === "hoje" || mesAno === "dia" || mesAno === "diario" || mesAno === "diário") {
          resumo = await getResumoDoDia(userId);
          const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          await sock.sendMessage(userId, {
            text: `📊 *Resumo de hoje (${hoje})*\nReceitas: R$ ${formatarValor(resumo.totalReceitas)}\nDespesas: R$ ${formatarValor(resumo.totalDespesas)}\nSaldo: R$ ${formatarValor(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
          });
        } else if (!mesAno) {
          // Resumo do mês atual (comportamento padrão)
          resumo = await getResumoDoMesAtual(userId);
          await sock.sendMessage(userId, {
            text: `📊 *Resumo do mês atual*\nReceitas: R$ ${formatarValor(resumo.totalReceitas)}\nDespesas: R$ ${formatarValor(resumo.totalDespesas)}\nSaldo: R$ ${formatarValor(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
          });
        } else {
          // Resumo de mês/ano específico
          const parsed = parseMesAno(mesAno);
          if (!parsed) {
            await sock.sendMessage(userId, { text: '❌ Formato inválido. Use:\n• resumo (mês atual)\n• resumo hoje (dia atual)\n• resumo 03/2024 (mês específico)' });
            return;
          }
          resumo = await getResumoPorMes(userId, parsed.mes, parsed.ano);
          await sock.sendMessage(userId, {
            text: `📊 *Resumo de ${getNomeMes(parsed.mes - 1)}/${parsed.ano}*\nReceitas: R$ ${formatarValor(resumo.totalReceitas)}\nDespesas: R$ ${formatarValor(resumo.totalDespesas)}\nSaldo: R$ ${formatarValor(resumo.saldo)}\nLançamentos: ${resumo.totalLancamentos}`
          });
        }
        return;
      }
      // --- HISTÓRICO COM OU SEM PERÍODO ---
      if (/^(historico|histórico|ultimos|últimos)(\s|$)/i.test(textoLower)) {
        // Extrai o possível período após o comando
        const partes = texto.trim().split(/\s+/);
        let mesAno = null;
        let limite = 10; // Aumentado de 5 para 10 para mostrar mais lançamentos
        if (partes.length > 1) {
          const resto = partes.slice(1).join(' ');
          mesAno = parseMesAno(resto);
          if (mesAno) limite = 20;
        }
        let ultimos;
        if (mesAno) {
          ultimos = await listarLancamentos(userId, limite, mesAno.mes, mesAno.ano);
          if (!ultimos || ultimos.length === 0) {
            await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}.` });
            return;
          }
        } else {
          ultimos = await listarLancamentos(userId, limite);
          if (!ultimos || ultimos.length === 0) {
            await sock.sendMessage(userId, { text: 'Nenhum lançamento encontrado.' });
            return;
          }
        }
        let msgHist = mesAno 
          ? `📋 *Histórico ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}:*\n`
          : '📋 *Últimos lançamentos:*\n';
        ultimos.forEach((l, idx) => {
          const dataBR = (l.data instanceof Date)
            ? l.data.toLocaleDateString('pt-BR')
            : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
                ? new Date(l.data).toLocaleDateString('pt-BR')
                : l.data);
          msgHist += `${idx + 1}. ️${dataBR} | 💰 R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
          if (l.tipoAgrupamento === 'parcelado') {
            msgHist += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo[0].valor)}`;
          }
          if (l.tipoAgrupamento === 'recorrente') {
            msgHist += ` | 🔁 Recorrente: ${l.grupo.length}x`;
          }
          if (l.descricao) msgHist += ` | 📝 ${l.descricao}`;
          msgHist += '\n';
        });
        aguardandoEdicao[userId] = { lista: ultimos, etapa: null };
        
        // Adiciona dica sobre histórico por período
        let msgFinal = msgHist + '\nPara editar, envie: Editar <número>';
        if (!mesAno) {
          msgFinal += '\n\n💡 *Dica:* Para ver todos os lançamentos de um mês específico, envie:\n"Histórico [mês] [ano]" (ex: "Histórico julho 2025")';
        }
        
        await sock.sendMessage(userId, { text: msgFinal });
        return;
      }

      // --- FLUXO DE EDIÇÃO DE LANÇAMENTO INDIVIDUAL ---
      if (/^editar\s+(\d+)$/i.test(texto.trim())) {
        const match = texto.trim().match(/^editar\s+(\d+)$/i);
        const idx = parseInt(match[1], 10) - 1;
        const contexto = aguardandoEdicao[userId];
        const lista = contexto && contexto.lista ? contexto.lista : null;
        if (!lista || !lista[idx]) {
          await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
          return;
        }
        const l = lista[idx];
        // Bloquear edição de parcelados
        if (l.tipoAgrupamento === 'parcelado') {
          await sock.sendMessage(userId, { text: '❌ Não é permitido editar um lançamento parcelado.\nSe precisar alterar, exclua o parcelamento inteiro e refaça o lançamento.' });
          return;
        }
        aguardandoEdicao[userId] = { lista, idx, lancamento: l, etapa: 'campo' };
        let msg = `📝 *Editar lançamento ${idx + 1}:*\n`;
        
        // Formatar a data corretamente
        let dataFormatada;
        if (l.data instanceof Date) {
          dataFormatada = l.data.toLocaleDateString('pt-BR');
        } else if (typeof l.data === 'string') {
          // Se já for string, verificar se está no formato YYYY-MM-DD e converter
          if (/^\d{4}-\d{2}-\d{2}$/.test(l.data)) {
            const [ano, mes, dia] = l.data.split('-');
            dataFormatada = `${dia}/${mes}/${ano}`;
          } else {
            dataFormatada = l.data;
          }
        } else {
          dataFormatada = 'Data inválida';
        }
        
        msg += `Data: ${dataFormatada}\nValor: R$ ${formatarValor(l.valor)}\nCategoria: ${l.categoria}\nPagamento: ${l.pagamento}\nDescrição: ${l.descricao || '-'}\n`;
        msg += '\nQual campo deseja editar?\n1. data\n2. valor\n3. categoria\n4. pagamento\n5. descricao\n6. cancelar';
        await sock.sendMessage(userId, { text: msg });
        return;
      }

      // --- FLUXO DE EXCLUSÃO DE LANÇAMENTO INDIVIDUAL ---
      if (/^excluir\s+(\d+)$/i.test(texto.trim())) {
        const match = texto.trim().match(/^excluir\s+(\d+)$/i);
        const idx = parseInt(match[1], 10) - 1;
        const contexto = aguardandoEdicao[userId];
        const lista = contexto && contexto.lista ? contexto.lista : null;
        if (!lista || !lista[idx]) {
          await sock.sendMessage(userId, { text: '❌ Índice inválido. Envie "histórico" para listar novamente.' });
          return;
        }
        const l = lista[idx];
        // Excluir parcelado: remove todas as parcelas
        if (l.tipoAgrupamento === 'parcelado' && l.parcelamento_id) {
          await excluirParcelamentoPorId(userId, l.parcelamento_id);
          await sock.sendMessage(userId, { text: '✅ Parcelamento excluído com sucesso! Todas as parcelas foram removidas.' });
          delete aguardandoEdicao[userId];
          return;
        }
        // Excluir recorrente: remove todas as recorrências futuras
        if (l.tipoAgrupamento === 'recorrente' && l.recorrente_id) {
          await excluirRecorrentePorId(userId, l.recorrente_id);
          await sock.sendMessage(userId, { text: '✅ Lançamento recorrente excluído com sucesso! Todas as recorrências futuras foram removidas.' });
          delete aguardandoEdicao[userId];
          return;
        }
        // Exclusão simples
        await excluirLancamentoPorId(userId, l.id);
        await sock.sendMessage(userId, { text: '✅ Lançamento excluído com sucesso!' });
        delete aguardandoEdicao[userId];
        return;
      }

      // --- COMANDOS ADMINISTRATIVOS ---
      
      // Comando para verificar status do sistema (apenas admin)
      if (textoLower === 'status') {
        if (!ADMIN_USERS.includes(userId)) {
          await sock.sendMessage(userId, { text: '❌ Acesso negado. Apenas administradores podem usar este comando.' });
          return;
        }
        
        try {
          const { pool, registrarLog } = require('./databaseService');
          const result = await pool.query('SELECT COUNT(*) as total FROM lancamentos');
          const totalLancamentos = result.rows[0].total;
          
          const stats = await listUsers();
          const msg = `📊 *Status do Sistema*\n\n` +
                     `👥 Usuários: ${stats.total}/${stats.max}\n` +
                     `📋 Total de lançamentos: ${totalLancamentos}\n` +
                     `🤖 Versão: ${SYSTEM_CONFIG.VERSION}\n` +
                     `⏰ Última verificação: ${new Date().toLocaleString('pt-BR')}`;
          
          await sock.sendMessage(userId, { text: msg });
          
          // Registrar log de auditoria
          await registrarLog(userId, 'COMANDO_ADMIN', 'Status do sistema consultado');
        } catch (error) {
          console.error('[STATUS] Erro:', error);
          await sock.sendMessage(userId, { text: '❌ Erro ao verificar status do sistema.' });
        }
        return;
      }

      // Comando para limpar dados antigos (apenas admin)
      if (textoLower === 'limpar') {
        if (!ADMIN_USERS.includes(userId)) {
          await sock.sendMessage(userId, { text: '❌ Acesso negado. Apenas administradores podem usar este comando.' });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '🧹 *Iniciando limpeza de dados antigos...*\n\n⏳ Isso pode levar alguns segundos...' 
        });
        
        try {
          const { limparDadosAntigos, registrarLog } = require('./databaseService');
          const resultado = await limparDadosAntigos();
          
          const msg = `✅ *Limpeza concluída!*\n\n` +
                     `🗑️ Lançamentos removidos: ${resultado.lancamentosRemovidos}\n` +
                     `💳 Cartões removidos: ${resultado.cartoesRemovidos}\n` +
                     `📅 Dados mais antigos que ${SYSTEM_CONFIG.CLEANUP_RETENTION_DAYS} dias foram removidos\n` +
                     `💾 Backup automático gerado antes da limpeza`;
          
          await sock.sendMessage(userId, { text: msg });
          
          // Registrar log de auditoria
          await registrarLog(userId, 'COMANDO_ADMIN', `Limpeza executada: ${resultado.lancamentosRemovidos} lançamentos removidos`);
        } catch (error) {
          console.error('[LIMPAR] Erro:', error);
          await sock.sendMessage(userId, { text: '❌ Erro ao limpar dados antigos.' });
        }
        return;
      }

      // Comando para gerar backup (todos os usuários autorizados)
      if (textoLower === 'backup') {
        if (!AUTHORIZED_USERS.includes(userId)) {
          await sock.sendMessage(userId, { text: '❌ Acesso negado. Apenas usuários autorizados podem usar este comando.' });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '💾 *Gerando backup dos seus dados...*\n\n⏳ Isso pode levar alguns segundos...' 
        });
        
        try {
          const { gerarBackupCSV, registrarLog } = require('./databaseService');
          const csvData = await gerarBackupCSV(userId);
          // Se csvData for objeto, pegar o campo csvContent
          const csvString = typeof csvData === 'string' ? csvData : (csvData && (csvData.csv || csvData.csvContent) ? (csvData.csv || csvData.csvContent) : '');
          if (!csvString) throw new Error('Backup vazio ou erro ao gerar CSV.');
          // Enviar arquivo CSV como anexo
          const buffer = Buffer.from(csvString, 'utf-8');
          const fileName = `backup_simplou_${userId.split('@')[0]}_${new Date().toISOString().split('T')[0]}.csv`;
          
          await sock.sendMessage(userId, {
            document: buffer,
            fileName: fileName,
            mimetype: 'text/csv',
            caption: `✅ *Backup gerado com sucesso!*\n\n📁 Arquivo: ${fileName}\n📊 Seus dados foram exportados em formato CSV\n💡 Guarde este arquivo em local seguro`
          });
          
          // Registrar log de auditoria
          await registrarLog(userId, 'COMANDO_BACKUP', `Backup gerado: ${fileName}`);
        } catch (error) {
          console.error('[BACKUP] Erro:', error);
          await sock.sendMessage(userId, { text: '❌ Erro ao gerar backup.' });
        }
        return;
      }

      // Comando para logs (admin, aceita maiúsculas/minúsculas)
      if (textoLower === 'logs') {
        if (!ADMIN_USERS.includes(userId)) {
          await sock.sendMessage(userId, { text: '❌ Acesso negado. Apenas administradores podem usar este comando.' });
          return;
        }
        try {
          const { gerarLogAuditoria, registrarLog } = require('./databaseService');
          const logData = await gerarLogAuditoria();
          const logString = typeof logData === 'string' ? logData : (logData && logData.csv ? logData.csv : '');
          if (!logString) throw new Error('Log vazio ou erro ao gerar CSV.');
          const buffer = Buffer.from(logString, 'utf-8');
          const fileName = `logs_simplou_${new Date().toISOString().split('T')[0]}.csv`;
          await sock.sendMessage(userId, {
            document: buffer,
            fileName: fileName,
            mimetype: 'text/csv',
            caption: `✅ *Logs de auditoria gerados com sucesso!*\n\n📁 Arquivo: ${fileName}`
          });
          
          // Registrar log de auditoria
          await registrarLog(userId, 'COMANDO_ADMIN', `Logs de auditoria gerados: ${fileName}`);
        } catch (error) {
          console.error('[LOGS] Erro:', error);
          await sock.sendMessage(userId, { text: '❌ Erro ao gerar logs de auditoria.' });
        }
        return;
      }

      // Comando para descobrir ID do WhatsApp
      if (textoLower === 'meuid') {
        const msg = `🆔 *Seu ID do WhatsApp:*\n\n` +
                   `📱 ${userId}\n\n` +
                   `💡 *Como usar:*\n` +
                   `1. Copie este ID\n` +
                   `2. Adicione no arquivo config.js\n` +
                   `3. Reinicie o bot\n\n` +
                   `⚠️ *Importante:* Mantenha este ID seguro!`;
        
        await sock.sendMessage(userId, { text: msg });
        return;
      }

      // Comando para verificar quem sou eu
      if (textoLower === 'quemsou') {
        const isAdmin = ADMIN_USERS.includes(userId);
        const isAuthorized = AUTHORIZED_USERS.includes(userId);
        
        let msg = `👤 *Informações do seu usuário:*\n\n`;
        msg += `📱 ID: ${userId}\n`;
        msg += `🔐 Status: `;
        
        if (isAdmin) {
          msg += `👑 *Administrador*\n`;
          msg += `✅ Acesso total ao sistema\n`;
          msg += `🔧 Comandos admin disponíveis: status, limpar\n`;
        } else if (isAuthorized) {
          msg += `✅ *Usuário autorizado*\n`;
          msg += `✅ Acesso normal ao sistema\n`;
        } else {
          msg += `❌ *Não autorizado*\n`;
          msg += `❌ Sem acesso ao sistema\n`;
          msg += `💡 Peça ao administrador para adicionar seu ID`;
        }
        
        msg += `\n📊 Comandos disponíveis: ajuda`;
        
        await sock.sendMessage(userId, { text: msg });
        return;
      }

      // --- FLUXO DE ESCOLHA DO CAMPO (NUMERADO) ---
      if (aguardandoEdicao[userId] && aguardandoEdicao[userId].etapa === 'campo') {
        const op = texto.trim();
        const campos = ['data', 'valor', 'categoria', 'pagamento', 'descricao'];
        let campoEscolhido = null;
        
        // Verificar se é cancelar (opção 6 ou texto "cancelar")
        if (op === '6' || op.toLowerCase() === 'cancelar') {
          delete aguardandoEdicao[userId];
          await sock.sendMessage(userId, { text: '❌ Edição de lançamento cancelada.' });
          return;
        }
        
        if (/^[1-5]$/.test(op)) {
          campoEscolhido = campos[parseInt(op, 10) - 1];
        } else if (campos.includes(op.toLowerCase()) || op.toLowerCase() === 'descrição') {
          campoEscolhido = op.toLowerCase().replace('ç','c');
        }
        if (!campoEscolhido) {
          await sock.sendMessage(userId, { text: '❌ Opção inválida. Responda com o número do campo (1-5), o nome do campo, ou "6" para cancelar.' });
          return;
        }
        // Bloquear edição de valor de parcelado (por segurança extra)
        if (aguardandoEdicao[userId].lancamento.tipoAgrupamento === 'parcelado') {
          await sock.sendMessage(userId, { text: '❌ Não é permitido editar um lançamento parcelado.\nSe precisar alterar, exclua o parcelamento inteiro e refaça o lançamento.' });
          delete aguardandoEdicao[userId];
          return;
        }
        aguardandoEdicao[userId].campo = campoEscolhido;
        aguardandoEdicao[userId].etapa = 'valor';
        await sock.sendMessage(userId, { text: `Digite o novo valor para o campo *${campoEscolhido}*:` });
        return;
      }
      
      // --- FLUXO DE EDIÇÃO DE VALOR DO CAMPO ---
      if (aguardandoEdicao[userId] && aguardandoEdicao[userId].etapa === 'valor') {
        const { lista, idx, lancamento, campo } = aguardandoEdicao[userId];
        let novoValor = texto.trim();
        let atualizacao = {};
        if (campo === 'valor') {
          novoValor = novoValor.replace(',', '.');
          if (isNaN(parseFloat(novoValor))) {
            await sock.sendMessage(userId, { text: '❌ Valor inválido.' });
            return;
          }
          atualizacao.valor = parseFloat(novoValor);
          // Se for recorrente, atualizar todas as recorrências futuras
          if (lancamento.tipoAgrupamento === 'recorrente' && lancamento.recorrente_id) {
            // Corrigir: usar data atual como referência para atualizar apenas lançamentos futuros
            const dataAtual = new Date().toISOString().split('T')[0];
            const query = `UPDATE lancamentos SET valor = $1 WHERE user_id = $2 AND recorrente_id = $3 AND data >= $4`;
            await require('./databaseService').pool.query(query, [atualizacao.valor, userId, lancamento.recorrente_id, dataAtual]);
            await sock.sendMessage(userId, { text: '✅ Valor atualizado para todas as recorrências futuras!' });
            delete aguardandoEdicao[userId];
            return;
          }
        } else if (campo === 'data') {
          // Aceita formatos dd/mm/aaaa ou dd/mm
          const matchData = novoValor.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
          if (!matchData) {
            await sock.sendMessage(userId, { text: '❌ Data inválida. Use formato dd/mm ou dd/mm/aaaa.' });
            return;
          }
          let dia = parseInt(matchData[1]);
          let mes = parseInt(matchData[2]) - 1;
          let ano = matchData[3] ? parseInt(matchData[3]) : (new Date()).getFullYear();
          if (ano < 100) ano += 2000;
          const dataObj = new Date(ano, mes, dia);
          if (isNaN(dataObj.getTime())) {
            await sock.sendMessage(userId, { text: '❌ Data inválida.' });
            return;
          }
          atualizacao.data = dataObj.toLocaleDateString('pt-BR');
        } else if (campo === 'categoria') {
          atualizacao.categoria = novoValor;
        } else if (campo === 'pagamento') {
          atualizacao.pagamento = novoValor;
        } else if (campo === 'descricao' || campo === 'descrição') {
          atualizacao.descricao = novoValor;
        }
        // Atualiza no banco (apenas para simples ou recorrente já tratado acima)
        if (!(lancamento.tipoAgrupamento === 'recorrente' && campo === 'valor')) {
          await atualizarLancamentoPorId(userId, lancamento.id, atualizacao);
          await sock.sendMessage(userId, { text: '✅ Lançamento atualizado com sucesso!' });
        }
        delete aguardandoEdicao[userId];
        return;
      }

      // --- TRATAMENTO DE FATURA DE CARTÃO ---
      if (textoLower.startsWith('fatura ')) {
        // Extrai nome do cartão e mês/ano
        const partes = textoLower.split(' ');
        if (partes.length < 3) {
          await sock.sendMessage(userId, { text: '❌ Use: fatura [cartão] [mês/ano]. Exemplo: fatura nubank 07/2025' });
          return;
        }
        const nomeCartao = partes[1];
        const mesAno = partes.slice(2).join(' ');
        const parsed = parseMesAno(mesAno);
        if (!parsed) {
          await sock.sendMessage(userId, { text: '❌ Mês/ano inválido. Exemplo: fatura nubank 07/2025' });
          return;
        }
        const { mes, ano } = parsed;
        console.log('[FATURA DEBUG] mes:', mes, 'ano:', ano, 'nomeMes:', getNomeMes(mes-1));
        const fatura = await buscarFaturaCartao(userId, nomeCartao, mes, ano);
        console.log('[FATURA DEBUG] fatura retornada:', fatura);
        const nomeMesFatura = getNomeMes(mes - 1);
        if (!fatura || fatura.length === 0) {
          await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para o cartão ${nomeCartao} em ${nomeMesFatura}/${ano}.` });
          return;
        }
        let total = 0;
        let msgFatura = `💳 *Fatura ${nomeCartao} ${nomeMesFatura}/${ano}*\n`;
        fatura.forEach(l => {
          const dataBR = (l.data_lancamento instanceof Date)
            ? l.data_lancamento.toLocaleDateString('pt-BR')
            : (typeof l.data_lancamento === 'string' && l.data_lancamento.match(/\d{4}-\d{2}-\d{2}/)
                ? new Date(l.data_lancamento).toLocaleDateString('pt-BR')
                : l.data_lancamento);
          msgFatura += `• ${dataBR} - ${l.descricao} - R$ ${formatarValor(l.valor)}\n`;
          total += parseFloat(l.valor);
        });
        msgFatura += `\nTotal: R$ ${formatarValor(total)}`;
        await sock.sendMessage(userId, { text: msgFatura });
        return;
      }

      // --- TRATAMENTO DE COMANDO CONFIGURAR CARTÃO ---
      const textoNormalizadoConfigurar  = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      console.log('[DEBUG] texto original:', texto);
      console.log('[DEBUG] texto normalizado:', textoNormalizadoConfigurar);
      
      // Aceitar variações: "configurar cartao", "configurar cartão", "cadastrar cartao", "cadastrar cartão", etc.
      if (/^(configurar|cadastrar)\s+cart[aã]o$/.test(textoNormalizadoConfigurar) || /^(configurar|cadastrar)\s+cart[aã]o$/.test(textoLower)) {
        console.log('[DEBUG] Comando CONFIGURAR/CADASTRAR CARTAO reconhecido!');
        aguardandoConfiguracaoCartao[userId] = {};
        await sock.sendMessage(userId, { text: '💳 Qual o nome do cartão? (Exemplo: Nubank, Itaú, Inter)\n\nDigite "cancelar" para abortar.' });
        return;
      } else {
        if (textoNormalizadoConfigurar.includes('configurar') || textoNormalizadoConfigurar.includes('cadastrar')) {
          console.log('[DEBUG] Comando configurar/cadastrar detectado mas não bateu regex:', textoNormalizadoConfigurar);
        }
      }

      // --- FLUXO DE ESCOLHA DE CARTÃO PARA LANÇAMENTO (PRIORITÁRIO) ---
      if (aguardandoConfiguracaoCartao[userId] && aguardandoConfiguracaoCartao[userId].aguardandoEscolha) {
        const { parsed, cartoes } = aguardandoConfiguracaoCartao[userId];
        
        // Garantir que o valor seja sempre um número válido
        const valorParaUsar = parsed.valor || parsed.valorExtraido;
        const parsedComValor = {
          ...parsed,
          valor: Number(valorParaUsar) || 0
        };
        
        const escolha = textoLower.trim();
        if (escolha === 'cancelar') {
          delete aguardandoConfiguracaoCartao[userId];
          await sock.sendMessage(userId, { text: '❌ Lançamento cancelado.' });
          return;
        }
        const idx = parseInt(escolha);
        if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
          await sock.sendMessage(userId, { text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".` });
          return;
        }
        const cartaoEscolhido = cartoes[idx - 1];
        const dataLancamento = new Date();
        const dataContabilizacaoInfo = calcularDataContabilizacao(dataLancamento, cartaoEscolhido.dia_vencimento, cartaoEscolhido.dia_fechamento);
        const dataContabilizacao = dataContabilizacaoInfo.dataContabilizacao;
        const mesFatura = dataContabilizacaoInfo.mesFatura;
        const anoFatura = dataContabilizacaoInfo.anoFatura;
        try {
          // Verificar se é parcelamento
          if (parsedComValor.parcelamento && parsedComValor.numParcelas > 1) {
            console.log('[DEBUG] Criando parcelamento no cartão escolhido:', parsedComValor.numParcelas, 'parcelas');
            const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsedComValor, cartaoEscolhido);
            
            let msgParcelamento = `✅ Parcelamento registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n`;
            msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsedComValor.valor)}\n`;
            msgParcelamento += `📦 ${parsedComValor.numParcelas}x de R$ ${formatarValor(parsedComValor.valor / parsedComValor.numParcelas)}\n`;
            msgParcelamento += `📅 Primeira parcela: ${lancamentosCriados[0].data}\n`;
            msgParcelamento += `📅 Última parcela: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
            msgParcelamento += `📂 Categoria: ${parsedComValor.categoria}\n`;
            msgParcelamento += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
            msgParcelamento += `📝 Descrição: ${parsedComValor.descricao}\n`;
            msgParcelamento += `Contabiliza: ${dataContabilizacao.toLocaleDateString('pt-BR')} (fatura ${getNomeMes(mesFatura - 1)}/${anoFatura})`;
            
            await sock.sendMessage(userId, { text: msgParcelamento });
            delete aguardandoConfiguracaoCartao[userId];
            return;
          }
          
          // Verificar se é recorrente
          if (parsedComValor.recorrente && parsedComValor.recorrenteMeses > 1) {
            console.log('[DEBUG] Criando recorrente no cartão escolhido:', parsedComValor.recorrenteMeses, 'meses');
            const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsedComValor, cartaoEscolhido);
            
            let msgRecorrente = `✅ Lançamento recorrente registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n`;
            msgRecorrente += `💰 Valor: R$ ${formatarValor(parsedComValor.valor)}\n`;
            msgRecorrente += `🔄 ${parsedComValor.recorrenteMeses} meses (${parsedComValor.recorrenteMeses}x)\n`;
            msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
            msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
            msgRecorrente += `📂 Categoria: ${parsedComValor.categoria}\n`;
            msgRecorrente += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
            msgRecorrente += `📝 Descrição: ${parsedComValor.descricao}\n`;
            msgRecorrente += `Contabiliza: ${dataContabilizacao.toLocaleDateString('pt-BR')} (fatura ${getNomeMes(mesFatura - 1)}/${anoFatura})`;
            
            await sock.sendMessage(userId, { text: msgRecorrente });
            delete aguardandoConfiguracaoCartao[userId];
            return;
          }

          // Gasto normal no cartão escolhido (não parcelado, não recorrente)
          console.log('[DEBUG] Criando gasto normal no cartão escolhido');
          await appendRowToDatabase(userId, [
            parsedComValor.data.split('/').reverse().join('-'),
            parsedComValor.tipo.toLowerCase(),
            parsedComValor.descricao,
            parsedComValor.valor,
            parsedComValor.categoria,
            parsedComValor.pagamento,
            null, // parcelamento_id
            null, // parcela_atual
            null, // total_parcelas
            null, // recorrente
            null, // recorrente_fim
            null, // recorrente_id
            cartaoEscolhido.nome_cartao, // cartao_nome
            dataLancamento.toISOString().split('T')[0], // data_lancamento
            dataContabilizacao.toISOString().split('T')[0], // data_contabilizacao
            mesFatura, // mes_fatura
            anoFatura, // ano_fatura
            cartaoEscolhido.dia_vencimento, // dia_vencimento
            'pendente', // status_fatura
            parsed.dataVencimento // data_vencimento
          ]);
          const dataContabilizacaoBR = dataContabilizacao.toLocaleDateString('pt-BR');
          const nomeMes = getNomeMes(mesFatura - 1);
          await sock.sendMessage(userId, {
            text: `✅ Gasto registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n` +
              `💰 Valor: R$ ${formatarValor(parsedComValor.valor)}\n` +
              `📅 Lançamento: ${parsedComValor.data}\n` +
              `📂 Categoria: ${parsedComValor.categoria}\n` +
              `💳 Pagamento: ${parsedComValor.pagamento}\n` +
              `📝 Descrição: ${parsedComValor.descricao}\n` +
              `Contabiliza: ${dataContabilizacaoBR} (fatura ${nomeMes}/${anoFatura})`
          });
          delete aguardandoConfiguracaoCartao[userId];
          return;
        } catch (error) {
          await sock.sendMessage(userId, { text: `❌ Erro ao registrar gasto no cartão: ${error.message}` });
          delete aguardandoConfiguracaoCartao[userId];
          return;
        }
      }

      // --- FLUXO DE DIA DE VENCIMENTO DO CARTÃO (PRIORITÁRIO) ---
      if (aguardandoDiaVencimento[userId]) {
        const diaInput = textoLower.trim();
        if (diaInput === 'cancelar') {
          delete aguardandoConfiguracaoCartao[userId];
          delete aguardandoDiaVencimento[userId];
          await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
          return;
        }
        const dia = parseInt(diaInput);
        if (isNaN(dia) || dia < 1 || dia > 31) {
          await sock.sendMessage(userId, { 
            text: '❌ Dia inválido. Digite um número entre 1 e 31 ou "cancelar".' 
          });
          return;
        }
        aguardandoConfiguracaoCartao[userId].diaVencimento = dia;
        aguardandoConfiguracaoCartao[userId].aguardandoFechamento = true;
        delete aguardandoDiaVencimento[userId];
        await sock.sendMessage(userId, { 
          text: `📅 Qual dia de fechamento da fatura do ${aguardandoConfiguracaoCartao[userId].nomeCartao}? (1-31)\nExemplo: 7\nSe não souber, digite "padrão" para usar 7 dias antes do vencimento.` 
        });
        return;
      }

      // Fluxo aguardando fechamento
      if (aguardandoConfiguracaoCartao[userId] && aguardandoConfiguracaoCartao[userId].aguardandoFechamento) {
        const fechamentoInput = textoLower.trim();
        if (fechamentoInput === 'cancelar') {
          delete aguardandoConfiguracaoCartao[userId];
          await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
          return;
        }
        let diaFechamento;
        if (fechamentoInput === 'padrao' || fechamentoInput === 'padrão') {
          diaFechamento = aguardandoConfiguracaoCartao[userId].diaVencimento - 7;
          if (diaFechamento < 1) diaFechamento = 1;
        } else {
          diaFechamento = parseInt(fechamentoInput);
          if (isNaN(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) {
            await sock.sendMessage(userId, { text: '❌ Dia de fechamento inválido. Digite um número entre 1 e 31, ou "padrão".' });
            return;
          }
        }
        const { nomeCartao, diaVencimento } = aguardandoConfiguracaoCartao[userId];
        await salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento);
        await sock.sendMessage(userId, { 
          text: `✅ Cartão ${nomeCartao} configurado com sucesso!\n\n💳 Vencimento: dia ${diaVencimento} de cada mês\n📅 Fechamento: dia ${diaFechamento} de cada mês` 
        });
        delete aguardandoConfiguracaoCartao[userId];
        return;
      }

      // --- FLUXO DE NOME DO CARTÃO (SEGUNDO MAIS PRIORITÁRIO) ---
      if (aguardandoConfiguracaoCartao[userId] && !aguardandoDiaVencimento[userId] && !aguardandoConfiguracaoCartao[userId].aguardandoFechamento) {
        const nomeCartao = textoLower.trim();
        if (nomeCartao === 'cancelar') {
          delete aguardandoConfiguracaoCartao[userId];
          await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
          return;
        }
        if (nomeCartao.length < 2 || nomeCartao.length > 20) {
          await sock.sendMessage(userId, { 
            text: '❌ Nome do cartão inválido. Digite um nome entre 2 e 20 caracteres ou "cancelar".' 
          });
          return;
        }
        aguardandoConfiguracaoCartao[userId] = { nomeCartao };
        aguardandoDiaVencimento[userId] = { nomeCartao };
        await sock.sendMessage(userId, { 
          text: `💳 Qual dia vence a fatura do ${nomeCartao}? (1-31)\n\nExemplo: 15` 
        });
        return;
      }

      // Após o usuário informar o vencimento, pedir o fechamento
      if (aguardandoDiaVencimento[userId]) {
        const diaInput = textoLower.trim();
        if (diaInput === 'cancelar') {
          delete aguardandoConfiguracaoCartao[userId];
          delete aguardandoDiaVencimento[userId];
          await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
          return;
        }
        const dia = parseInt(diaInput);
        if (isNaN(dia) || dia < 1 || dia > 31) {
          await sock.sendMessage(userId, { 
            text: '❌ Dia inválido. Digite um número entre 1 e 31 ou "cancelar".' 
          });
          return;
        }
        aguardandoConfiguracaoCartao[userId].diaVencimento = dia;
        aguardandoConfiguracaoCartao[userId].aguardandoFechamento = true;
        delete aguardandoDiaVencimento[userId];
        await sock.sendMessage(userId, { 
          text: `📅 Qual dia de fechamento da fatura do ${aguardandoConfiguracaoCartao[userId].nomeCartao}? (1-31)\n\nExemplo: 7\nSe não souber, digite "padrão" para usar 7 dias antes do vencimento.` 
        });
        return;
      }

      // Fluxo aguardando fechamento
      if (aguardandoConfiguracaoCartao[userId] && aguardandoConfiguracaoCartao[userId].aguardandoFechamento) {
        const fechamentoInput = textoLower.trim();
        if (fechamentoInput === 'cancelar') {
          delete aguardandoConfiguracaoCartao[userId];
          await sock.sendMessage(userId, { text: '❌ Configuração de cartão cancelada.' });
          return;
        }
        let diaFechamento;
        if (fechamentoInput === 'padrao' || fechamentoInput === 'padrão') {
          diaFechamento = aguardandoConfiguracaoCartao[userId].diaVencimento - 7;
          if (diaFechamento < 1) diaFechamento = 1;
        } else {
          diaFechamento = parseInt(fechamentoInput);
          if (isNaN(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) {
            await sock.sendMessage(userId, { text: '❌ Dia de fechamento inválido. Digite um número entre 1 e 31, ou "padrão".' });
            return;
          }
        }
        const { nomeCartao, diaVencimento } = aguardandoConfiguracaoCartao[userId];
        await salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento);
        await sock.sendMessage(userId, { 
          text: `✅ Cartão ${nomeCartao} configurado com sucesso!\n\n💳 Vencimento: dia ${diaVencimento} de cada mês\n📅 Fechamento: dia ${diaFechamento} de cada mês` 
        });
        delete aguardandoConfiguracaoCartao[userId];
        return;
      }

      // Após blocos de contexto (aguardandoDiaVencimento e aguardandoConfiguracaoCartao):
      
      // --- COMANDOS INTELIGENTES COM GEMINI (DEVE VIR ANTES DO PARSER) ---
      
      // Comando para análise de padrões de gastos
      if (["analisar", "analise", "análise", "padroes", "padrões"].includes(textoLower)) {
        if (!isGeminiAvailable()) {
          await sock.sendMessage(userId, { 
            text: '❌ Funcionalidade de análise inteligente não está disponível.\n\nConfigure a API key do Gemini para usar esta funcionalidade.' 
          });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '🤖 *Analisando seus padrões de gastos...*\n\n⏳ Isso pode levar alguns segundos...' 
        });
        
        try {
          // Buscar dados dos últimos 3 meses
          const hoje = new Date();
          const dados = [];
          
          for (let i = 0; i < 3; i++) {
            const mes = hoje.getMonth() - i;
            const ano = hoje.getFullYear();
            const resumo = await getResumoPorMes(userId, mes + 1, ano);
            const gastosPorCategoria = await getGastosPorCategoria(userId, mes + 1, ano);
            
            dados.push({
              mes: getNomeMes(mes),
              ano: ano,
              totalGastos: resumo.totalDespesas,
              totalReceitas: resumo.totalReceitas,
              saldo: resumo.saldo,
              categorias: gastosPorCategoria
            });
          }
          
          const analise = await analisarPadroesGastos(userId, dados);
          if (analise) {
            await sock.sendMessage(userId, { text: analise });
          } else {
            await sock.sendMessage(userId, { 
              text: '❌ Erro ao analisar padrões. Tente novamente mais tarde.' 
            });
          }
        } catch (error) {
          console.error('[ANALISE] Erro:', error);
          await sock.sendMessage(userId, { 
            text: '❌ Erro ao analisar padrões de gastos. Tente novamente.' 
          });
        }
        return;
      }

      // Comando para sugestões de economia
      if (["sugestoes", "sugestões", "dicas", "economia", "economizar"].includes(textoLower)) {
        if (!isGeminiAvailable()) {
          await sock.sendMessage(userId, { 
            text: '❌ Funcionalidade de sugestões inteligentes não está disponível.\n\nConfigure a API key do Gemini para usar esta funcionalidade.' 
          });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '💡 *Gerando sugestões de economia...*\n\n⏳ Analisando seus gastos...' 
        });
        
        try {
          // Buscar dados dos últimos 2 meses
          const hoje = new Date();
          const dados = [];
          
          for (let i = 0; i < 2; i++) {
            const mes = hoje.getMonth() - i;
            const ano = hoje.getFullYear();
            const resumo = await getResumoPorMes(userId, mes + 1, ano);
            const gastosPorCategoria = await getGastosPorCategoria(userId, mes + 1, ano);
            
            dados.push({
              mes: getNomeMes(mes),
              ano: ano,
              totalGastos: resumo.totalDespesas,
              categorias: gastosPorCategoria
            });
          }
          
          const sugestoes = await gerarSugestoesEconomia(userId, dados);
          if (sugestoes) {
            await sock.sendMessage(userId, { text: sugestoes });
          } else {
            await sock.sendMessage(userId, { 
              text: '❌ Erro ao gerar sugestões. Tente novamente mais tarde.' 
            });
          }
        } catch (error) {
          console.error('[SUGESTOES] Erro:', error);
          await sock.sendMessage(userId, { 
            text: '❌ Erro ao gerar sugestões de economia. Tente novamente.' 
          });
        }
        return;
      }

      // Comando para previsões de gastos
      if (["previsao", "previsão", "prever", "futuro"].includes(textoLower)) {
        if (!isGeminiAvailable()) {
          await sock.sendMessage(userId, { 
            text: '❌ Funcionalidade de previsões inteligentes não está disponível.\n\nConfigure a API key do Gemini para usar esta funcionalidade.' 
          });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '🔮 *Analisando histórico para previsões...*\n\n⏳ Calculando tendências...' 
        });
        
        try {
          // Buscar dados dos últimos 6 meses
          const hoje = new Date();
          const dados = [];
          
          for (let i = 0; i < 6; i++) {
            const mes = hoje.getMonth() - i;
            const ano = hoje.getFullYear();
            const resumo = await getResumoPorMes(userId, mes + 1, ano);
            const gastosPorCategoria = await getGastosPorCategoria(userId, mes + 1, ano);
            
            dados.push({
              mes: getNomeMes(mes),
              ano: ano,
              totalGastos: resumo.totalDespesas,
              totalReceitas: resumo.totalReceitas,
              categorias: gastosPorCategoria
            });
          }
          
          const previsao = await preverGastosFuturos(userId, dados);
          if (previsao) {
            await sock.sendMessage(userId, { text: previsao });
          } else {
            await sock.sendMessage(userId, { 
              text: '❌ Erro ao gerar previsões. Tente novamente mais tarde.' 
            });
          }
        } catch (error) {
          console.error('[PREVISAO] Erro:', error);
          await sock.sendMessage(userId, { 
            text: '❌ Erro ao gerar previsões de gastos. Tente novamente.' 
          });
        }
        return;
      }

      // Comando para ajuda inteligente
      if (["ajuda inteligente", "ajuda financeira", "consulta", "pergunta"].includes(textoLower)) {
        if (!isGeminiAvailable()) {
          await sock.sendMessage(userId, { 
            text: '❌ Funcionalidade de ajuda inteligente não está disponível.\n\nConfigure a API key do Gemini para usar esta funcionalidade.' 
          });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '🤖 *Assistente Financeiro Inteligente*\n\n' +
                'Pergunte sobre:\n' +
                '• Como economizar dinheiro\n' +
                '• Dicas de controle financeiro\n' +
                '• Explicações sobre conceitos financeiros\n' +
                '• Análise de seus padrões de gastos\n\n' +
                'Digite sua pergunta ou digite "cancelar" para sair.'
        });
        
        // Marcar que está aguardando pergunta
        aguardandoPerguntaInteligente = aguardandoPerguntaInteligente || {};
        aguardandoPerguntaInteligente[userId] = true;
        return;
      }

      // Tratamento de perguntas inteligentes
      if (aguardandoPerguntaInteligente && aguardandoPerguntaInteligente[userId]) {
        if (textoLower === 'cancelar') {
          delete aguardandoPerguntaInteligente[userId];
          await sock.sendMessage(userId, { text: '❌ Consulta cancelada.' });
          return;
        }
        
        await sock.sendMessage(userId, { 
          text: '🤖 *Processando sua pergunta...*\n\n⏳ Gerando resposta personalizada...' 
        });
        
        try {
          // Buscar contexto dos últimos 3 meses para personalizar a resposta
          const hoje = new Date();
          const contexto = [];
          
          for (let i = 0; i < 3; i++) {
            const mes = hoje.getMonth() - i;
            const ano = hoje.getFullYear();
            const resumo = await getResumoPorMes(userId, mes + 1, ano);
            contexto.push({
              mes: getNomeMes(mes),
              ano: ano,
              totalGastos: resumo.totalDespesas,
              totalReceitas: resumo.totalReceitas,
              saldo: resumo.saldo
            });
          }
          
          const resposta = await responderPerguntaFinanceira(userId, texto, contexto);
          if (resposta) {
            await sock.sendMessage(userId, { text: resposta });
          } else {
            await sock.sendMessage(userId, { 
              text: '❌ Erro ao processar pergunta. Tente novamente mais tarde.' 
            });
          }
        } catch (error) {
          console.error('[PERGUNTA] Erro:', error);
          await sock.sendMessage(userId, { 
            text: '❌ Erro ao processar pergunta. Tente novamente.' 
          });
        }
        
        delete aguardandoPerguntaInteligente[userId];
        return;
      }


        // --- NOVO COMANDO: EDITAR LANÇAMENTO DIRETO ---
        if (/^editar\s+(um\s+)?lanc[aã]mentos?((\s+de)?\s+\w+\s*\d{4})?$/i.test(texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) {
          console.log('[DEBUG] Comando EDITAR LANÇAMENTO reconhecido!');
          
          // Extrai possível mês/ano
          const partes = texto.trim().split(/\s+/);
          let mesAno = null;
          if (partes.length > 2) {
            const resto = partes.slice(2).join(' ');
            mesAno = parseMesAno(resto);
          }
          
          let todos;
          if (mesAno) {
            todos = await listarLancamentos(userId, 9999, mesAno.mes, mesAno.ano);
            if (!todos || todos.length === 0) {
              await sock.sendMessage(userId, { 
                text: `❌ Nenhum lançamento encontrado para ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}.\n\nUse "histórico" para ver lançamentos de outros períodos.` 
              });
              return;
            }
          } else {
            todos = await listarLancamentos(userId, 9999);
            if (!todos || todos.length === 0) {
              await sock.sendMessage(userId, { 
                text: '❌ Nenhum lançamento encontrado.\n\nUse "histórico" para ver lançamentos de outros períodos.' 
              });
              return;
            }
          }
          
          let msg = mesAno 
            ? `📝 *Lançamentos de ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano} para editar:*\n\n`
            : '📝 *Lançamentos do mês atual para editar:*\n\n';
          
          todos.forEach((l, idx) => {
            const dataBR = (l.data instanceof Date)
              ? l.data.toLocaleDateString('pt-BR')
              : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
                  ? new Date(l.data).toLocaleDateString('pt-BR')
                  : l.data);
            msg += `${idx + 1}. ${dataBR} | 💰 R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
            if (l.tipoAgrupamento === 'parcelado') {
              msg += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo[0].valor)}`;
            }
            if (l.tipoAgrupamento === 'recorrente') {
              msg += ` | 🔁 Recorrente: ${l.grupo.length}x`;
            }
            if (l.descricao) msg += ` | 📝 ${l.descricao}`;
            msg += '\n';
          });
          
          msg += '\n💡 *Digite o número do lançamento que deseja editar ou "cancelar"*';
          
          aguardandoEdicao[userId] = { lista: todos, etapa: null };
          await sock.sendMessage(userId, { text: msg });
          return;
        }

        // --- FLUXO DE ESCOLHA DO LANÇAMENTO PARA EDITAR ---
        if (aguardandoEdicao[userId] && aguardandoEdicao[userId].etapa === null) {
          const op = texto.trim();
          if (op.toLowerCase() === 'cancelar') {
            delete aguardandoEdicao[userId];
            await sock.sendMessage(userId, { text: '❌ Edição de lançamento cancelada.' });
            return;
          }
          const idx = parseInt(op);
          const lista = aguardandoEdicao[userId].lista;
          if (isNaN(idx) || idx < 1 || idx > lista.length) {
            await sock.sendMessage(userId, { text: `❌ Escolha inválida. Digite um número entre 1 e ${lista.length} ou "cancelar".` });
            return;
          }
          aguardandoEdicao[userId].indiceSelecionado = idx - 1;
          aguardandoEdicao[userId].lancamento = lista[idx - 1];
          aguardandoEdicao[userId].etapa = 'campo';
          let msg = 'Qual campo deseja editar?\n1. data\n2. valor\n3. categoria\n4. pagamento\n5. descricao\n6. cancelar';
          await sock.sendMessage(userId, { text: msg });
          return;
        }

        // Comando para iniciar edição de cartão
        const textoNormalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        if (/^editar cartao$/i.test(textoNormalizado)) {
          const cartoes = await listarCartoesConfigurados(userId);
          if (!cartoes || cartoes.length === 0) {
            await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado para editar.' });
            return;
          }
          let msgCartoes = 'Qual cartão deseja editar?\n';
          cartoes.forEach((cartao, idx) => {
            msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
          });
          msgCartoes += '\nDigite o número do cartão ou "cancelar"';
          aguardandoEdicaoCartao[userId] = { cartoes };
          await sock.sendMessage(userId, { text: msgCartoes });
          return;
        }


        // Fluxo aguardando escolha do cartão para editar
        if (aguardandoEdicaoCartao[userId] && !aguardandoEdicaoCartao[userId].cartaoEscolhido) {
          const escolha = texto.toLowerCase().trim();
          if (escolha === 'cancelar') {
            delete aguardandoEdicaoCartao[userId];
            await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
            return;
          }
          const idx = parseInt(escolha);
          const cartoes = aguardandoEdicaoCartao[userId].cartoes;
          if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
            await sock.sendMessage(userId, { text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".` });
            return;
          }
          aguardandoEdicaoCartao[userId].cartaoEscolhido = cartoes[idx - 1];
          await sock.sendMessage(userId, { text: 'Qual campo deseja editar?\n1. vencimento\n2. fechamento\n3. cancelar' });
          return;
        }

        // Fluxo aguardando escolha do campo para editar
        if (aguardandoEdicaoCartao[userId] && aguardandoEdicaoCartao[userId].cartaoEscolhido && !aguardandoEdicaoCartao[userId].campoEscolhido) {
          const campo = texto.toLowerCase().trim();
          let campoEscolhido = campo;
          if (["1", "2", "3"].includes(campo)) {
            if (campo === "1") campoEscolhido = "vencimento";
            else if (campo === "2") campoEscolhido = "fechamento";
            else if (campo === "3") campoEscolhido = "cancelar";
          }
          if (campoEscolhido === 'cancelar') {
            delete aguardandoEdicaoCartao[userId];
            await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
            return;
          }
          if (!['vencimento', 'fechamento'].includes(campoEscolhido)) {
            await sock.sendMessage(userId, { text: '❌ Campo inválido. Digite: 1, 2, 3 ou o nome do campo.' });
            return;
          }
          aguardandoEdicaoCartao[userId].campoEscolhido = campoEscolhido;
          if (campoEscolhido === 'vencimento') {
            await sock.sendMessage(userId, { text: 'Digite o novo dia de vencimento (1-31):' });
          } else if (campoEscolhido === 'fechamento') {
            await sock.sendMessage(userId, { text: 'Digite o novo dia de fechamento (1-31):' });
          }
          return;
        }

        // Fluxo aguardando novo valor de vencimento/fechamento
        if (aguardandoEdicaoCartao[userId] && aguardandoEdicaoCartao[userId].campoEscolhido) {
          const campo = aguardandoEdicaoCartao[userId].campoEscolhido;
          const cartao = aguardandoEdicaoCartao[userId].cartaoEscolhido;
          const valor = texto.toLowerCase().trim();
          if (campo === 'vencimento') {
            const dia = parseInt(valor);
            if (isNaN(dia) || dia < 1 || dia > 31) {
              await sock.sendMessage(userId, { text: '❌ Dia de vencimento inválido. Digite um número entre 1 e 31.' });
              return;
            }
            aguardandoEdicaoCartao[userId].novoVencimento = dia;
            // Atualizar só vencimento
            await atualizarCartaoConfigurado(userId, cartao.nome_cartao, dia, cartao.dia_fechamento);
            await sock.sendMessage(userId, { text: `✅ Cartão ${cartao.nome_cartao} atualizado!\nNovo vencimento: dia ${dia}\nFechamento: dia ${cartao.dia_fechamento || 'NÃO INFORMADO'}` });
            delete aguardandoEdicaoCartao[userId];
            return;
          }
          if (campo === 'fechamento') {
            const dia = parseInt(valor);
            if (isNaN(dia) || dia < 1 || dia > 31) {
              await sock.sendMessage(userId, { text: '❌ Dia de fechamento inválido. Digite um número entre 1 e 31.' });
              return;
            }
            aguardandoEdicaoCartao[userId].novoFechamento = dia;
            // Atualizar só fechamento
            await atualizarCartaoConfigurado(userId, cartao.nome_cartao, cartao.dia_vencimento, dia);
            await sock.sendMessage(userId, { text: `✅ Cartão ${cartao.nome_cartao} atualizado!\nVencimento: dia ${cartao.dia_vencimento}\nNovo fechamento: dia ${dia}` });
            delete aguardandoEdicaoCartao[userId];
            return;
          }
        }


    console.log('[DEBUG] Antes do parseMessage');
    const parsed = parseMessage(texto);
    console.log('[DEBUG] parsed após parseMessage:', parsed);

    // --- VERIFICAÇÃO DE TIPO 'Outro' (CORREÇÃO INTELIGENTE) ---
    if (parsed && (parsed.tipo === 'outro' || !parsed.tipo)) {
      console.log('[DEBUG] Tipo é "outro", tentando correção inteligente...');
      const analise = await analisarMensagemInteligente(texto, userId);
      if (analise && analise.tipo && (analise.tipo === 'gasto' || analise.tipo === 'receita')) {
        // Substituir os campos principais do parsed pelo resultado do parser inteligente
        parsed.tipo = analise.tipo;
        parsed.valor = analise.valor;
        parsed.categoria = analise.categoria;
        parsed.pagamento = analise.formaPagamento;
        parsed.descricao = analise.descricao;
        console.log('[DEBUG] Correção inteligente aplicada ao parsed:', parsed);
        // Reprocessar o lançamento com os dados corrigidos
        return await processarLancamento(userId, parsed, sock);
      } else {
        console.log('[DEBUG] Parser inteligente não conseguiu identificar o tipo');
        await sock.sendMessage(userId, { text: '❌ Não foi possível identificar se é gasto ou receita. Por favor, especifique na mensagem.' });
        return;
      }
    }

      // --- VERIFICAÇÃO DE FALTA DE DATA DE VENCIMENTO PARA BOLETOS ---
      if (parsed && parsed.faltaDataVencimento) {
        console.log('[DEBUG] Falta data de vencimento para boleto, solicitando ao usuário');
        aguardandoDataVencimento[userId] = { parsed: parsed };
        await sock.sendMessage(userId, {
          text: `📄 *Boleto detectado*\n\n` +
            `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
            `📂 Categoria: ${parsed.categoria}\n` +
            `📝 Descrição: ${parsed.descricao}\n\n` +
            `❓ *Qual é a data de vencimento do boleto?*\n` +
            `Digite no formato dd/mm/aaaa (ex: 25/10/2025) ou "cancelar"`
        });
        return;
      }

      // --- VERIFICAÇÃO DE FORMA DE PAGAMENTO ---
      if (parsed && parsed.faltaFormaPagamento) {
        console.log('[DEBUG] Falta forma de pagamento, solicitando ao usuário');
        aguardandoFormaPagamento[userId] = { parsed: parsed };
        let msgFormaPagamento = `💳 *Forma de pagamento não informada*\n\n`;
        msgFormaPagamento += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
        msgFormaPagamento += `📂 Categoria: ${parsed.categoria}\n`;
        msgFormaPagamento += `📝 Descrição: ${parsed.descricao}\n\n`;
        msgFormaPagamento += `❓ *Qual forma de pagamento você usou?*\n\n`;
        formasPagamento.forEach((forma, index) => {
          msgFormaPagamento += `${index + 1}. ${forma}\n`;
        });
        msgFormaPagamento += `\nDigite o número da opção ou "cancelar"`;
        await sock.sendMessage(userId, { text: msgFormaPagamento });
        return;
      }

      // --- DETECÇÃO DE GASTOS NO CARTÃO DE CRÉDITO (PRIORITÁRIO) ---
      const pagamentoNormalizado = (parsed.pagamento || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      console.log('[DEBUG] pagamentoNormalizado:', pagamentoNormalizado);
      if (
        parsed &&
        parsed.tipo &&
        parsed.tipo.toLowerCase() === 'gasto' &&
        pagamentoNormalizado.includes('credito')
      ) {
        console.log('[DEBUG] Detecção de gasto no crédito');
        const cartoes = await listarCartoesConfigurados(userId);
        console.log('[DEBUG] Cartões encontrados:', cartoes.length, cartoes);
        
        if (cartoes.length === 0) {
          console.log('[DEBUG] Nenhum cartão configurado, registrando como gasto comum');
          try {
            const tipoNormalizado = (parsed.tipo || '').toLowerCase();
            await appendRowToDatabase(userId, [
              parsed.data.split('/').reverse().join('-'),
              tipoNormalizado,
        parsed.descricao,
        parsed.valor,
        parsed.categoria,
        parsed.pagamento,
              null, // parcelamento_id
              null, // parcela_atual
              null, // total_parcelas
              null, // recorrente
              null, // recorrente_fim
              null, // recorrente_id
              null, // cartao_nome
              null, // data_lancamento
              null, // data_contabilizacao
              null, // mes_fatura
              null, // ano_fatura
              null, // dia_vencimento
              null, // status_fatura
              parsed.dataVencimento // data_vencimento
            ]);
            await sock.sendMessage(userId, {
              text: `✅ Gasto registrado com sucesso!\n\n` +
                `📅 Data: ${parsed.data}\n` +
                `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
                `📂 Categoria: ${parsed.categoria}\n` +
                `💳 Pagamento: ${parsed.pagamento}\n` +
                `📝 Descrição: ${parsed.descricao}\n\n` +
                `💡 *Dica:* Para controlar faturas e ter resumos por cartão, use o comando "configurar cartao"!`
            });
            return;
          } catch (error) {
            await sock.sendMessage(userId, { 
              text: `❌ Erro ao registrar gasto: ${error.message}` 
            });
            return;
          }
        }
        
        if (cartoes.length === 1) {
          console.log('[DEBUG] Apenas um cartão configurado, vinculando automaticamente:', cartoes[0]);
          const cartao = cartoes[0];
          const dataLancamento = new Date();
          const dataContabilizacaoInfo = calcularDataContabilizacao(dataLancamento, cartao.dia_vencimento, cartao.dia_fechamento);
          const dataContabilizacao = dataContabilizacaoInfo.dataContabilizacao;
          const mesFatura = dataContabilizacaoInfo.mesFatura;
          const anoFatura = dataContabilizacaoInfo.anoFatura;
          
          try {
            // Verificar se é parcelamento
            if (parsed.parcelamento && parsed.numParcelas > 1) {
              console.log('[DEBUG] Criando parcelamento no cartão:', parsed.numParcelas, 'parcelas');
              const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed, cartao);
              // Calcular datas de contabilização das parcelas
              const datasFatura = [];
              for (let i = 0; i < parsed.numParcelas; i++) {
                const dataParcela = new Date();
                dataParcela.setMonth(dataParcela.getMonth() + i);
                const infoFatura = calcularDataContabilizacao(dataParcela, cartao.dia_vencimento, cartao.dia_fechamento);
                datasFatura.push(infoFatura.dataContabilizacao.toLocaleDateString('pt-BR'));
              }
              let msgParcelamento = `✅ Parcelamento registrado no cartão ${cartao.nome_cartao}!\n\n`;
              msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
              msgParcelamento += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
              msgParcelamento += `📅 Primeira parcela na fatura: ${datasFatura[0]}\n`;
              msgParcelamento += `📅 Última parcela na fatura: ${datasFatura[datasFatura.length - 1]}\n`;
              msgParcelamento += `📂 Categoria: ${parsed.categoria}\n`;
              msgParcelamento += `💳 Pagamento: ${parsed.pagamento}\n`;
              msgParcelamento += `📝 Descrição: ${parsed.descricao}\n`;
              msgParcelamento += `Contabiliza: ${datasFatura[0]} (fatura inicial)`;
              await sock.sendMessage(userId, { text: msgParcelamento });
              return;
            }
            
            // Verificar se é recorrente
            if (parsed.recorrente && parsed.recorrenteMeses > 1) {
              console.log('[DEBUG] Criando recorrente no cartão:', parsed.recorrenteMeses, 'meses');
              const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartao);
              
              let msgRecorrente = `✅ Lançamento recorrente registrado no cartão ${cartao.nome_cartao}!\n\n`;
              msgRecorrente += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
              msgRecorrente += `🔄 ${parsed.recorrenteMeses} meses (${parsed.recorrenteMeses}x)\n`;
              msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
              msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
              // Adicionar informação de confiança da categoria para recorrente
              let msgCategoriaRecorrente = `📂 Categoria: ${parsed.categoria}`;
              if (parsed.confiancaCategoria) {
                const iconesConfianca = {
                  'alta': '🟢',
                  'media': '🟡', 
                  'baixa': '🟠',
                  'nenhuma': '🔴'
                };
                const icone = iconesConfianca[parsed.confiancaCategoria] || '⚪';
                msgCategoriaRecorrente += ` ${icone} (${parsed.confiancaCategoria})`;
              }
              msgRecorrente += `${msgCategoriaRecorrente}\n`;
              msgRecorrente += `💳 Pagamento: ${parsed.pagamento}\n`;
              msgRecorrente += `📝 Descrição: ${parsed.descricao}`;
              
              await sock.sendMessage(userId, { text: msgRecorrente });
              return;
            }
            
            // Gasto normal no cartão (não parcelado, não recorrente)
            console.log('[DEBUG] Criando gasto normal no cartão');
            await appendRowToDatabase(userId, [
              parsed.data.split('/').reverse().join('-'),
              parsed.tipo.toLowerCase(),
              parsed.descricao,
              parsed.valor,
              parsed.categoria,
              parsed.pagamento,
              null, // parcelamento_id
              null, // parcela_atual
              null, // total_parcelas
              null, // recorrente
              null, // recorrente_fim
              null, // recorrente_id
              cartao.nome_cartao, // cartao_nome
              dataLancamento.toISOString().split('T')[0], // data_lancamento
              dataContabilizacao.toISOString().split('T')[0], // data_contabilizacao
              mesFatura, // mes_fatura
              anoFatura, // ano_fatura
              cartao.dia_vencimento, // dia_vencimento
              'pendente', // status_fatura
              parsed.dataVencimento // data_vencimento
            ]);
            const dataContabilizacaoBR = dataContabilizacao.toLocaleDateString('pt-BR');
            const nomeMes = getNomeMes(mesFatura - 1);
            await sock.sendMessage(userId, {
              text: `✅ Gasto registrado no cartão ${cartao.nome_cartao}!\n\n` +
                `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
                `📅 Lançamento: ${parsed.data}\n` +
                `📂 Categoria: ${parsed.categoria}\n` +
                `💳 Pagamento: ${parsed.pagamento}\n` +
                `📝 Descrição: ${parsed.descricao}\n` +
                `Contabiliza: ${dataContabilizacaoBR} (fatura ${nomeMes}/${anoFatura})`
            });
            return;
          } catch (error) {
            console.log('[DEBUG] Erro ao registrar gasto no cartão:', error);
            await sock.sendMessage(userId, { 
              text: `❌ Erro ao registrar gasto no cartão: ${error.message}` 
            });
            return;
          }
        } else if (cartoes.length > 1) {
          console.log('[DEBUG] Múltiplos cartões configurados, solicitando escolha do usuário');
          let msgCartoes = `💳 Qual cartão você usou?\n\n`;
          cartoes.forEach((cartao, index) => {
            msgCartoes += `${index + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento})\n`;
          });
          msgCartoes += `\nDigite o número do cartão ou "cancelar"`;
          aguardandoConfiguracaoCartao[userId] = { 
            parsed: parsed, 
            cartoes,
            aguardandoEscolha: true 
          };
          await sock.sendMessage(userId, { text: msgCartoes });
          return;
        }
      }

      // --- PARSER DE LANÇAMENTO NORMAL ---
      console.log('[DEBUG] Processando lançamento normal');
      
      // Verificar se há erro de validação mas ainda temos os dados necessários
      if (parsed && parsed.error && parsed.valorExtraido) {
        // Tentar processar mesmo com erro de validação, usando o valor extraído
        const parsedComValor = {
          ...parsed,
          valor: Number(parsed.valorExtraido) || 0,
          tipo: parsed.tipo || 'gasto',
          categoria: parsed.categoria || 'Outros',
          pagamento: parsed.pagamento || 'NÃO INFORMADO',
          data: parsed.data || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          descricao: parsed.descricao || 'Lançamento'
        };
        
        // Processar o lançamento com aviso sobre o valor alto
        try {
          const tipoNormalizado = (parsedComValor.tipo || '').toLowerCase();
          
          // Verificar se é parcelamento
          if (parsedComValor.parcelamento && parsedComValor.numParcelas > 1) {
            console.log('[DEBUG] Criando parcelamento com aviso de valor alto:', parsedComValor.numParcelas, 'parcelas');
            const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsedComValor);
            
            let msgParcelamento = `⚠️ ${parsed.error}\n\n✅ Parcelamento registrado com sucesso!\n\n`;
            msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsedComValor.valor)}\n`;
            msgParcelamento += `📦 ${parsedComValor.numParcelas}x de R$ ${formatarValor(parsedComValor.valor / parsedComValor.numParcelas)}\n`;
            msgParcelamento += `📅 Primeira parcela: ${lancamentosCriados[0].data}\n`;
            msgParcelamento += `📅 Última parcela: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
            msgParcelamento += `📂 Categoria: ${parsedComValor.categoria}\n`;
            msgParcelamento += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
            msgParcelamento += `📝 Descrição: ${parsedComValor.descricao}`;
            
            await sock.sendMessage(userId, { text: msgParcelamento });
            return;
          }
          
          // Verificar se é recorrente
          if (parsedComValor.recorrente && parsedComValor.recorrenteMeses > 1) {
            console.log('[DEBUG] Criando recorrente com aviso de valor alto:', parsedComValor.recorrenteMeses, 'meses');
            const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsedComValor);
            
            let msgRecorrente = `⚠️ ${parsed.error}\n\n✅ Lançamento recorrente registrado com sucesso!\n\n`;
            msgRecorrente += `💰 Valor: R$ ${formatarValor(parsedComValor.valor)}\n`;
            msgRecorrente += `🔄 ${parsedComValor.recorrenteMeses} meses (${parsedComValor.recorrenteMeses}x)\n`;
            msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
            msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
            msgRecorrente += `📂 Categoria: ${parsedComValor.categoria}\n`;
            msgRecorrente += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
            msgRecorrente += `📝 Descrição: ${parsedComValor.descricao}`;
            
            await sock.sendMessage(userId, { text: msgRecorrente });
            return;
          }
          
          // Lançamento normal com aviso
          await appendRowToDatabase(userId, [
            parsedComValor.data.split('/').reverse().join('-'),
            tipoNormalizado,
            parsedComValor.descricao,
            parsedComValor.valor,
            parsedComValor.categoria,
            parsedComValor.pagamento,
            null, // parcelamento_id
            null, // parcela_atual
            null, // total_parcelas
            null, // recorrente
            null, // recorrente_fim
            null, // recorrente_id
            null, // cartao_nome
            null, // data_lancamento
            null, // data_contabilizacao
            null, // mes_fatura
            null, // ano_fatura
            null, // dia_vencimento
            null, // status_fatura
            parsedComValor.dataVencimento // data_vencimento
          ]);
          
          let msg = `⚠️ ${parsed.error}\n\n✅ Lançamento registrado com sucesso!\n\n`;
          msg += `📅 Data: ${parsedComValor.data}\n`;
          msg += `💰 Valor: R$ ${formatarValor(parsedComValor.valor)}\n`;
          msg += `📂 Categoria: ${parsedComValor.categoria}\n`;
          msg += `💳 Pagamento: ${parsedComValor.pagamento}\n`;
          msg += `📝 Descrição: ${parsedComValor.descricao}`;
          
          await sock.sendMessage(userId, { text: msg });
          return;
        } catch (error) {
          await sock.sendMessage(userId, { 
            text: `❌ Erro ao registrar lançamento: ${error.message}` 
          });
          return;
        }
      }

      // --- LANÇAMENTO NORMAL SEM ERROS ---
      if (parsed && !parsed.error) {
        // --- VERIFICAÇÃO DE FALTA DE DATA DE VENCIMENTO PARA BOLETOS ---
        if (parsed.faltaDataVencimento) {
          console.log('[DEBUG] Falta data de vencimento para boleto, solicitando ao usuário');
          aguardandoDataVencimento[userId] = { parsed: parsed };
          await sock.sendMessage(userId, {
            text: `📄 *Boleto detectado*\n\n` +
              `💰 Valor: R$ ${formatarValor(parsed.valor)}\n` +
              `📂 Categoria: ${parsed.categoria}\n` +
              `📝 Descrição: ${parsed.descricao}\n\n` +
              `❓ *Qual é a data de vencimento do boleto?*\n` +
              `Digite no formato dd/mm/aaaa (ex: 25/10/2025) ou "cancelar"`
          });
          return;
        }

        try {
          const tipoNormalizado = (parsed.tipo || '').toLowerCase();
          
          // Verificar se é parcelamento
          if (parsed.parcelamento && parsed.numParcelas > 1) {
            console.log('[DEBUG] Criando parcelamento normal:', parsed.numParcelas, 'parcelas');
            const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed);
            
            let msgParcelamento = `✅ Parcelamento registrado com sucesso!\n\n`;
            msgParcelamento += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
            msgParcelamento += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
            msgParcelamento += `📅 Primeira parcela: ${lancamentosCriados[0].data}\n`;
            msgParcelamento += `📅 Última parcela: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
            msgParcelamento += `📂 Categoria: ${parsed.categoria}\n`;
            msgParcelamento += `💳 Pagamento: ${parsed.pagamento}\n`;
            msgParcelamento += `📝 Descrição: ${parsed.descricao}`;
            
            // Adicionar validações se houver
            if (parsed.validacoes && parsed.validacoes.length > 0) {
              msgParcelamento += `\n\n⚠️ *Avisos:*\n${parsed.validacoes.join('\n')}`;
            }
            
            await sock.sendMessage(userId, { text: msgParcelamento });
            return;
          }
          
          // Verificar se é recorrente
          if (parsed.recorrente && parsed.recorrenteMeses > 1) {
            console.log('[DEBUG] Criando recorrente normal:', parsed.recorrenteMeses, 'meses');
            const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed);
            
            let msgRecorrente = `✅ Lançamento recorrente registrado com sucesso!\n\n`;
            msgRecorrente += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
            msgRecorrente += `🔄 ${parsed.recorrenteMeses} meses (${parsed.recorrenteMeses}x)\n`;
            msgRecorrente += `📅 Primeiro: ${lancamentosCriados[0].data}\n`;
            msgRecorrente += `📅 Último: ${lancamentosCriados[lancamentosCriados.length - 1].data}\n`;
            msgRecorrente += `📂 Categoria: ${parsed.categoria}\n`;
            msgRecorrente += `💳 Pagamento: ${parsed.pagamento}\n`;
            msgRecorrente += `📝 Descrição: ${parsed.descricao}`;
            
            // Adicionar validações se houver
            if (parsed.validacoes && parsed.validacoes.length > 0) {
              msgRecorrente += `\n\n⚠️ *Avisos:*\n${parsed.validacoes.join('\n')}`;
            }
            
            await sock.sendMessage(userId, { text: msgRecorrente });
            return;
          }
          
          // Lançamento normal
          await appendRowToDatabase(userId, [
            parsed.data.split('/').reverse().join('-'),
            tipoNormalizado,
            parsed.descricao,
            parsed.valor,
            parsed.categoria,
            parsed.pagamento,
            null, // parcelamento_id
            null, // parcela_atual
            null, // total_parcelas
            null, // recorrente
            null, // recorrente_fim
            null, // recorrente_id
            null, // cartao_nome
            null, // data_lancamento
            null, // data_contabilizacao
            null, // mes_fatura
            null, // ano_fatura
            null, // dia_vencimento
            null, // status_fatura
            parsed.dataVencimento // data_vencimento
          ]);
          
          let msg = `✅ Lançamento registrado com sucesso!\n\n`;
          msg += `📅 Data: ${parsed.data}\n`;
          msg += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
          msg += `📂 Categoria: ${parsed.categoria}\n`;
          msg += `💳 Pagamento: ${parsed.pagamento}\n`;
          msg += `📝 Descrição: ${parsed.descricao}`;
          
          // Adicionar validações se houver
          if (parsed.validacoes && parsed.validacoes.length > 0) {
            msg += `\n\n⚠️ *Avisos:*\n${parsed.validacoes.join('\n')}`;
          }
          
          await sock.sendMessage(userId, { text: msg });
          return;
        } catch (error) {
          await sock.sendMessage(userId, { 
            text: `❌ Erro ao registrar lançamento: ${error.message}` 
          });
          return;
        }
      }

      // // Comando para iniciar edição de cartão
      // if (/^editar cartao$/i.test(texto.toLowerCase())) {
      //   const cartoes = await listarCartoesConfigurados(userId);
      //   if (!cartoes || cartoes.length === 0) {
      //     await sock.sendMessage(userId, { text: '❌ Nenhum cartão configurado para editar.' });
      //     return;
      //   }
      //   let msgCartoes = 'Qual cartão deseja editar?\n';
      //   cartoes.forEach((cartao, idx) => {
      //     msgCartoes += `${idx + 1}. ${cartao.nome_cartao} (vence dia ${cartao.dia_vencimento}, fecha dia ${cartao.dia_fechamento || 'NÃO INFORMADO'})\n`;
      //   });
      //   msgCartoes += '\nDigite o número do cartão ou "cancelar"';
      //   aguardandoEdicaoCartao[userId] = { cartoes };
      //   await sock.sendMessage(userId, { text: msgCartoes });
      //   return;
      // }

      // // Fluxo aguardando escolha do cartão para editar
      // if (aguardandoEdicaoCartao[userId] && !aguardandoEdicaoCartao[userId].cartaoEscolhido) {
      //   const escolha = texto.toLowerCase().trim();
      //   if (escolha === 'cancelar') {
      //     delete aguardandoEdicaoCartao[userId];
      //     await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
      //     return;
      //   }
      //   const idx = parseInt(escolha);
      //   const cartoes = aguardandoEdicaoCartao[userId].cartoes;
      //   if (isNaN(idx) || idx < 1 || idx > cartoes.length) {
      //     await sock.sendMessage(userId, { text: `❌ Escolha inválida. Digite um número entre 1 e ${cartoes.length} ou "cancelar".` });
      //     return;
      //   }
      //   aguardandoEdicaoCartao[userId].cartaoEscolhido = cartoes[idx - 1];
      //   await sock.sendMessage(userId, { text: 'Qual campo deseja editar?\n1. vencimento\n2. fechamento\n3. cancelar' });
      //   return;
      // }

      // // Fluxo aguardando escolha do campo para editar
      // if (aguardandoEdicaoCartao[userId] && aguardandoEdicaoCartao[userId].cartaoEscolhido && !aguardandoEdicaoCartao[userId].campoEscolhido) {
      //   const campo = texto.toLowerCase().trim();
      //   let campoEscolhido = campo;
      //   if (["1", "2", "3"].includes(campo)) {
      //     if (campo === "1") campoEscolhido = "vencimento";
      //     else if (campo === "2") campoEscolhido = "fechamento";
      //     else if (campo === "3") campoEscolhido = "cancelar";
      //   }
      //   if (campoEscolhido === 'cancelar') {
      //     delete aguardandoEdicaoCartao[userId];
      //     await sock.sendMessage(userId, { text: '❌ Edição de cartão cancelada.' });
      //     return;
      //   }
      //   if (!['vencimento', 'fechamento'].includes(campoEscolhido)) {
      //     await sock.sendMessage(userId, { text: '❌ Campo inválido. Digite: 1, 2, 3 ou o nome do campo.' });
      //     return;
      //   }
      //   aguardandoEdicaoCartao[userId].campoEscolhido = campoEscolhido;
      //   if (campoEscolhido === 'vencimento') {
      //     await sock.sendMessage(userId, { text: 'Digite o novo dia de vencimento (1-31):' });
      //   } else if (campoEscolhido === 'fechamento') {
      //     await sock.sendMessage(userId, { text: 'Digite o novo dia de fechamento (1-31):' });
      //   }
      //   return;
      // }

      // // Fluxo aguardando novo valor de vencimento/fechamento
      // if (aguardandoEdicaoCartao[userId] && aguardandoEdicaoCartao[userId].campoEscolhido) {
      //   const campo = aguardandoEdicaoCartao[userId].campoEscolhido;
      //   const cartao = aguardandoEdicaoCartao[userId].cartaoEscolhido;
      //   const valor = texto.toLowerCase().trim();
      //   if (campo === 'vencimento') {
      //     const dia = parseInt(valor);
      //     if (isNaN(dia) || dia < 1 || dia > 31) {
      //       await sock.sendMessage(userId, { text: '❌ Dia de vencimento inválido. Digite um número entre 1 e 31.' });
      //       return;
      //     }
      //     aguardandoEdicaoCartao[userId].novoVencimento = dia;
      //     // Atualizar só vencimento
      //     await atualizarCartaoConfigurado(userId, cartao.nome_cartao, dia, cartao.dia_fechamento);
      //     await sock.sendMessage(userId, { text: `✅ Cartão ${cartao.nome_cartao} atualizado!\nNovo vencimento: dia ${dia}\nFechamento: dia ${cartao.dia_fechamento || 'NÃO INFORMADO'}` });
      //     delete aguardandoEdicaoCartao[userId];
      //     return;
      //   }
      //   if (campo === 'fechamento') {
      //     const dia = parseInt(valor);
      //     if (isNaN(dia) || dia < 1 || dia > 31) {
      //       await sock.sendMessage(userId, { text: '❌ Dia de fechamento inválido. Digite um número entre 1 e 31.' });
      //       return;
      //     }
      //     aguardandoEdicaoCartao[userId].novoFechamento = dia;
      //     // Atualizar só fechamento
      //     await atualizarCartaoConfigurado(userId, cartao.nome_cartao, cartao.dia_vencimento, dia);
      //     await sock.sendMessage(userId, { text: `✅ Cartão ${cartao.nome_cartao} atualizado!\nVencimento: dia ${cartao.dia_vencimento}\nNovo fechamento: dia ${dia}` });
      //     delete aguardandoEdicaoCartao[userId];
      //     return;
      //   }
      // }

      // Dentro do bloco de resposta padrão (mensagem não reconhecida):
      console.log('[DEBUG] Nenhum comando reconhecido, enviando resposta padrão.');
      await sock.sendMessage(userId, {
        text: '❌ Comando não reconhecido ou valor não encontrado na mensagem.\nDigite *ajuda* para ver a lista de comandos disponíveis.'
      });
      return;
      });

    // --- AGENDAMENTO DE ALERTAS ---
    console.log('🔔 Configurando sistema de alertas...');
    
    // Verificar alertas a cada hora (para garantir que não perca o horário da manhã)
    setInterval(async () => {
      try {
        await verificarEEnviarAlertas(sock);
      } catch (error) {
        console.error('[ALERTAS] Erro ao verificar alertas:', error);
      }
    }, 60 * 60 * 1000); // 1 hora
    
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
    }
}

module.exports = {
  criarParcelamento,
};

startBot();
