// @ts-nocheck
import { formatarValor } from '../utils/formatUtils';
import { parseMesAno, getNomeMes } from '../utils/dataUtils';
import * as lancamentosService from '../services/lancamentosService';
import { definirEstado, limparEstado } from '../configs/stateManager';
import { formatarMensagem, gerarDicasContextuais } from '../utils/formatMessages';
import { ERROR_MESSAGES } from '../utils/errorMessages';

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
        text: ERROR_MESSAGES.HISTORICO_MES_FUTURO('histórico')
      });
      return;
    }
  }
  
  let ultimos;
  if (mesAno) {
    ultimos = await lancamentosService.listarLancamentos(userId, limite, mesAno.mes, mesAno.ano);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Nenhum lançamento encontrado',
          emojiTitulo: '📭',
          secoes: [
            {
              titulo: 'Período',
              itens: [`${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`],
              emoji: '📅'
            }
          ],
          dicas: gerarDicasContextuais('historico')
        })
      });
      return;
    }
  } else {
    ultimos = await lancamentosService.listarLancamentos(userId, limite);
    if (!ultimos || ultimos.length === 0) {
      await sock.sendMessage(userId, { 
        text: formatarMensagem({
          titulo: 'Nenhum lançamento encontrado',
          emojiTitulo: '📭',
          dicas: gerarDicasContextuais('historico')
        })
      });
      return;
    }
  }
  
  // Salvar lista no estado para permitir exclusão e edição
  await definirEstado(userId, 'historico_exibido', { 
    lista: ultimos, 
    mesAno: mesAno,
    timestamp: Date.now()
  });

  // Formatar lançamentos
  const itensLancamentos = ultimos.map((l, idx) => {
    const dataBR = (l.data instanceof Date)
      ? l.data.toLocaleDateString('pt-BR')
      : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
          ? new Date(l.data).toLocaleDateString('pt-BR')
          : l.data);
    
    const emojiTipo = l.tipo === 'receita' ? '💰' : '💸';
    
    let item = `${idx + 1}. ${emojiTipo} ${dataBR} | R$ ${formatarValor(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
    
    // Adicionar informações especiais
    if (l.tipoAgrupamento === 'parcelado') {
      item += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${formatarValor(l.grupo && l.grupo[0] ? l.grupo[0].valor : 0)}`;
    }
    if (l.tipoAgrupamento === 'recorrente') {
      item += ` | 🔁 Recorrente: ${l.grupo ? l.grupo.length : 0}x`;
    }
    if (l.data_contabilizacao && l.data_contabilizacao !== l.data) {
      const dataContabilizacao = new Date(l.data_contabilizacao).toLocaleDateString('pt-BR');
      item += ` | 📊 Contabilização: ${dataContabilizacao}`;
    }
    
    if (l.descricao) {
      item += `\n   📝 ${l.descricao}`;
    }
    
    return item;
  });

  const titulo = mesAno 
    ? `Histórico ${getNomeMes(mesAno.mes - 1)}/${mesAno.ano}`
    : 'Últimos Lançamentos';

  const dicas = [
    { texto: 'Editar lançamento', comando: 'editar <número>' },
    { texto: 'Excluir lançamento', comando: 'excluir <número>' }
  ];

  if (!mesAno) {
    dicas.push(
      { texto: 'Ver histórico de mês específico', comando: 'historico julho 2024' },
      { texto: 'Ver resumo detalhado', comando: 'resumo detalhado' },
      { texto: 'Ver resumo resumido', comando: 'resumo' }
    );
  }

  await sock.sendMessage(userId, {
    text: formatarMensagem({
      titulo: titulo,
      emojiTitulo: '📋',
      secoes: [
        {
          titulo: 'Lançamentos',
          itens: itensLancamentos,
          emoji: '📊'
        }
      ],
      dicas: dicas
    })
  });
}

export default historicoCommand; 