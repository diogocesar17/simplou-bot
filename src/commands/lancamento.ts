// @ts-nocheck
// Utilitário simples para remover acentos/diacríticos
function removerAcentos(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Formata Date em YYYY-MM-DD sem efeitos de timezone (usando campos locais)
function formatarDateParaISO(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// Comando de lançamento centralizado
import { parseMessage } from '../utils/parseUtils';
import * as lancamentosService from '../services/lancamentosService';
import * as cartoesService from '../services/cartoesService';
import * as geminiService from '../services/geminiService';
import { formatarValor } from '../utils/formatUtils';
import { converterDataParaISO } from '../utils/dataUtils';
import { definirEstado, obterEstado, limparEstado } from '../configs/stateManager';
import { formatarMensagem } from '../utils/formatMessages';

// Função para gerar ID único
function gerarIdUnico() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Função para categorização baseada em palavras-chave
function categorizarPorPalavrasChave(texto) {
  console.log(`[CATEGORIZACAO] Analisando texto: "${texto}"`);
  const textoLower = texto.toLowerCase();
  console.log(`[CATEGORIZACAO] Texto em lowercase: "${textoLower}"`);
  
  // Mapeamento de palavras-chave para categorias
  const categorias = {
    'Alimentação': [
      'mercado', 'supermercado', 'restaurante', 'lanche', 'delivery', 'ifood', 'rappi', 'uber eats',
      'comida', 'almoço', 'jantar', 'café', 'padaria', 'açougue', 'hortifruti', 'feira'
    ],
    'Transporte': [
      'uber', '99', 'taxi', 'combustível', 'gasolina', 'etanol', 'ônibus', 'metrô', 'trem',
      'transporte público', 'estacionamento', 'pedágio', 'uber eats', 'rappi'
    ],
    'Saúde': [
      'médico', 'farmácia', 'plano de saúde', 'consulta', 'exame', 'laboratório', 'hospital',
      'dentista', 'psicólogo', 'fisioterapeuta', 'remédio', 'medicamento'
    ],
    'Educação': [
      'curso', 'faculdade', 'universidade', 'escola', 'livro', 'material escolar', 'mensalidade',
      'matrícula', 'apostila', 'workshop', 'treinamento'
    ],
    'Moradia': [
      'aluguel', 'condomínio', 'conta de luz', 'energia elétrica', 'água', 'gás', 'internet',
      'telefone', 'iptu', 'seguro residencial'
    ],
    'Lazer': [
      'cinema', 'teatro', 'show', 'viagem', 'passeio', 'entretenimento', 'bar', 'balada',
      'academia', 'esporte', 'hobby', 'jogo', 'netflix', 'spotify'
    ],
    'Vestuário': [
      'roupa', 'calçado', 'acessório', 'loja de roupas', 'sapato', 'tenis', 'camisa', 'calça',
      'vestido', 'bolsa', 'carteira', 'relógio'
    ],
    'Serviços': [
      'manutenção', 'conserto', 'limpeza', 'beleza', 'barbearia', 'salão', 'cabeleireiro',
      'manicure', 'pedicure', 'lavanderia', 'oficina'
    ],
    'Casa': [
      'móveis', 'eletrodomésticos', 'decoração', 'material de construção', 'construção',
      'reforma', 'ferramenta', 'tinta', 'cimento', 'areia', 'tijolo', 'telha', 'canos',
      'fiação', 'lâmpada', 'sofa', 'cama', 'mesa', 'geladeira', 'fogão', 'microondas',
      'tv', 'computador', 'notebook', 'celular', 'smartphone'
    ],
    'Trabalho': [
      'material de escritório', 'equipamento profissional', 'ferramenta profissional',
      'computador', 'notebook', 'impressora', 'papel', 'caneta', 'lápis', 'mochila',
      'uniforme', 'epi', 'equipamento de proteção'
    ],
    'Renda': [
      'salário', 'freela', 'bônus', 'comissão', 'renda extra', 'pagamento', 'recebimento',
      'transferência recebida', 'depósito'
    ]
  };
  
  // Verificar cada categoria
  for (const [categoria, palavrasChave] of Object.entries(categorias)) {
    console.log(`[CATEGORIZACAO] Verificando categoria: ${categoria}`);
    for (const palavra of palavrasChave) {
      if (textoLower.includes(palavra)) {
        console.log(`[CATEGORIZACAO] ✅ Encontrou palavra-chave: "${palavra}" → Categoria: ${categoria}`);
        return categoria;
      }
    }
  }
  
  console.log(`[CATEGORIZACAO] ❌ Nenhuma palavra-chave encontrada`);
  return null; // Não encontrou correspondência
}

// Função para análise inteligente com IA
async function analisarLancamentoComIA(userId, texto) {
  try {
    console.log(`[IA_ANALISE] Iniciando análise para: "${texto}"`);
    
    // Primeiro, tentar categorizar por palavras-chave
    const categoriaPorPalavrasChave = categorizarPorPalavrasChave(texto);
    console.log(`[IA_ANALISE] Categoria por palavras-chave: ${categoriaPorPalavrasChave}`);
    
    const prompt = `
Analise a seguinte mensagem e extraia informações de um lançamento financeiro.
Retorne APENAS um JSON válido com a seguinte estrutura:

{
  "tipo": "gasto" ou "receita",
  "valor": número (apenas números, sem R$),
  "descricao": "descrição do lançamento",
  "categoria": "categoria mais apropriada",
  "pagamento": "pix", "dinheiro", "credito", "debito", "boleto", "transferencia" ou "NÃO INFORMADO",
  "data": "dd/mm/aaaa" (data atual se não especificada),
  "confianca": número de 0 a 1 (confiança na análise)
}

CATEGORIAS DISPONÍVEIS (use exatamente estas):
- Alimentação (comida, restaurante, mercado, lanche, delivery)
- Transporte (uber, 99, combustível, transporte público, taxi)
- Saúde (médico, farmácia, plano de saúde, consulta, exame)
- Educação (curso, faculdade, escola, livro, material escolar)
- Moradia (aluguel, condomínio, conta de luz, água, gás, internet)
- Lazer (cinema, teatro, show, viagem, passeio, entretenimento)
- Vestuário (roupa, calçado, acessórios, loja de roupas)
- Serviços (manutenção, conserto, limpeza, beleza, barbearia)
- Casa (móveis, eletrodomésticos, decoração, material de construção)
- Trabalho (material de escritório, equipamentos, ferramentas)
- Renda (salário, freela, bônus, comissão, renda extra)
- Outros (quando não se encaixa nas categorias acima)

Exemplos de análise:
- "Gasto de 2619,92 com Plano de Saúde no pix" → {"tipo": "gasto", "valor": 2619.92, "descricao": "Plano de Saúde", "categoria": "Saúde", "pagamento": "pix", "data": "06/08/2025", "confianca": 0.95}
- "Paguei 2619,92 do plano de saúde no pix" → {"tipo": "gasto", "valor": 2619.92, "descricao": "Plano de Saúde", "categoria": "Saúde", "pagamento": "pix", "data": "06/08/2025", "confianca": 0.9}
- "Gastei 78,80 na loja de materiais de construção no pix" → {"tipo": "gasto", "valor": 78.80, "descricao": "Loja de Materiais de Construção", "categoria": "Casa", "pagamento": "pix", "data": "06/08/2025", "confianca": 0.95}
- "Recebi 5000 de salário" → {"tipo": "receita", "valor": 5000, "descricao": "Salário", "categoria": "Renda", "pagamento": "transferencia", "data": "06/08/2025", "confianca": 0.95}

IMPORTANTE: Para materiais de construção, ferramentas, móveis, eletrodomésticos → use "Casa"
Para material de escritório, equipamentos profissionais → use "Trabalho"

${categoriaPorPalavrasChave ? `CATEGORIA DETECTADA: "${categoriaPorPalavrasChave}" - Use esta categoria se for apropriada.` : ''}

Mensagem para analisar: "${texto}"

Data atual: ${new Date().toLocaleDateString('pt-BR')}
`;

    const analiseGemini = await geminiService.analisarTransacaoComGemini(texto, userId);
    console.log(`[IA_ANALISE] Resposta da IA:`, analiseGemini);
    if (!analiseGemini) {
      console.log('[IA_ANALISE] ❌ IA indisponível ou sem resposta. Abortando fallback.');
      return null;
    }
    
    // Validar se tem os campos essenciais
    if (!analiseGemini.tipo || !analiseGemini.valor || !analiseGemini.descricao) {
      console.log(`[IA_ANALISE] ❌ Campos essenciais faltando`);
      return null;
    }
    
    // Normalizar forma de pagamento retornada pela IA
    const normalizar = (v) => {
      if (!v) return null;
      const s = removerAcentos(String(v).trim().toLowerCase());
      if (['nao informado', 'não informado', 'nao especificado', 'não especificado', 'indefinido', 'desconhecido'].includes(s)) {
        return null;
      }
      if (s.includes('pix')) return 'pix';
      if (s.includes('dinheiro') || s.includes('cash')) return 'dinheiro';
      if (s.includes('credito') || s.includes('cartao de credito') || s.includes('cartao') || s.includes('cartão')) return 'credito';
      if (s.includes('debito') || s.includes('cartao de debito')) return 'debito';
      if (s.includes('boleto')) return 'boleto';
      if (s.includes('transferencia') || s.includes('transferencia bancaria') || s.includes('transferencia bancária') || s.includes('ted') || s.includes('doc') || s.includes('transfer')) return 'transferencia';
      return null;
    };
    const pagamentoNormalizado = normalizar(analiseGemini.formaPagamento);

    const resultado = {
      tipo: analiseGemini.tipo,
      valor: analiseGemini.valor,
      descricao: analiseGemini.descricao,
      categoria: categoriaPorPalavrasChave || analiseGemini.categoria || 'Outros',
      pagamento: pagamentoNormalizado || 'NÃO INFORMADO',
      data: new Date().toLocaleDateString('pt-BR'),
      faltaFormaPagamento: !pagamentoNormalizado,
      faltaDataVencimento: false,
      parcelamento: false,
      recorrente: false
    };
    
    console.log(`[IA_ANALISE] Resultado final:`, resultado);
    console.log(`[IA_ANALISE] Categoria final: ${resultado.categoria} (palavras-chave: ${categoriaPorPalavrasChave}, IA: ${analiseGemini.categoria})`);
    
    return resultado;
  } catch (error) {
    console.error('Erro na análise com IA:', error);
    return null;
  }
}

// Função para calcular data futura
function calcularDataFutura(dataInicial: Date, mesesAdicionar: number) {
  // Evitar efeito de timezone ao usar Date com string ISO
  const data = new Date(dataInicial.getFullYear(), dataInicial.getMonth(), dataInicial.getDate());
  data.setMonth(data.getMonth() + mesesAdicionar);
  // Retorna em dd/mm/aaaa
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const yyyy = data.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Função para criar parcelamento
async function criarParcelamento(userId, parsed, cartaoInfo = null) {
  const parcelamentoId = gerarIdUnico();
  const valorParcela = parsed.valor / parsed.numParcelas;
  // Evitar timezone: construir Date com componentes locais dd/mm/aaaa
  const [diaStr, mesStr, anoStr] = parsed.data.split('/');
  const dataInicial = new Date(parseInt(anoStr, 10), parseInt(mesStr, 10) - 1, parseInt(diaStr, 10));
  
  let lancamentosCriados = [];
  
  for (let i = 0; i < parsed.numParcelas; i++) {
    const dataParcela = calcularDataFutura(dataInicial, i);
    const descricaoParcela = `${parsed.descricao} (${i + 1}/${parsed.numParcelas})`;
    
    // Calcular data de contabilização se for cartão
    let resultadoContabilizacao = null;
    if (cartaoInfo) {
      resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(
        dataParcela.split('/').reverse().join('-'),
        cartaoInfo.dia_vencimento,
        cartaoInfo.dia_fechamento
      );
    }
    
    const dados = {
      data: dataParcela.split('/').reverse().join('-'),
      tipo: parsed.tipo.toLowerCase(),
      descricao: descricaoParcela,
      valor: valorParcela,
      categoria: parsed.categoria,
      pagamento: parsed.pagamento,
      parcelamento_id: parcelamentoId,
      parcela_atual: i + 1,
      total_parcelas: parsed.numParcelas,
      recorrente: null,
      recorrente_fim: null,
      recorrente_id: null,
      cartao_nome: cartaoInfo ? cartaoInfo.nome_cartao : null,
      data_lancamento: cartaoInfo ? formatarDateParaISO(new Date()) : null,
      data_contabilizacao: cartaoInfo ? formatarDateParaISO(resultadoContabilizacao.dataContabilizacao) : null,
      mes_fatura: cartaoInfo ? resultadoContabilizacao.mesFatura : null,
      ano_fatura: cartaoInfo ? resultadoContabilizacao.anoFatura : null,
      dia_vencimento: cartaoInfo ? cartaoInfo.dia_vencimento : null,
      status_fatura: cartaoInfo ? 'pendente' : null,
      data_vencimento: converterDataParaISO(parsed.dataVencimento)
    };
    
    await lancamentosService.salvarLancamento(userId, dados);
    lancamentosCriados.push({ data: dataParcela, valor: valorParcela, parcela: i + 1 });
  }
  
  return { parcelamentoId, lancamentosCriados };
}

// Função para criar recorrente
async function criarRecorrente(userId, parsed, cartaoInfo = null) {
  const recorrenteId = gerarIdUnico();
  const dataInicial = new Date(parsed.data.split('/').reverse().join('-'));
  const dataFim = calcularDataFutura(dataInicial, parsed.recorrenteMeses - 1);
  
  let lancamentosCriados = [];
  
  for (let i = 0; i < parsed.recorrenteMeses; i++) {
    const dataRecorrente = calcularDataFutura(dataInicial, i);
    
    // Calcular data de contabilização se for cartão
    let resultadoContabilizacao = null;
    if (cartaoInfo) {
      resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(dataRecorrente.split('/').reverse().join('-'), cartaoInfo.dia_vencimento, cartaoInfo.dia_fechamento);
    }
    
    const dados = {
      data: dataRecorrente.split('/').reverse().join('-'),
      tipo: parsed.tipo.toLowerCase(),
      descricao: parsed.descricao,
      valor: parsed.valor,
      categoria: parsed.categoria,
      pagamento: parsed.pagamento,
      parcelamento_id: null,
      parcela_atual: null,
      total_parcelas: null,
      recorrente: true,
      recorrente_fim: dataFim.split('/').reverse().join('-'),
      recorrente_id: recorrenteId,
      cartao_nome: cartaoInfo ? cartaoInfo.nome_cartao : null,
      data_lancamento: cartaoInfo ? formatarDateParaISO(new Date()) : null,
      data_contabilizacao: cartaoInfo ? formatarDateParaISO(resultadoContabilizacao.dataContabilizacao) : null,
      mes_fatura: cartaoInfo ? resultadoContabilizacao.mesFatura : null,
      ano_fatura: cartaoInfo ? resultadoContabilizacao.anoFatura : null,
      dia_vencimento: cartaoInfo ? cartaoInfo.dia_vencimento : null,
      status_fatura: cartaoInfo ? 'pendente' : null,
      data_vencimento: converterDataParaISO(parsed.dataVencimento)
    };
    
    await lancamentosService.salvarLancamento(userId, dados);
    lancamentosCriados.push({ data: dataRecorrente, valor: parsed.valor, mes: i + 1 });
  }
  
  return { recorrenteId, lancamentosCriados };
}

// Função para gerar mensagem de sucesso
async function gerarMensagemSucesso(parsed, cartao = null) {
  const isReceita = parsed.tipo && parsed.tipo.toLowerCase() === 'receita';
  const tipoTexto = isReceita ? 'Receita' : 'Gasto';
  const emoji = isReceita ? '💰' : '💸';
  
  // Mensagem específica para cartão de crédito (tolerante a acentos)
  const pagamentoSemAcentosMsg = removerAcentos((parsed.pagamento || '').toLowerCase());
  if (cartao && !isReceita && (pagamentoSemAcentosMsg.includes('credito') || pagamentoSemAcentosMsg.includes('cartao'))) {
    // Calcular data de contabilização
    const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(parsed.data.split('/').reverse().join('-'), cartao.dia_vencimento, cartao.dia_fechamento);
    const dataContabilizacao = resultadoContabilizacao.dataContabilizacao;
    const dataContabilizacaoFormatada = formatarDateParaISO(dataContabilizacao).split('-').reverse().join('/');
    
    let mensagem = `💳 ${tipoTexto} registrado no cartão ${cartao.nome_cartao}!\n\n`;
    mensagem += `📅 Data: ${parsed.data}\n`;
    mensagem += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
    mensagem += `📂 Categoria: ${parsed.categoria}\n`;
    mensagem += `💳 Pagamento: ${parsed.pagamento}\n`;
    mensagem += `📝 Descrição: ${parsed.descricao}\n`;
    mensagem += `📊 Contabilização: ${dataContabilizacaoFormatada}`;
    return mensagem;
  }
  
  // Mensagem padrão
  let mensagem = `${emoji} ${tipoTexto} registrado com sucesso!\n\n`;
  mensagem += `📅 Data: ${parsed.data}\n`;
  mensagem += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
  mensagem += `📂 Categoria: ${parsed.categoria}\n`;
  
  if (!isReceita) {
    mensagem += `💳 Pagamento: ${parsed.pagamento}\n`;
  }
  
  mensagem += `📝 Descrição: ${parsed.descricao}`;
  
  return mensagem;
}

async function lancamentoCommand(sock, userId, texto) {
  console.log(`[LANCAMENTO] Comando iniciado: userId=${userId}, texto="${texto}"`);
  
  // 1. Fluxo aguardando confirmação da IA
  const estado = await obterEstado(userId);
  if (estado?.etapa === 'aguardando_confirmacao_ia') {
    const parsed = estado.dadosParciais;
    
    const resposta = texto.toLowerCase().trim();
    
    // Verificar se quer alterar categoria
    if (resposta.startsWith('categoria ')) {
      const novaCategoria = resposta.replace('categoria ', '').trim();
      const categoriasValidas = [
        'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Moradia', 
        'Lazer', 'Vestuário', 'Serviços', 'Casa', 'Trabalho', 'Renda', 'Outros'
      ];
      
      if (categoriasValidas.includes(novaCategoria)) {
        parsed.categoria = novaCategoria;
        await sock.sendMessage(userId, {
          text: `✅ Categoria alterada para: ${novaCategoria}\n\n🤖 *Análise da IA:*\n\n💰 Valor: R$ ${formatarValor(parsed.valor)}\n📝 Descrição: ${parsed.descricao}\n📂 Categoria: ${parsed.categoria}\n💳 Pagamento: ${parsed.pagamento === 'NÃO INFORMADO' ? 'Não informado' : parsed.pagamento}\n📅 Data: ${parsed.data}\n\n✅ Confirma o lançamento?\n1. Sim\n2. Não\n\n💡 Para alterar a categoria, digite: "categoria [nova_categoria]"`
        });
        return;
      } else {
        await sock.sendMessage(userId, {
          text: `❌ Categoria inválida. Categorias disponíveis:\n\n${categoriasValidas.map(cat => `• ${cat}`).join('\n')}\n\n💡 Digite: "categoria [nome_da_categoria]"`
        });
        return;
      }
    }
    
    const opcaoConfirmacao = parseInt(resposta, 10);
    if (!isNaN(opcaoConfirmacao)) {
      if (opcaoConfirmacao === 1) {
        // Usuário confirmou; se forma de pagamento não informada, solicitar antes de processar
        if (!parsed.pagamento || parsed.pagamento === 'NÃO INFORMADO' || parsed.faltaFormaPagamento) {
          await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
          await sock.sendMessage(userId, { 
            text: '💳 Qual foi a forma de pagamento?\n\n1. PIX\n2. Dinheiro\n3. Crédito\n4. Débito\n5. Boleto\n6. Transferência\n\nDigite o número da opção:' 
          });
          return;
        }
        // Forma de pagamento presente, processar lançamento
        await limparEstado(userId);
        return await processarLancamento(sock, userId, parsed);
      }
      if (opcaoConfirmacao === 2) {
        await limparEstado(userId);
        await sock.sendMessage(userId, { 
          text: '❌ Lançamento cancelado. Tente novamente com um formato mais claro.' 
        });
        return;
      }
      // Opção inválida
      await sock.sendMessage(userId, { text: '❌ Opção inválida. Digite 1 para Sim ou 2 para Não.' });
      return;
    }
    // Backward compatibility: aceitar textos
    if (resposta === 'sim' || resposta === 's' || resposta === 'yes' || resposta === 'y') {
      // Usuário confirmou; se forma de pagamento não informada, solicitar antes de processar
      if (!parsed.pagamento || parsed.pagamento === 'NÃO INFORMADO' || parsed.faltaFormaPagamento) {
        await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
        await sock.sendMessage(userId, { 
          text: '💳 Qual foi a forma de pagamento?\n\n1. PIX\n2. Dinheiro\n3. Crédito\n4. Débito\n5. Boleto\n6. Transferência\n\nDigite o número da opção:' 
        });
        return;
      }
      // Forma de pagamento presente, processar lançamento
      await limparEstado(userId);
      return await processarLancamento(sock, userId, parsed);
    } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n' || resposta === 'no') {
      await limparEstado(userId);
      await sock.sendMessage(userId, { 
        text: '❌ Lançamento cancelado. Tente novamente com um formato mais claro.' 
      });
      return;
    } else {
      await sock.sendMessage(userId, { text: '❌ Opção inválida. Digite 1 para Sim ou 2 para Não.' });
      return;
    }
  }

  // 2. Fluxo aguardando forma de pagamento
  if (estado?.etapa === 'aguardando_forma_pagamento') {
    const parsed = estado.dadosParciais;
    await limparEstado(userId);
    
    // Validar forma de pagamento
    const formasPagamento = ['pix', 'dinheiro', 'credito', 'debito', 'boleto', 'transferencia'];
    const escolha = parseInt(texto.trim());
    
    if (isNaN(escolha) || escolha < 1 || escolha > formasPagamento.length) {
      await sock.sendMessage(userId, { 
        text: `❌ Opção inválida. Digite um número entre 1 e ${formasPagamento.length}.` 
      });
      return;
    }
    
    parsed.pagamento = formasPagamento[escolha - 1];
    return await processarLancamento(sock, userId, parsed);
  }

  // 2. Fluxo aguardando data de vencimento
  if (estado?.etapa === 'aguardando_data_vencimento') {
    const parsed = estado.dadosParciais;
    await limparEstado(userId);
    
    // Validar data
    const dataRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    if (!dataRegex.test(texto)) {
      await sock.sendMessage(userId, { 
        text: '❌ Data inválida. Use o formato dd/mm/aaaa (ex: 25/10/2025)' 
      });
      return;
    }
    
    parsed.dataVencimento = texto;
    return await processarLancamento(sock, userId, parsed);
  }

  // 3. Fluxo aguardando escolha de cartão
  if (estado?.etapa === 'aguardando_escolha_cartao') {
    const parsed = estado.dadosParciais;
    await limparEstado(userId);
    
    // Verificar se o usuário quer cancelar
    if (texto.toLowerCase() === 'cancelar' || texto === '0') {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Operação cancelada',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Status',
            itens: ['Seleção de cartão cancelada pelo usuário'],
            emoji: '🛑'
          }],
          dicas: [
            { texto: 'Registrar novo lançamento', comando: 'gastei 50 no mercado no pix' },
            { texto: 'Ver ajuda', comando: 'ajuda' },
            { texto: 'Ver cartões', comando: 'cartoes' }
          ]
        })
      });
      return;
    }
    
    const cartoes = await cartoesService.listarCartoesConfigurados(userId);
    const escolha = parseInt(texto) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= cartoes.length) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Opção inválida',
          emojiTitulo: '❌',
          secoes: [{
            titulo: 'Solução',
            itens: [`Digite um número entre 1 e ${cartoes.length} ou "0" para cancelar`],
            emoji: '💡'
          }],
          dicas: [
            { texto: 'Ver cartões disponíveis', comando: 'cartoes' },
            { texto: 'Cancelar operação', comando: '0 ou cancelar' },
            { texto: 'Ver ajuda', comando: 'ajuda' }
          ]
        })
      });
      return;
    }
    
    const cartaoEscolhido = cartoes[escolha];
    console.log('🔔 Cartão escolhido:', cartaoEscolhido);
    
    // Processar com base em parcelamento/recorrente ou simples
    if (parsed.parcelamento && parsed.numParcelas > 1) {
      const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed, cartaoEscolhido);
      await limparEstado(userId);
      let msg = `✅ Parcelamento registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n`;
      msg += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
      msg += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
      msg += `📂 Categoria: ${parsed.categoria}\n`;
      msg += `📝 Descrição: ${parsed.descricao}`;
      await sock.sendMessage(userId, { text: msg });
      return;
    }

    if (parsed.recorrente && parsed.recorrenteMeses > 1) {
      const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartaoEscolhido);
      await limparEstado(userId);
      let msg = `✅ Lançamento recorrente registrado no cartão ${cartaoEscolhido.nome_cartao}!\n\n`;
      msg += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
      msg += `📅 ${parsed.recorrenteMeses} meses\n`;
      msg += `📂 Categoria: ${parsed.categoria}\n`;
      msg += `📝 Descrição: ${parsed.descricao}`;
      await sock.sendMessage(userId, { text: msg });
      return;
    }

    // Gasto simples no cartão
    const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(
      parsed.data.split('/').reverse().join('-'),
      cartaoEscolhido.dia_vencimento,
      cartaoEscolhido.dia_fechamento
    );
    const dados = {
      data: parsed.data.split('/').reverse().join('-'),
      tipo: parsed.tipo.toLowerCase(),
      descricao: parsed.descricao,
      valor: parsed.valor,
      categoria: parsed.categoria,
      pagamento: parsed.pagamento,
      cartao_nome: cartaoEscolhido.nome_cartao,
      data_lancamento: formatarDateParaISO(new Date()),
      data_contabilizacao: formatarDateParaISO(resultadoContabilizacao.dataContabilizacao),
      mes_fatura: resultadoContabilizacao.mesFatura,
      ano_fatura: resultadoContabilizacao.anoFatura,
      dia_vencimento: cartaoEscolhido.dia_vencimento,
      status_fatura: 'pendente',
      data_vencimento: converterDataParaISO(parsed.dataVencimento)
    };
    console.log('🔔 Dados do lançamento:', dados);
    await lancamentosService.salvarLancamento(userId, dados);
    await limparEstado(userId);
    await sock.sendMessage(userId, { text: await gerarMensagemSucesso(parsed, cartaoEscolhido) });
    return;
  }

  // 4. Parsear mensagem
  let parsed = parseMessage(texto);
  const parsedNormal = parsed;
  console.log(`[LANCAMENTO] Parse normal resultado:`, parsed);
  
  // Se o parse normal falhou ou categoria é incerta, tentar com IA
  if (!parsed || !parsed.valor || parsed.categoria === 'Outros' || parsed.confiancaCategoria === 'nenhuma') {
    console.log(`[LANCAMENTO] Parse normal falhou, tentando com IA...`);
    // await sock.sendMessage(userId, { 
    //   text: '🤖 Analisando sua mensagem com IA...' 
    // });
    
    const parsedIA = await analisarLancamentoComIA(userId, texto);
    
    if (parsedIA && parsedIA.valor) {
      console.log('[LANCAMENTO] ✅ IA fallback retornou um parsed válido.');
      
      // Confirmar com o usuário se a IA entendeu corretamente
      await sock.sendMessage(userId, {
        text: `🤖 *Análise da IA:*\n\n💰 Valor: R$ ${formatarValor(parsedIA.valor)}\n📝 Descrição: ${parsedIA.descricao}\n📂 Categoria: ${parsedIA.categoria}\n💳 Pagamento: ${parsedIA.pagamento === 'NÃO INFORMADO' ? 'Não informado' : parsedIA.pagamento}\n📅 Data: ${parsedIA.data}\n\n✅ Confirma o lançamento?\n1. Sim\n2. Não\n\n💡 Para alterar a categoria, digite: "categoria [nova_categoria]"`
      });
      
      // Aguardar confirmação
      await definirEstado(userId, 'aguardando_confirmacao_ia', parsedIA);
      return;
    } else {
      console.log('[LANCAMENTO] ❌ IA indisponível ou sem resposta. Prosseguindo com o entendimento padrão.');
      parsed = parsedNormal;
      // Não retornar aqui: deixa fluir para o processamento normal abaixo
    }
  }
  
  // Se após fallback o parsed ainda não tiver valor, orientar o usuário e interromper
  if (!parsed || !parsed.valor) {
    await sock.sendMessage(userId, { 
      text: '❌ Não consegui entender. Tente usar um formato mais claro:\n\n💡 *Exemplos:*\n• "mercado 50 pix"\n• "gasto 100 com uber no credito"\n• "receita 5000 salario"\n\nDigite *ajuda* para ver todos os comandos.' 
    });
    return;
  }

  // Se chegou aqui, o parser normal funcionou e a IA não será usada
  console.log('[LANCAMENTO] Parser normal entendeu a mensagem. IA não será usada.');

  // 5. Falta forma de pagamento
  if (parsed.faltaFormaPagamento || parsed.pagamento === 'NÃO INFORMADO') {
    await definirEstado(userId, 'aguardando_forma_pagamento', parsed);
    await sock.sendMessage(userId, { 
      text: '💳 Qual foi a forma de pagamento?\n\n1. PIX\n2. Dinheiro\n3. Crédito\n4. Débito\n5. Boleto\n6. Transferência\n\nDigite o número da opção:' 
    });
    return;
  }

  // 6. Boleto sem data de vencimento
  if (parsed.faltaDataVencimento) {
    await definirEstado(userId, 'aguardando_data_vencimento', parsed);
    await sock.sendMessage(userId, { 
      text: '📄 Qual a data de vencimento do boleto? (ex: 25/10/2025)' 
    });
    return;
  }

  // Processar lançamento
  await processarLancamento(sock, userId, parsed);
}

