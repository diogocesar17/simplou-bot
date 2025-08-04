// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { formatarMensagem } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

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
            text: ERROR_MESSAGES.FORMATO_INVALIDO('Formato de data', 'resumo detalhado 03/2024', 'resumo detalhado, resumo detalhado agosto, resumo detalhado 12/2024')
        });
        return;
    }

    // NOTA: Resumo detalhado permite meses futuros para planejamento
    // Apenas histórico bloqueia meses futuros

    // Buscar todos os lançamentos do mês
    const todos = await lancamentosService.listarLancamentos(userId, 9999, parsed.mes, parsed.ano);
    if (!todos || todos.length === 0) {
        await sock.sendMessage(userId, { 
            text: formatarMensagem({
                titulo: 'Nenhum lançamento encontrado',
                emojiTitulo: '📭',
                secoes: [
                    {
                        titulo: 'Período',
                        itens: [`${getNomeMes(parsed.mes - 1)}/${parsed.ano}`],
                        emoji: '📅'
                    }
                ],
                dicas: [
                    { texto: 'Registre seus primeiros lançamentos', comando: 'gastei 50 no mercado' },
                    { texto: 'Ver histórico geral', comando: 'historico' }
                ]
            })
        });
        return;
    }

    // Separar entradas e saídas
    const entradas = todos.filter(l => l.tipo === 'receita');
    const saidas = todos.filter(l => l.tipo === 'gasto');

    // Calcular estatísticas por categoria
    const categoriasGastos = {};
    saidas.forEach(l => {
        if (!categoriasGastos[l.categoria]) {
            categoriasGastos[l.categoria] = { total: 0, count: 0 };
        }
        categoriasGastos[l.categoria].total += parseFloat(l.valor);
        categoriasGastos[l.categoria].count += 1;
    });

    // Ordenar categorias por valor total
    const categoriasOrdenadas = Object.entries(categoriasGastos)
        .sort(([,a], [,b]) => b.total - a.total);

    let msg = `📋 *Resumo Detalhado - ${getNomeMes(parsed.mes - 1)}/${parsed.ano}*\n\n`;

    // Estatísticas gerais
    const totalEntradas = entradas.reduce((acc, l) => acc + parseFloat(l.valor), 0);
    const totalSaidas = saidas.reduce((acc, l) => acc + parseFloat(l.valor), 0);
    const saldo = totalEntradas - totalSaidas;
    const totalLancamentos = todos.length;

    msg += `📊 *Estatísticas Gerais:*\n`;
    msg += `💰 Total de Entradas: R$ ${formatarValor(totalEntradas)}\n`;
    msg += `💸 Total de Saídas: R$ ${formatarValor(totalSaidas)}\n`;
    msg += saldo >= 0
        ? `🟢 Saldo: R$ ${formatarValor(saldo)}\n`
        : `🔴 Saldo Negativo: R$ ${formatarValor(saldo)}\n`;
    msg += `📝 Total de Lançamentos: ${totalLancamentos}\n\n`;

    // Top categorias de gastos
    if (categoriasOrdenadas.length > 0) {
        msg += `🏆 *Top Categorias de Gastos:*\n`;
        categoriasOrdenadas.slice(0, 5).forEach(([categoria, dados], idx) => {
            const percentual = ((dados.total / totalSaidas) * 100).toFixed(1);
            msg += `${idx + 1}. ${categoria}: R$ ${formatarValor(dados.total)} (${percentual}%)\n`;
        });
        msg += '\n';
    }

    // Comparação com mês anterior (se disponível)
    if (parsed.mes > 1 || parsed.ano > 2020) {
        const mesAnterior = parsed.mes === 1 ? 12 : parsed.mes - 1;
        const anoAnterior = parsed.mes === 1 ? parsed.ano - 1 : parsed.ano;
        
        const lancamentosAnterior = await lancamentosService.listarLancamentos(userId, 9999, mesAnterior, anoAnterior);
        if (lancamentosAnterior && lancamentosAnterior.length > 0) {
            const saidasAnterior = lancamentosAnterior.filter(l => l.tipo === 'gasto');
            const totalSaidasAnterior = saidasAnterior.reduce((acc, l) => acc + parseFloat(l.valor), 0);
            
            if (totalSaidasAnterior > 0) {
                const variacao = ((totalSaidas - totalSaidasAnterior) / totalSaidasAnterior * 100);
                const emoji = variacao > 0 ? '📈' : variacao < 0 ? '📉' : '➡️';
                const textoVariacao = variacao > 0 ? 'aumentou' : variacao < 0 ? 'diminuiu' : 'manteve-se';
                
                msg += `📊 *Comparação com ${getNomeMes(mesAnterior - 1)}/${anoAnterior}:*\n`;
                msg += `${emoji} Gastos ${textoVariacao} ${Math.abs(variacao).toFixed(1)}%\n`;
                msg += `💸 Mês anterior: R$ ${formatarValor(totalSaidasAnterior)}\n`;
                msg += `💸 Mês atual: R$ ${formatarValor(totalSaidas)}\n\n`;
            }
        }
    }

    // Lista detalhada de lançamentos
    msg += `📝 *Lançamentos Detalhados:*\n\n`;

    const formatLancamento = (l) => {
        const dataBR = (l.data instanceof Date)
            ? l.data.toLocaleDateString('pt-BR')
            : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
                ? new Date(l.data).toLocaleDateString('pt-BR')
                : l.data);
        
        let linha = `📅 ${dataBR} | 💰 R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
        
        // Adicionar informações especiais
        if (l.tipoAgrupamento === 'parcelado') {
            linha += ` | 📦 Parcelado: ${l.total_parcelas}x`;
        }
        if (l.tipoAgrupamento === 'recorrente') {
            linha += ` | 🔁 Recorrente`;
        }
        if (l.data_contabilizacao && l.data_contabilizacao !== l.data) {
            const dataContabilizacao = new Date(l.data_contabilizacao).toLocaleDateString('pt-BR');
            linha += ` | 📊 Contabilização: ${dataContabilizacao}`;
        }
        
        linha += '\n';
        
        if (l.descricao) {
            linha += `   📝 ${l.descricao}\n`;
        }
        
        return linha;
    };

    if (entradas.length > 0) {
        msg += `💰 *Entradas (${entradas.length}):*\n`;
        entradas.forEach(l => msg += formatLancamento(l));
        msg += '\n';
    }
    
    if (saidas.length > 0) {
        msg += `💸 *Saídas (${saidas.length}):*\n`;
        saidas.forEach(l => msg += formatLancamento(l));
        msg += '\n';
    }

    // Dicas e sugestões
    msg += `💡 *Dicas:*\n`;
    if (saldo < 0) {
        msg += `• Seu saldo está negativo. Considere revisar gastos desnecessários.\n`;
    }
    if (categoriasOrdenadas.length > 0 && categoriasOrdenadas[0][1].total > totalSaidas * 0.4) {
        msg += `• ${categoriasOrdenadas[0][0]} representa mais de 40% dos seus gastos.\n`;
    }
    if (totalLancamentos < 5) {
        msg += `• Poucos lançamentos registrados. Mantenha o controle regular!\n`;
    }
    
    await sock.sendMessage(userId, { text: msg });
}

export default resumoDetalhadoCommand;