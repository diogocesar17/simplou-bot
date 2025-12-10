/**
 * Utilitário para formatação padronizada de mensagens
 */

interface Secao {
  titulo: string;
  itens: string[];
  emoji?: string;
}

interface Dica {
  texto: string;
  comando?: string;
}

interface MensagemConfig {
  titulo: string;
  secoes?: Secao[];
  dicas?: Dica[];
  ajuda?: string;
  emojiTitulo?: string;
}

/**
 * Gera uma mensagem formatada padronizada
 */
export function formatarMensagem(config: MensagemConfig): string {
  let msg = '';
  
  // Título principal
  const emoji = config.emojiTitulo || '📊';
  msg += `${emoji} *${config.titulo}*\n\n`;
  
  // Seções
  if (config.secoes && config.secoes.length > 0) {
    config.secoes.forEach(secao => {
      const emojiSecao = secao.emoji || '📋';
      msg += `${emojiSecao} *${secao.titulo}:*\n`;
      
      secao.itens.forEach(item => {
        msg += `• ${item}\n`;
      });
      
      msg += '\n';
    });
  }
  
  // Dicas
  if (config.dicas && config.dicas.length > 0) {
    msg += `💡 *Dicas:*\n`;
    config.dicas.forEach(dica => {
      if (dica.comando) {
        msg += `• ${dica.texto} (${dica.comando})\n`;
      } else {
        msg += `• ${dica.texto}\n`;
      }
    });
    msg += '\n';
  }
  
  // Ajuda
  if (config.ajuda) {
    msg += `📚 *Ajuda:* ${config.ajuda}\n`;
  }
  
  return msg.trim();
}

/**
 * Funções auxiliares para formatação específica
 */

/**
 * Formata uma lista simples
 */
export function formatarLista(titulo: string, itens: string[], emoji: string = '📋'): string {
  let msg = `${emoji} *${titulo}:*\n`;
  itens.forEach((item, index) => {
    msg += `${index + 1}. ${item}\n`;
  });
  return msg;
}

/**
 * Formata estatísticas
 */
export function formatarEstatisticas(titulo: string, stats: Record<string, string>, emoji: string = '📊'): string {
  let msg = `${emoji} *${titulo}:*\n`;
  Object.entries(stats).forEach(([key, value]) => {
    msg += `• ${key}: ${value}\n`;
  });
  return msg;
}

/**
 * Formata uma mensagem de sucesso
 */
export function formatarSucesso(titulo: string, detalhes: string[], dica?: string): string {
  let msg = `✅ *${titulo}*\n\n`;
  
  detalhes.forEach(detalhe => {
    msg += `• ${detalhe}\n`;
  });
  
  if (dica) {
    msg += `\n💡 *Dica:* ${dica}`;
  }
  
  return msg;
}

/**
 * Formata uma mensagem de informação
 */
export function formatarInformacao(titulo: string, conteudo: string[], dica?: string): string {
  let msg = `ℹ️ *${titulo}*\n\n`;
  
  conteudo.forEach(item => {
    msg += `• ${item}\n`;
  });
  
  if (dica) {
    msg += `\n💡 *Dica:* ${dica}`;
  }
  
  return msg;
}

/**
 * Formata uma mensagem de instrução
 */
export function formatarInstrucao(titulo: string, passos: string[], exemplo?: string): string {
  let msg = `📝 *${titulo}*\n\n`;
  
  passos.forEach((passo, index) => {
    msg += `${index + 1}️⃣ ${passo}\n`;
  });
  
  if (exemplo) {
    msg += `\n📋 *Exemplo:* ${exemplo}`;
  }
  
  return msg;
}

/**
 * Formata uma mensagem de menu
 */
export function formatarMenu(titulo: string, opcoes: string[], dica?: string): string {
  let msg = `🎯 *${titulo}*\n\n`;
  
  opcoes.forEach((opcao, index) => {
    msg += `${index + 1}️⃣ ${opcao}\n`;
  });
  
  if (dica) {
    msg += `\n💡 *Dica:* ${dica}`;
  }
  
  return msg;
}

/**
 * Formata uma mensagem de confirmação
 */
export function formatarConfirmacao(titulo: string, detalhes: string[], opcoes: string[], tituloDetalhes?: string): string {
  let msg = `🗑️ *${titulo}*\n\n`;
  
  // Título dos detalhes (se fornecido)
  if (tituloDetalhes) {
    msg += `📝 *${tituloDetalhes}:*\n`;
  }
  
  // Detalhes do item
  detalhes.forEach(detalhe => {
    msg += `• ${detalhe}\n`;
  });
  
  msg += `\n⚠️ *Atenção:* Esta ação não pode ser desfeita!\n\n`;
  
  // Opções de confirmação
  msg += `💡 *Confirma a exclusão:*\n`;
  opcoes.forEach((opcao, index) => {
    const emoji = index === 0 ? '✅' : '❌';
    const texto = index === 0 ? 'Confirmar' : 'Cancelar';
    msg += `${emoji} ${index + 1} - ${texto}\n`;
  });
  
  return msg;
} 

