"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
// Comando de lançamento centralizado
const parseUtils_1 = require("../utils/parseUtils");
const lancamentosService = __importStar(require("../services/lancamentosService"));
const cartoesService = __importStar(require("../services/cartoesService"));
const formatUtils_1 = require("../utils/formatUtils");
const dataUtils_1 = require("../utils/dataUtils");
const stateManager_1 = require("../configs/stateManager");
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
// Função para criar parcelamento
async function criarParcelamento(userId, parsed, cartaoInfo = null) {
    const parcelamentoId = gerarIdUnico();
    const valorParcela = parsed.valor / parsed.numParcelas;
    const dataInicial = new Date(parsed.data.split('/').reverse().join('-'));
    let lancamentosCriados = [];
    for (let i = 0; i < parsed.numParcelas; i++) {
        const dataParcela = calcularDataFutura(dataInicial, i);
        const descricaoParcela = `${parsed.descricao} (${i + 1}/${parsed.numParcelas})`;
        // Calcular data de contabilização se for cartão
        let resultadoContabilizacao = null;
        if (cartaoInfo) {
            resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(dataParcela.split('/').reverse().join('-'), cartaoInfo.dia_vencimento, cartaoInfo.dia_fechamento);
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
            data_lancamento: cartaoInfo ? new Date().toISOString().split('T')[0] : null,
            data_contabilizacao: cartaoInfo ? resultadoContabilizacao.dataContabilizacao.toISOString().split('T')[0] : null,
            mes_fatura: cartaoInfo ? resultadoContabilizacao.mesFatura : null,
            ano_fatura: cartaoInfo ? resultadoContabilizacao.anoFatura : null,
            dia_vencimento: cartaoInfo ? cartaoInfo.dia_vencimento : null,
            status_fatura: cartaoInfo ? 'pendente' : null,
            data_vencimento: (0, dataUtils_1.converterDataParaISO)(parsed.dataVencimento)
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
            data_lancamento: cartaoInfo ? new Date().toISOString().split('T')[0] : null,
            data_contabilizacao: cartaoInfo ? resultadoContabilizacao.dataContabilizacao.toISOString().split('T')[0] : null,
            mes_fatura: cartaoInfo ? resultadoContabilizacao.mesFatura : null,
            ano_fatura: cartaoInfo ? resultadoContabilizacao.anoFatura : null,
            dia_vencimento: cartaoInfo ? cartaoInfo.dia_vencimento : null,
            status_fatura: cartaoInfo ? 'pendente' : null,
            data_vencimento: (0, dataUtils_1.converterDataParaISO)(parsed.dataVencimento)
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
    // Mensagem específica para cartão de crédito
    if (cartao && !isReceita && (parsed.pagamento?.toLowerCase().includes('credito') || parsed.pagamento?.toLowerCase().includes('cartao'))) {
        // Calcular data de contabilização
        const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(parsed.data.split('/').reverse().join('-'), cartao.dia_vencimento, cartao.dia_fechamento);
        const dataContabilizacao = resultadoContabilizacao.dataContabilizacao;
        const dataContabilizacaoFormatada = dataContabilizacao.toISOString().split('T')[0].split('-').reverse().join('/');
        let mensagem = `💳 ${tipoTexto} registrado no cartão ${cartao.nome_cartao}!\n\n`;
        mensagem += `📅 Data: ${parsed.data}\n`;
        mensagem += `💰 Valor: R$ ${(0, formatUtils_1.formatarValor)(parsed.valor)}\n`;
        mensagem += `📂 Categoria: ${parsed.categoria}\n`;
        mensagem += `💳 Pagamento: ${parsed.pagamento}\n`;
        mensagem += `📝 Descrição: ${parsed.descricao}\n`;
        mensagem += `📊 Contabilização: ${dataContabilizacaoFormatada}`;
        return mensagem;
    }
    // Mensagem padrão
    let mensagem = `${emoji} ${tipoTexto} registrado com sucesso!\n\n`;
    mensagem += `📅 Data: ${parsed.data}\n`;
    mensagem += `💰 Valor: R$ ${(0, formatUtils_1.formatarValor)(parsed.valor)}\n`;
    mensagem += `📂 Categoria: ${parsed.categoria}\n`;
    if (!isReceita) {
        mensagem += `💳 Pagamento: ${parsed.pagamento}\n`;
    }
    mensagem += `📝 Descrição: ${parsed.descricao}`;
    return mensagem;
}
async function lancamentoCommand(sock, userId, texto) {
    // 1. Fluxo aguardando forma de pagamento
    const estado = await (0, stateManager_1.obterEstado)(userId);
    if (estado?.etapa === 'aguardando_forma_pagamento') {
        const parsed = estado.dadosParciais;
        await (0, stateManager_1.limparEstado)(userId);
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
        await (0, stateManager_1.limparEstado)(userId);
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
        await (0, stateManager_1.limparEstado)(userId);
        const cartoes = await cartoesService.listarCartoesConfigurados(userId);
        const escolha = parseInt(texto) - 1;
        if (isNaN(escolha) || escolha < 0 || escolha >= cartoes.length) {
            await sock.sendMessage(userId, {
                text: `❌ Opção inválida. Escolha um número entre 1 e ${cartoes.length}`
            });
            return;
        }
        const cartaoEscolhido = cartoes[escolha];
        console.log('🔔 Cartão escolhido:', cartaoEscolhido);
        // Processar lançamento com o cartão escolhido
        const resultadoContabilizacao = await cartoesService.calcularDataContabilizacao(parsed.data.split('/').reverse().join('-'), cartaoEscolhido.dia_vencimento, cartaoEscolhido.dia_fechamento);
        const dados = {
            data: parsed.data.split('/').reverse().join('-'),
            tipo: parsed.tipo.toLowerCase(),
            descricao: parsed.descricao,
            valor: parsed.valor,
            categoria: parsed.categoria,
            pagamento: parsed.pagamento,
            cartao_nome: cartaoEscolhido.nome_cartao,
            data_lancamento: new Date().toISOString().split('T')[0],
            data_contabilizacao: resultadoContabilizacao.dataContabilizacao.toISOString().split('T')[0],
            mes_fatura: resultadoContabilizacao.mesFatura,
            ano_fatura: resultadoContabilizacao.anoFatura,
            dia_vencimento: cartaoEscolhido.dia_vencimento,
            status_fatura: 'pendente',
            data_vencimento: (0, dataUtils_1.converterDataParaISO)(parsed.dataVencimento)
        };
        console.log('🔔 Dados do lançamento:', dados);
        await lancamentosService.salvarLancamento(userId, dados);
        await (0, stateManager_1.limparEstado)(userId);
        await sock.sendMessage(userId, { text: await gerarMensagemSucesso(parsed, cartaoEscolhido) });
        return;
    }
    // 4. Parsear mensagem
    const parsed = (0, parseUtils_1.parseMessage)(texto);
    if (!parsed || !parsed.valor) {
        await sock.sendMessage(userId, { text: '❌ Não entendi. Digite *ajuda* para ver os comandos.' });
        return;
    }
    // 5. Falta forma de pagamento
    if (parsed.faltaFormaPagamento || parsed.pagamento === 'NÃO INFORMADO') {
        await (0, stateManager_1.definirEstado)(userId, 'aguardando_forma_pagamento', parsed);
        await sock.sendMessage(userId, {
            text: '💳 Qual foi a forma de pagamento?\n\n1. PIX\n2. Dinheiro\n3. Crédito\n4. Débito\n5. Boleto\n6. Transferência\n\nDigite o número da opção:'
        });
        return;
    }
    // 6. Boleto sem data de vencimento
    if (parsed.faltaDataVencimento) {
        await (0, stateManager_1.definirEstado)(userId, 'aguardando_data_vencimento', parsed);
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
    const pagamentoNormalizado = (parsed.pagamento || '').toLowerCase();
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
                data_vencimento: (0, dataUtils_1.converterDataParaISO)(parsed.dataVencimento)
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
                msg += `💰 Valor total: R$ ${(0, formatUtils_1.formatarValor)(parsed.valor)}\n`;
                msg += `📦 ${parsed.numParcelas}x de R$ ${(0, formatUtils_1.formatarValor)(parsed.valor / parsed.numParcelas)}\n`;
                msg += `📂 Categoria: ${parsed.categoria}\n`;
                msg += `📝 Descrição: ${parsed.descricao}`;
                await sock.sendMessage(userId, { text: msg });
                return;
            }
            // Recorrente
            if (parsed.recorrente && parsed.recorrenteMeses > 1) {
                const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed, cartao);
                let msg = `✅ Lançamento recorrente registrado no cartão ${cartao.nome_cartao}!\n\n`;
                msg += `💰 Valor: R$ ${(0, formatUtils_1.formatarValor)(parsed.valor)}\n`;
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
                data_lancamento: new Date().toISOString().split('T')[0],
                data_contabilizacao: resultadoContabilizacao.dataContabilizacao.toISOString().split('T')[0],
                mes_fatura: resultadoContabilizacao.mesFatura,
                ano_fatura: resultadoContabilizacao.anoFatura,
                dia_vencimento: cartao.dia_vencimento,
                status_fatura: 'pendente',
                data_vencimento: (0, dataUtils_1.converterDataParaISO)(parsed.dataVencimento)
            };
            await lancamentosService.salvarLancamento(userId, dados);
            await sock.sendMessage(userId, { text: await gerarMensagemSucesso(parsed, cartao) });
            return;
        }
        if (cartoes.length > 1) {
            // Múltiplos cartões, pedir para escolher
            console.log('🔔 Múltiplos cartões, pedir para escolher');
            await (0, stateManager_1.definirEstado)(userId, 'aguardando_escolha_cartao', parsed);
            let msg = `💳 *Escolha o cartão:*\n\n`;
            cartoes.forEach((cartao, index) => {
                msg += `${index + 1}. ${cartao.nome_cartao}\n`;
            });
            msg += `\nDigite o número do cartão:`;
            await sock.sendMessage(userId, { text: msg });
            return;
        }
    }
    // Parcelamento sem cartão
    if (parsed.parcelamento && parsed.numParcelas > 1) {
        const { parcelamentoId, lancamentosCriados } = await criarParcelamento(userId, parsed);
        let msg = `✅ Parcelamento registrado!\n\n`;
        msg += `💰 Valor total: R$ ${(0, formatUtils_1.formatarValor)(parsed.valor)}\n`;
        msg += `📦 ${parsed.numParcelas}x de R$ ${(0, formatUtils_1.formatarValor)(parsed.valor / parsed.numParcelas)}\n`;
        msg += `📂 Categoria: ${parsed.categoria}\n`;
        msg += `📝 Descrição: ${parsed.descricao}`;
        await sock.sendMessage(userId, { text: msg });
        return;
    }
    // Recorrente sem cartão
    if (parsed.recorrente && parsed.recorrenteMeses > 1) {
        const { recorrenteId, lancamentosCriados } = await criarRecorrente(userId, parsed);
        let msg = `✅ Lançamento recorrente registrado!\n\n`;
        msg += `💰 Valor: R$ ${(0, formatUtils_1.formatarValor)(parsed.valor)}\n`;
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
        data_vencimento: (0, dataUtils_1.converterDataParaISO)(parsed.dataVencimento)
    };
    await lancamentosService.salvarLancamento(userId, dados);
    await sock.sendMessage(userId, { text: await gerarMensagemSucesso(parsed) });
}
exports.default = lancamentoCommand;
//# sourceMappingURL=lancamento.js.map