const { formatarValor } = require('../utils/formatUtils');
const { parseMesAno, getNomeMes } = require('../utils/dataUtils');
const lancamentosService = require('../services/lancamentosService');

async function resumoDetalhadoCommand(sock, userId, texto) {
    const textoLower = texto.toLowerCase().trim();
    let mesAno = textoLower.replace("resumo detalhado", "").trim();
    let parsed;
    if (!mesAno || mesAno === "do mes atual" || mesAno === "do mês atual" || mesAno === "mes atual" || mesAno === "mês atual" || mesAno === "atual" || mesAno === "deste mes" || mesAno === "deste mês" || mesAno === "deste mes atual" || mesAno === "deste mês atual") {
        const agora = new Date();
        parsed = { mes: agora.getMonth() + 1, ano: agora.getFullYear() };
    } else {
        parsed = parseMesAno(mesAno);
    }
    if (!parsed) {
        await sock.sendMessage(userId, {
        text: '❌ Formato inválido. Use:\n• resumo detalhado (mês atual)\n• resumo detalhado agosto\n• resumo detalhado 03/2024\n\n💡 *Variações aceitas:*\n• resumo detalhado do mes atual\n• resumo detalhado agosto 2023'
        });
        return;
    }
    // Buscar todos os lançamentos do mês
    const todos = await lancamentosService.listarLancamentos(userId, 9999, parsed.mes, parsed.ano);
    if (!todos || todos.length === 0) {
        await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para ${getNomeMes(parsed.mes - 1)}/${parsed.ano}.` });
        return;
    }
    // Separar entradas e saídas
    const entradas = todos.filter(l => l.tipo === 'receita');
    const saidas = todos.filter(l => l.tipo === 'gasto');
    let msg = `📋 *Resumo Detalhado - ${getNomeMes(parsed.mes - 1)}/${parsed.ano}*\n\n`;

    const formatLancamento = (l) => {
        const dataBR = (l.data instanceof Date)
        ? l.data.toLocaleDateString('pt-BR')
        : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
            ? new Date(l.data).toLocaleDateString('pt-BR')
            : l.data);
        let linha = `📅 ${dataBR} | ${l.categoria} | 💳 ${l.pagamento} | R$ ${formatarValor(l.valor)}\n`;
        if (l.descricao) linha += `🧾 ${l.descricao}\n`;
        return linha;
    };
    
    if (entradas.length > 0) {
        msg += `💰 *Entradas:*\n`;
        entradas.forEach(l => msg += formatLancamento(l));
        msg += '\n';
    }
    if (saidas.length > 0) {
        msg += `💸 *Saídas:*\n`;
        saidas.forEach(l => msg += formatLancamento(l));
        msg += '\n';
    }
    
    // Totais
    const totalEntradas = entradas.reduce((acc, l) => acc + parseFloat(l.valor), 0);
    const totalSaidas = saidas.reduce((acc, l) => acc + parseFloat(l.valor), 0);
    const saldo = totalEntradas - totalSaidas;
    
    msg += `📊 *Resumo Final:*\n`;
    msg += `💰 Total de Entradas: R$ ${formatarValor(totalEntradas)}\n`;
    msg += `💸 Total de Saídas: R$ ${formatarValor(totalSaidas)}\n`;
    msg += saldo >= 0
        ? `🟢 Saldo: R$ ${formatarValor(saldo)}`
        : `🔴 Saldo Negativo: R$ ${formatarValor(saldo)}`;
    
    await sock.sendMessage(userId, { text: msg });
    
    return;
}

module.exports = resumoDetalhadoCommand;