/**
 * Formata uma mensagem de cancelamento padronizada e amigável
 */
export function formatarCancelamento(operacao: string, dicas?: Dica[]): string {
  let msg = `🛑 *Operação Cancelada*\n\n`;
  
  msg += `❌ *${operacao}* foi cancelada com sucesso\n\n`;
  
  msg += `💡 *O que você pode fazer agora:*\n`;
  
  if (dicas && dicas.length > 0) {
    dicas.forEach(dica => {
      if (dica.comando) {
        msg += `• ${dica.texto} → \`${dica.comando}\`\n`;
      } else {
        msg += `• ${dica.texto}\n`;
      }
    });
  } else {
    // Dicas padrão se nenhuma for fornecida
    msg += `• Ver ajuda → \`ajuda\`\n`;
    msg += `• Ver histórico → \`historico\`\n`;
    msg += `• Ver resumo → \`resumo\`\n`;
  }
  
  msg += `\n✨ *Dica:* Você pode sempre digitar \`cancelar\` ou \`0\` para sair de qualquer operação`;
  
  return msg;
}

/**
 * Formata um menu com opções de cancelamento padronizadas
 */
export function formatarMenuComCancelamento(titulo: string, opcoes: string[], dica?: string, incluirCancelamento: boolean = true): string {
  let msg = `🎯 *${titulo}*\n\n`;
  
  opcoes.forEach((opcao, index) => {
    msg += `${index + 1}️⃣ ${opcao}\n`;
  });
  
  if (incluirCancelamento) {
    msg += `\n🛑 *Opções de Cancelamento:*\n`;
    msg += `• \`0\` - Cancelar operação\n`;
    msg += `• \`cancelar\` - Cancelar operação\n`;
  }
  
  if (dica) {
    msg += `\n💡 *Dica:* ${dica}`;
  }
  
  return msg;
}

/**
 * Formata uma confirmação com opções de cancelamento padronizadas
 */
export function formatarConfirmacaoComCancelamento(titulo: string, detalhes: string[], opcoes: string[], tituloDetalhes?: string): string {
  let msg = `⚠️ *${titulo}*\n\n`;
  
  // Título dos detalhes (se fornecido)
  if (tituloDetalhes) {
    msg += `📝 *${tituloDetalhes}:*\n`;
  }
  
  // Detalhes do item
  detalhes.forEach(detalhe => {
    msg += `• ${detalhe}\n`;
  });
  
  msg += `\n⚠️ *Atenção:* Esta ação não pode ser desfeita!\n\n`;
  
  // Opções de confirmação
  msg += `💡 *Confirma a operação:*\n`;
  opcoes.forEach((opcao, index) => {
    const emoji = index === 0 ? '✅' : '❌';
    const texto = index === 0 ? 'Confirmar' : 'Cancelar';
    msg += `${emoji} ${index + 1} - ${texto}\n`;
  });
  
  msg += `\n🛑 *Cancelar:* Digite \`0\` ou \`cancelar\`\n`;
  
  return msg;
}

/**
 * Gera dicas contextuais baseadas no comando e estado
 */
