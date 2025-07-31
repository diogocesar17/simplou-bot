"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buscarAlertasVencimento = buscarAlertasVencimento;
exports.buscarAlertaPremium = buscarAlertaPremium;
exports.buscarTodosAlertas = buscarTodosAlertas;
exports.temAlertas = temAlertas;
exports.verificarEEnviarAlertasAutomaticos = verificarEEnviarAlertasAutomaticos;
exports.estaNoHorarioAlertas = estaNoHorarioAlertas;
exports.ePrimeiraVerificacaoDoDia = ePrimeiraVerificacaoDoDia;
exports.eVerificacaoFinalDoDia = eVerificacaoFinalDoDia;
const databaseService_1 = require("../../databaseService");
const logger_1 = require("../../logger");
// Cache para controlar alertas já enviados no dia
const alertasEnviadosHoje = new Map();
/**
 * Limpa o cache de alertas enviados (chamado diariamente)
 */
function limparCacheAlertas() {
    const hoje = new Date().toDateString();
    const ultimaLimpeza = alertasEnviadosHoje.get('ultima_limpeza');
    if (!ultimaLimpeza || ultimaLimpeza.toDateString() !== hoje) {
        alertasEnviadosHoje.clear();
        alertasEnviadosHoje.set('ultima_limpeza', new Date());
        logger_1.logger.debug('🧹 Cache de alertas limpo para o novo dia');
    }
}
/**
 * Verifica se um alerta já foi enviado hoje
 * @param userId - ID do usuário
 * @param tipoAlerta - Tipo do alerta (vencimento/premium)
 * @param identificador - Identificador único do alerta
 * @returns True se já foi enviado
 */
function alertaJaEnviado(userId, tipoAlerta, identificador) {
    const chave = `${userId}_${tipoAlerta}_${identificador}`;
    return alertasEnviadosHoje.has(chave);
}
/**
 * Marca um alerta como enviado
 * @param userId - ID do usuário
 * @param tipoAlerta - Tipo do alerta
 * @param identificador - Identificador único do alerta
 */
function marcarAlertaEnviado(userId, tipoAlerta, identificador) {
    const chave = `${userId}_${tipoAlerta}_${identificador}`;
    alertasEnviadosHoje.set(chave, new Date());
}
/**
 * Gera identificador único para alerta de cartão
 * @param cartao - Dados do cartão
 * @returns Identificador único
 */
function gerarIdCartao(cartao) {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    if (cartao.dia_vencimento === diaHoje) {
        return `cartao_hoje_${cartao.nome_cartao}`;
    }
    else {
        const diasRestantes = cartao.dia_vencimento - diaHoje;
        return `cartao_${diasRestantes}dias_${cartao.nome_cartao}`;
    }
}
/**
 * Gera identificador único para alerta de boleto
 * @param boleto - Dados do boleto
 * @returns Identificador único
 */
function gerarIdBoleto(boleto) {
    const hoje = new Date();
    const vencimento = new Date(boleto.data_vencimento);
    const diffTime = vencimento.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        return `boleto_hoje_${boleto.id}`;
    }
    else {
        return `boleto_${diffDays}dias_${boleto.id}`;
    }
}
/**
 * Busca e formata alertas de vencimento para um usuário (com controle de duplicatas)
 * @param userId - ID do usuário
 * @param eLembreteFinal - Se é o lembrete final (11h)
 * @returns Mensagem formatada ou null se não há alertas
 */