async function processarLancamento(sock, userId, parsed) {
  // Detectar gasto no cartão de crédito
  const pagamentoNormalizado = removerAcentos((parsed.pagamento || '').toLowerCase());
  
  if (parsed.tipo && parsed.tipo.toLowerCase() === 'gasto' && 
      (pagamentoNormalizado.includes('credito') || pagamentoNormalizado.includes('cartao'))) {
    
    const cartoes = await cartoesService.listarCartoesConfigurados(userId);
    
    if (cartoes.length === 0) {
      // Nenhum cartão configurado, registrar como gasto comum
      const dados = {
        data: parsed.data.split('/').reverse().join('-'),
        tipo: parsed.tipo.toLowerCase(),
        descricao: parsed.descricao,
        valor: parsed.valor,
        categoria: parsed.categoria,
        pagamento: parsed.pagamento,
        data_vencimento: converterDataParaISO(parsed.dataVencimento)
      };
      
      await lancamentosService.salvarLancamento(userId, dados);
      await sock.sendMessage(userId, {
        text: await gerarMensagemSucesso(parsed) + `\n\n💡 *Dica:* Para controlar faturas, use "configurar cartao"!`
      });
      return;
    }
    
    if (cartoes.length === 1) {
      // Apenas um cartão, usar automaticamente
      const cartao = cartoes[0];
      
      // Parcelamento
      if (parsed.parcelamento && parsed.numParcelas > 1) {
        const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed, cartao);
        let msg = `✅ Parcelamento registrado no cartão ${cartao.nome_cartao}!\n\n`;
        msg += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
        msg += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
        msg += `📂 Categoria: ${parsed.categoria}\n`;
        msg += `📝 Descrição: ${parsed.descricao}`;
        await sock.sendMessage(userId, { text: msg });
        return;
      }
      
      // Recorrente
      if (parsed.recorrente && parsed.recorrenteMeses > 1) {
        const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartao);
        let msg = `✅ Lançamento recorrente registrado no cartão ${cartao.nome_cartao}!\n\n`;
        msg += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
        msg += `📅 ${parsed.recorrenteMeses} meses\n`;
        msg += `📂 Categoria: ${parsed.categoria}\n`;
        msg += `📝 Descrição: ${parsed.descricao}`;
        await sock.sendMessage(userId, { text: msg });
        return;
      }
      
      // Gasto simples no cartão
      const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(parsed.data.split('/').reverse().join('-'), cartao.dia_vencimento, cartao.dia_fechamento);
      
      const dados = {
        data: parsed.data.split('/').reverse().join('-'),
        tipo: parsed.tipo.toLowerCase(),
        descricao: parsed.descricao,
        valor: parsed.valor,
        categoria: parsed.categoria,
        pagamento: parsed.pagamento,
        cartao_nome: cartao.nome_cartao,
        data_lancamento: formatarDateParaISO(new Date()),
        data_contabilizacao: formatarDateParaISO(resultadoContabilizacao.dataContabilizacao),
        mes_fatura: resultadoContabilizacao.mesFatura,
        ano_fatura: resultadoContabilizacao.anoFatura,
        dia_vencimento: cartao.dia_vencimento,
        status_fatura: 'pendente',
        data_vencimento: converterDataParaISO(parsed.dataVencimento)
      };
      
      await lancamentosService.salvarLancamento(userId, dados);
      await sock.sendMessage(userId, { text: await gerarMensagemSucesso(parsed, cartao) });
      return;
    }
    
    if (cartoes.length > 1) {
      // Múltiplos cartões, pedir para escolher
      console.log('🔔 Múltiplos cartões, pedir para escolher');
      await definirEstado(userId, 'aguardando_escolha_cartao', parsed);
      let msg = formatarMensagem({
        titulo: 'Escolha o Cartão',
        emojiTitulo: '💳',
        secoes: [{
          titulo: 'Cartões Disponíveis',
          itens: cartoes.map((cartao, index) => `${index + 1}. ${cartao.nome_cartao}`),
          emoji: '💳'
        }],
        dicas: [
          { texto: 'Digite o número do cartão', comando: '1, 2, 3...' },
          { texto: 'Cancelar operação', comando: '0 ou cancelar' }
        ],
        ajuda: 'Digite o número do cartão que deseja usar ou "0" para cancelar'
      });
      await sock.sendMessage(userId, { text: msg });
      return;
    }
  }
  
  // Parcelamento sem cartão
  if (parsed.parcelamento && parsed.numParcelas > 1) {
    const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed);
    let msg = `✅ Parcelamento registrado!\n\n`;
    msg += `💰 Valor total: R$ ${formatarValor(parsed.valor)}\n`;
    msg += `📦 ${parsed.numParcelas}x de R$ ${formatarValor(parsed.valor / parsed.numParcelas)}\n`;
    msg += `📂 Categoria: ${parsed.categoria}\n`;
    msg += `📝 Descrição: ${parsed.descricao}`;
    await sock.sendMessage(userId, { text: msg });
    return;
  }
  
  // Recorrente sem cartão
  if (parsed.recorrente && parsed.recorrenteMeses > 1) {
    const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed);
    let msg = `✅ Lançamento recorrente registrado!\n\n`;
    msg += `💰 Valor: R$ ${formatarValor(parsed.valor)}\n`;
    msg += `📅 ${parsed.recorrenteMeses} meses\n`;
    msg += `📂 Categoria: ${parsed.categoria}\n`;
    msg += `📝 Descrição: ${parsed.descricao}`;
    await sock.sendMessage(userId, { text: msg });
    return;
  }
  
  // Lançamento simples
  const dados = {
    data: parsed.data.split('/').reverse().join('-'),
    tipo: parsed.tipo.toLowerCase(),
    descricao: parsed.descricao,
    valor: parsed.valor,
    categoria: parsed.categoria,
    pagamento: parsed.pagamento,
    data_vencimento: converterDataParaISO(parsed.dataVencimento)
  };
  
  await lancamentosService.salvarLancamento(userId, dados);
  await sock.sendMessage(userId, { text: await gerarMensagemSucesso(parsed) });
}

export default lancamentoCommand;