export function gerarDicasContextuais(comando: string, contexto?: any): Array<{texto: string, comando: string}> {
  const dicas: Array<{texto: string, comando: string}> = [];
  
  switch (comando.toLowerCase()) {
    case 'excluir':
      dicas.push(
        { texto: 'Ver histórico atualizado', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'editar':
      dicas.push(
        { texto: 'Ver histórico', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'historico':
      dicas.push(
        { texto: 'Editar lançamento', comando: 'editar 1' },
        { texto: 'Excluir lançamento', comando: 'excluir 1' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'resumo':
      dicas.push(
        { texto: 'Ver histórico detalhado', comando: 'historico' },
        { texto: 'Ver gastos por categoria', comando: 'categoria' },
        { texto: 'Ver resumo detalhado', comando: 'resumo detalhado' }
      );
      break;
      
    case 'cartoes':
      dicas.push(
        { texto: 'Configurar novo cartão', comando: 'configurar cartao' },
        { texto: 'Editar cartão', comando: 'editar cartao' },
        { texto: 'Editar pelo número: editar <n>', comando: 'editar 1' },
        { texto: 'Excluir cartão', comando: 'excluir cartao' },
        { texto: 'Excluir pelo número: excluir <n>', comando: 'excluir 1' },
        { texto: 'Ver faturas', comando: 'fatura' }
      );
      break;
      
    case 'configurar cartao':
      dicas.push(
        { texto: 'Ver cartões configurados', comando: 'cartoes' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      );
      break;
      
    case 'fatura':
      dicas.push(
        { texto: 'Ver cartões', comando: 'cartoes' },
        { texto: 'Ver vencimentos', comando: 'vencimentos' }
      );
      break;
      
    case 'categoria':
      dicas.push(
        { texto: 'Ver histórico', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'vencimentos':
      dicas.push(
        { texto: 'Ver faturas', comando: 'fatura' },
        { texto: 'Configurar alertas', comando: 'alertas' }
      );
      break;
      
    case 'parcelados':
      dicas.push(
        { texto: 'Ver histórico', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'recorrentes':
      dicas.push(
        { texto: 'Ver histórico', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'valor alto':
      dicas.push(
        { texto: 'Ver histórico', comando: 'historico' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    case 'backup':
      dicas.push(
        { texto: 'Ver logs do sistema', comando: 'logs' },
        { texto: 'Ver status', comando: 'status' }
      );
      break;
      
    case 'logs':
      dicas.push(
        { texto: 'Gerar backup', comando: 'backup' },
        { texto: 'Ver status', comando: 'status' }
      );
      break;
      
    case 'usuarios':
      dicas.push(
        { texto: 'Ver status do sistema', comando: 'status' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      );
      break;
      
    case 'limpar':
      dicas.push(
        { texto: 'Ver status do sistema', comando: 'status' },
        { texto: 'Ver logs do sistema', comando: 'logs' }
      );
      break;
      
    case 'sugestoes':
      dicas.push(
        { texto: 'Registrar lançamentos', comando: 'mercado 50' },
        { texto: 'Ver histórico', comando: 'historico' }
      );
      break;
      
    case 'relatorio':
      dicas.push(
        { texto: 'Relatório do mês atual', comando: 'relatorio' },
        { texto: 'Relatório de agosto', comando: 'relatorio agosto' },
        { texto: 'Ver resumo do mês', comando: 'resumo' }
      );
      break;
      
    default:
      dicas.push(
        { texto: 'Ver ajuda', comando: 'ajuda' },
        { texto: 'Ver status', comando: 'status' }
      );
  }
  
  return dicas;
}

/**
 * Gera dicas específicas para erros
 */
export function gerarDicasParaErro(tipoErro: string, contexto?: any): Array<{texto: string, comando: string}> {
  const dicas: Array<{texto: string, comando: string}> = [];
  
  switch (tipoErro) {
    case 'estado_invalido_excluir':
      dicas.push(
        { texto: 'Ver histórico primeiro', comando: 'historico' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      );
      break;
      
    case 'estado_invalido_editar':
      dicas.push(
        { texto: 'Ver histórico primeiro', comando: 'historico' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      );
      break;
      
    case 'sem_cartoes':
      dicas.push(
        { texto: 'Configurar primeiro cartão', comando: 'configurar cartao' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      );
      break;
      
    case 'sem_lancamentos':
      dicas.push(
        { texto: 'Registrar primeiro gasto', comando: 'mercado 50' },
        { texto: 'Ver ajuda', comando: 'ajuda' }
      );
      break;
      
    case 'formato_invalido':
      dicas.push(
        { texto: 'Ver ajuda', comando: 'ajuda' },
        { texto: 'Ver exemplos de uso', comando: 'ajuda' }
      );
      break;
      
    case 'mes_futuro':
      dicas.push(
        { texto: 'Usar resumo detalhado', comando: 'resumo detalhado' },
        { texto: 'Ver histórico do mês atual', comando: 'historico' }
      );
      break;
      
    default:
      dicas.push(
        { texto: 'Ver ajuda', comando: 'ajuda' },
        { texto: 'Ver status', comando: 'status' }
      );
  }
  
  return dicas;
}

/**
 * Gera dicas de produtividade baseadas no contexto
 */
export function gerarDicasProdutividade(contexto?: any): Array<{texto: string, comando: string}> {
  const dicas: Array<{texto: string, comando: string}> = [];
  
  // Dicas gerais de produtividade
  dicas.push(
    { texto: 'Configurar alertas para vencimentos', comando: 'alertas' },
    { texto: 'Ver resumo detalhado para planejamento', comando: 'resumo detalhado' }
  );
  
  // Dicas específicas baseadas no contexto (se implementado)
  if (contexto?.temCartoes) {
    dicas.push({ texto: 'Ver faturas dos cartões', comando: 'fatura' });
  }
  
  if (contexto?.temLancamentos) {
    dicas.push({ texto: 'Analisar gastos por categoria', comando: 'categoria' });
  }
  
  return dicas;
}