async function buscarAlertasVencimento(userId, eLembreteFinal = false) {
    try {
        const alertas = await (0, databaseService_1.buscarAlertasDoDia)(userId);
        if (!alertas.temAlertas) {
            return null;
        }
        let alertasFiltrados = {
            cartoes: [],
            boletos: [],
            temAlertas: false
        };
        // Filtrar cartões não enviados
        for (const cartao of alertas.cartoes) {
            const idCartao = gerarIdCartao(cartao);
            if (!alertaJaEnviado(userId, 'vencimento', idCartao)) {
                alertasFiltrados.cartoes.push(cartao);
                marcarAlertaEnviado(userId, 'vencimento', idCartao);
            }
            else if (eLembreteFinal) {
                // Para lembrete final, incluir mesmo se já foi enviado
                alertasFiltrados.cartoes.push(cartao);
            }
        }
        // Filtrar boletos não enviados
        for (const boleto of alertas.boletos) {
            const idBoleto = gerarIdBoleto(boleto);
            if (!alertaJaEnviado(userId, 'vencimento', idBoleto)) {
                alertasFiltrados.boletos.push(boleto);
                marcarAlertaEnviado(userId, 'vencimento', idBoleto);
            }
            else if (eLembreteFinal) {
                // Para lembrete final, incluir mesmo se já foi enviado
                alertasFiltrados.boletos.push(boleto);
            }
        }
        alertasFiltrados.temAlertas = alertasFiltrados.cartoes.length > 0 || alertasFiltrados.boletos.length > 0;
        if (!alertasFiltrados.temAlertas) {
            return null;
        }
        let mensagem = eLembreteFinal ? "🚨 *LEMBRETE FINAL - VENCIMENTOS*\n\n" : "🚨 *ALERTAS DE VENCIMENTO*\n\n";
        // Alertas de cartões
        if (alertasFiltrados.cartoes.length > 0) {
            mensagem += "*💳 CARTÕES DE CRÉDITO:*\n";
            alertasFiltrados.cartoes.forEach(cartao => {
                const hoje = new Date();
                const diaHoje = hoje.getDate();
                if (cartao.dia_vencimento === diaHoje) {
                    mensagem += `• 🔴 *VENCIMENTO HOJE*: Cartão ${cartao.nome_cartao}\n`;
                }
                else {
                    const diasRestantes = cartao.dia_vencimento - diaHoje;
                    mensagem += `• 🟡 *VENCIMENTO EM ${diasRestantes} DIAS*: Cartão ${cartao.nome_cartao}\n`;
                }
            });
            mensagem += "\n";
        }
        // Alertas de boletos
        if (alertasFiltrados.boletos.length > 0) {
            mensagem += "*📄 BOLETOS:*\n";
            alertasFiltrados.boletos.forEach(boleto => {
                const hoje = new Date();
                const vencimento = new Date(boleto.data_vencimento);
                const diffTime = vencimento.getTime() - hoje.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const valorFormatado = parseFloat(boleto.valor.toString()).toFixed(2);
                if (diffDays === 0) {
                    mensagem += `• 🔴 *VENCIMENTO HOJE*: ${boleto.descricao} - R$ ${valorFormatado}\n`;
                }
                else {
                    mensagem += `• 🟡 *VENCIMENTO EM ${diffDays} DIAS*: ${boleto.descricao} - R$ ${valorFormatado}\n`;
                }
            });
        }
        return mensagem;
    }
    catch (error) {
        logger_1.logger.error('Erro ao buscar alertas de vencimento:', error);
        return null;
    }
}
/**
 * Busca alertas de expiração premium (com controle de duplicatas)
 * @param userId - ID do usuário
 * @param eLembreteFinal - Se é o lembrete final
 * @returns Mensagem de alerta ou null
 */
