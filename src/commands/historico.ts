// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { definirEstado, limparEstado } from '../configs/stateManager';

async function historicoCommand(sock, userId, texto) {
  const textoLower = texto.toLowerCase().trim();
  // Extrai o possível período após o comando
  const partes = texto.trim().split(/\s+/);
  let mesAno = null;
  let limite = 10; // padrão
  
  if (partes.length > 1) {
    const resto = partes.slice(1).join(' ');
    mesAno = parseMesAno(resto);
    if (mesAno) limite = 20;
  }
  
  // Validar se não é mês futuro (apenas se especificado um mês)
  if (mesAno) {
    const agora = new Date();
    const mesAtual = agora.getMonth() + 1;
    const anoAtual = agora.getFullYear();
    
    if (mesAno.ano > anoAtual || (mesAno.ano === anoAtual && mesAno.mes > mesAtual)) {
      await sock.sendMessage(userId, {
        text: `❌ Não é possível listar histórico de meses futuros.\n\n💡 *Opções disponíveis:*\n• histórico (últimos lançamentos)\n• histórico ${getNomeMes(mesAtual - 1)} (mês atual)\n• histórico ${getNomeMes(mesAtual - 2)} (mês anterior)\n\n📝 *Dica:* Use "histórico" sem especificar mês para ver os últimos lançamentos.`
      });
      return;
    }
  }
  
  let ultimos;
  if (mesAno) {
    ultimos = await lancamentosService.listarLancamentos(userId, limite, mesAno.mes, mesAno.ano);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, { 
        text: `📭 *Nenhum lançamento encontrado*\n\n📅 Período: ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}\n\n💡 *Dica:* Registre seus primeiros lançamentos para ver o histórico!` 
      });
      return;
    }
  } else {
    ultimos = await lancamentosService.listarLancamentos(userId, limite);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, { 
        text: '📭 *Nenhum lançamento encontrado*\n\n💡 *Dica:* Registre seu primeiro lançamento para começar!\n\n💰 *Exemplo:* "Gastei 50 no mercado no dinheiro"' 
      });
      return;
    }
  }
  
  let msgHist = mesAno 
    ? `📋 *Histórico ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}*\n`
    : '📋 *Últimos lançamentos:*\n';
  msgHist += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  ultimos.forEach((l, idx) => {
    const dataBR = (l.data instanceof Date)
      ? l.data.toLocaleDateString('pt-BR')
      : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
          ? new Date(l.data).toLocaleDateString('pt-BR')
          : l.data);
    
    const emojiTipo = l.tipo === 'receita' ? '💰' : '💸';
    
    msgHist += `${idx + 1}. ${emojiTipo} ${dataBR} | R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
    
    // Adicionar informações especiais
    if (l.tipoAgrupamento === 'parcelado') {
      msgHist += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo && l.grupo[0] ? l.grupo[0].valor : 0)}`;
    }
    if (l.tipoAgrupamento === 'recorrente') {
      msgHist += ` | 🔁 Recorrente: ${l.grupo ? l.grupo.length : 0}x`;
    }
    if (l.data_contabilizacao && l.data_contabilizacao !== l.data) {
      const dataContabilizacao = new Date(l.data_contabilizacao).toLocaleDateString('pt-BR');
      msgHist += ` | 📊 Contabilização: ${dataContabilizacao}`;
    }
    
    msgHist += '\n';
    
    if (l.descricao) {
      msgHist += `   📝 ${l.descricao}\n`;
    }
  });
  
  // Salvar lista no estado para permitir exclusão e edição
  await definirEstado(userId, 'historico_exibido', { 
    lista: ultimos, 
    mesAno: mesAno,
    timestamp: Date.now()
  });
  
  let msgFinal = msgHist + '\n';
  msgFinal += `🔧 *Ações disponíveis:*\n`;
  msgFinal += `• Editar <número> - Editar lançamento\n`;
  msgFinal += `• Excluir <número> - Excluir lançamento\n\n`;
  
  if (!mesAno) {
    msgFinal += `💡 *Dicas:*\n`;
    msgFinal += `• Para ver todos os lançamentos de um mês: "Histórico [mês] [ano]"\n`;
    msgFinal += `• Para resumo detalhado: "Resumo detalhado [mês]"\n`;
    msgFinal += `• Para resumo resumido: "Resumo [mês]"\n\n`;
    msgFinal += `📅 *Exemplos:*\n`;
    msgFinal += `• histórico julho 2025\n`;
    msgFinal += `• resumo detalhado agosto\n`;
    msgFinal += `• resumo atual`;
  }
  
  await sock.sendMessage(userId, { text: msgFinal });
}

export default historicoCommand; 