async function buscarAlertaPremium(userId, eLembreteFinal = false) {
    try {
        const usuariosExpiracao = await (0, databaseService_1.buscarUsuariosPremiumExpiracao)(7);
        const usuario = usuariosExpiracao.find(u => u.user_id === userId);
        if (!usuario) {
            return null;
        }
        const diasRestantes = Math.ceil((new Date(usuario.data_expiracao_premium).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const idPremium = `premium_${diasRestantes}dias_${userId}`;
        // Verificar se já foi enviado
        if (!alertaJaEnviado(userId, 'premium', idPremium) || eLembreteFinal) {
            marcarAlertaEnviado(userId, 'premium', idPremium);
            if (diasRestantes <= 0) {
                return `⚠️ *SEU PLANO PREMIUM EXPIROU*\n\n` +
                    `💎 Seu plano premium expirou hoje.\n` +
                    `🔓 Você foi convertido automaticamente para o plano gratuito.\n` +
                    `💡 Para renovar, entre em contato com o administrador.`;
            }
            return `⚠️ *ALERTA DE EXPIRAÇÃO PREMIUM*\n\n` +
                `💎 Seu plano premium expira em ${diasRestantes} dias.\n` +
                `📅 Data de expiração: ${new Date(usuario.data_expiracao_premium).toLocaleDateString('pt-BR')}\n` +
                `💡 Para renovar, entre em contato com o administrador.`;
        }
        return null;
    }
    catch (error) {
        logger_1.logger.error('Erro ao buscar alerta premium:', error);
        return null;
    }
}
/**
 * Busca todos os alertas para um usuário (vencimentos + premium)
 * @param userId - ID do usuário
 * @param eLembreteFinal - Se é o lembrete final (11h)
 * @returns Mensagem completa ou null
 */
async function buscarTodosAlertas(userId, eLembreteFinal = false) {
    try {
        // Limpar cache se necessário
        limparCacheAlertas();
        const alertaVencimento = await buscarAlertasVencimento(userId, eLembreteFinal);
        const alertaPremium = await buscarAlertaPremium(userId, eLembreteFinal);
        let mensagemCompleta = '';
        if (alertaVencimento) {
            mensagemCompleta += alertaVencimento;
        }
        if (alertaPremium) {
            if (mensagemCompleta) {
                mensagemCompleta += '\n\n' + '─'.repeat(30) + '\n\n';
            }
            mensagemCompleta += alertaPremium;
        }
        return mensagemCompleta || null;
    }
    catch (error) {
        logger_1.logger.error('Erro ao buscar todos os alertas:', error);
        return null;
    }
}
/**
 * Verifica se há alertas para um usuário
 * @param userId - ID do usuário
 * @returns True se há alertas
 */
async function temAlertas(userId) {
    try {
        const alertas = await (0, databaseService_1.buscarAlertasDoDia)(userId);
        const usuariosExpiracao = await (0, databaseService_1.buscarUsuariosPremiumExpiracao)(7);
        const usuarioPremium = usuariosExpiracao.find(u => u.user_id === userId);
        return alertas.temAlertas || !!usuarioPremium;
    }
    catch (error) {
        logger_1.logger.error('Erro ao verificar se há alertas:', error);
        return false;
    }
}
/**
 * Verifica e envia alertas automaticamente para todos os usuários
 * @param sock - Socket do WhatsApp
 * @param eLembreteFinal - Se é o lembrete final (11h)
 * @returns Estatísticas
 */
async function verificarEEnviarAlertasAutomaticos(sock, eLembreteFinal = false) {
    try {
        logger_1.logger.debug(`🔔 Iniciando verificação automática de alertas${eLembreteFinal ? ' (LEMBRETE FINAL)' : ''}...`);
        // Buscar todos os usuários ativos
        const usuarios = await (0, databaseService_1.listarUsuarios)({ ativos: true });
        logger_1.logger.debug(`📊 Verificando alertas para ${usuarios.length} usuários`);
        let enviados = 0;
        let erros = 0;
        // Verificar alertas de cada usuário
        for (const usuario of usuarios) {
            try {
                const alertas = await buscarTodosAlertas(usuario.user_id, eLembreteFinal);
                if (alertas) {
                    await sock.sendMessage(usuario.user_id, { text: alertas });
                    enviados++;
                    logger_1.logger.debug(`✅ Alerta enviado para ${usuario.user_id}`);
                    // Aguardar um pouco para não sobrecarregar
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            catch (error) {
                erros++;
                logger_1.logger.error(`❌ Erro ao enviar alerta para ${usuario.user_id}:`, error);
            }
        }
        logger_1.logger.warn(`🎯 Verificação concluída: ${enviados} alertas enviados, ${erros} erros`);
        return { enviados, erros };
    }
    catch (error) {
        logger_1.logger.error('❌ Erro na verificação automática de alertas:', error);
        return { enviados: 0, erros: 1 };
    }
}
/**
 * Verifica se está no horário de envio de alertas (8h-12h)
 * @returns True se está no horário permitido
 */
function estaNoHorarioAlertas() {
    const agora = new Date();
    const hora = agora.getHours();
    const diaSemana = agora.getDay(); // 0 = domingo, 1 = segunda, etc.
    // Segunda a sexta, entre 8h e 12h
    return diaSemana >= 1 && diaSemana <= 5 && hora >= 8 && hora < 12;
}
/**
 * Verifica se é a primeira verificação do dia (8h)
 * @returns True se é 8h da manhã
 */
function ePrimeiraVerificacaoDoDia() {
    const agora = new Date();
    const hora = agora.getHours();
    const diaSemana = agora.getDay();
    // Segunda a sexta, às 8h
    return diaSemana >= 1 && diaSemana <= 5 && hora === 8;
}
/**
 * Verifica se é a verificação final do dia (11h)
 * @returns True se é 11h da manhã
 */
function eVerificacaoFinalDoDia() {
    const agora = new Date();
    const hora = agora.getHours();
    const diaSemana = agora.getDay();
    // Segunda a sexta, às 11h
    return diaSemana >= 1 && diaSemana <= 5 && hora === 11;
}
//# sourceMappingURL=alertasService.js.map