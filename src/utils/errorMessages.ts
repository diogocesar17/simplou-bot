// @ts-nocheck

/**
 * Utilitário para padronizar mensagens de erro
 */

interface ErrorConfig {
  titulo: string;
  causa?: string;
  solucao?: string;
  exemplo?: string;
  dica?: string;
}

/**
 * Gera uma mensagem de erro padronizada
 */
export function gerarMensagemErro(config: ErrorConfig): string {
  let msg = `❌ *${config.titulo}*\n\n`;
  
  if (config.causa) {
    msg += `🔍 *Causa:* ${config.causa}\n`;
  }
  
  if (config.solucao) {
    msg += `💡 *Solução:* ${config.solucao}\n`;
  }
  
  if (config.exemplo) {
    msg += `📋 *Exemplo:* ${config.exemplo}\n`;
  }
  
  if (config.dica) {
    msg += `💡 *Dica:* ${config.dica}\n`;
  }
  
  return msg;
}

/**
 * Mensagens de erro pré-definidas para casos comuns
 */
export const ERROR_MESSAGES = {
  // Erros de formato
  FORMATO_INVALIDO: (comando: string, exemplo: string) => gerarMensagemErro({
    titulo: 'Formato inválido',
    causa: 'O formato do comando não está correto',
    solucao: `Use o formato correto para ${comando}`,
    exemplo: exemplo,
    dica: comando.includes('excluir') ? 
      'Use "historico" primeiro, depois "excluir 1"' : 
      'Digite "ajuda" para ver todos os comandos disponíveis'
  }),

  // Erros de dados não encontrados
  DADOS_NAO_ENCONTRADOS: (tipo: string, periodo?: string) => gerarMensagemErro({
    titulo: `${tipo} não encontrado`,
    causa: periodo ? `Nenhum ${tipo.toLowerCase()} encontrado para ${periodo}` : `Nenhum ${tipo.toLowerCase()} encontrado`,
    solucao: 'Registre alguns dados primeiro',
    exemplo: tipo === 'Lançamento' ? 'gastei 50 no mercado no pix' : 'configurar cartão',
    dica: tipo === 'Lançamento' ? 
      'Registre seu primeiro gasto com "mercado 50" ou "uber 25"' : 
      'Configure seu primeiro cartão com "configurar cartao"'
  }),

  // Erros de validação
  VALOR_INVALIDO: (campo: string, formato?: string) => gerarMensagemErro({
    titulo: `${campo} inválido`,
    causa: `O valor informado para ${campo.toLowerCase()} não é válido`,
    solucao: `Digite um ${campo.toLowerCase()} válido`,
    exemplo: formato || 'Exemplo de formato válido',
    dica: 'Verifique se o formato está correto'
  }),

  // Erros de permissão
  SEM_PERMISSAO: (acao: string) => gerarMensagemErro({
    titulo: 'Sem permissão',
    causa: `Você não tem permissão para ${acao}`,
    solucao: 'Entre em contato com o administrador',
    dica: 'Apenas usuários premium podem executar esta ação'
  }),

  // Erros de banco de dados
  ERRO_BANCO: (operacao: string) => gerarMensagemErro({
    titulo: 'Erro no banco de dados',
    causa: `Falha ao ${operacao}`,
    solucao: 'Tente novamente em alguns instantes',
    dica: 'Se o problema persistir, entre em contato com o suporte'
  }),

  // Erros internos do sistema
  ERRO_INTERNO: (operacao: string, solucao: string) => gerarMensagemErro({
    titulo: 'Erro interno do sistema',
    causa: `Falha ao ${operacao}`,
    solucao: solucao,
    dica: 'Se o problema persistir, entre em contato com o suporte'
  }),

  // Erros de estado
  ESTADO_INVALIDO: (acao: string) => gerarMensagemErro({
    titulo: 'Estado inválido',
    causa: `Não é possível ${acao} no momento atual`,
    solucao: 'Complete a operação anterior ou digite "cancelar"',
    dica: acao.includes('excluir') || acao.includes('editar') ? 
      'Use "histórico" primeiro para ver os lançamentos disponíveis' : 
      'Use "cancelar" para sair da operação atual'
  }),

  // Erros de mês futuro
  MES_FUTURO: (comando: string) => gerarMensagemErro({
    titulo: 'Mês futuro não permitido',
    causa: `Não é possível ${comando} para meses futuros`,
    solucao: 'Use um mês passado ou atual',
    exemplo: `${comando} agosto`,
    dica: 'Use o mês atual ou meses anteriores'
  }),

  // Erros de mês futuro para histórico (com dica sobre resumo detalhado)
  HISTORICO_MES_FUTURO: (comando: string) => gerarMensagemErro({
    titulo: 'Mês futuro não permitido',
    causa: `Não é possível ${comando} para meses futuros`,
    solucao: 'Use um mês passado ou atual',
    exemplo: `${comando} agosto`,
    dica: 'Para visualizar meses futuros, use "resumo detalhado <mês>"'
  }),

  // Erros de cartão
  CARTAO_NAO_ENCONTRADO: (nomeCartao: string) => gerarMensagemErro({
    titulo: 'Cartão não encontrado',
    causa: `O cartão "${nomeCartao}" não está configurado`,
    solucao: 'Configure o cartão primeiro ou verifique o nome',
    exemplo: 'configurar cartão',
    dica: 'Use "cartões" para ver seus cartões configurados'
  }),

  // Erros de lançamento
  LANCAMENTO_NAO_ENCONTRADO: (id: string) => gerarMensagemErro({
    titulo: 'Lançamento não encontrado',
    causa: `O lançamento ${id} não foi encontrado`,
    solucao: 'Use "histórico" para ver os lançamentos disponíveis',
    exemplo: 'histórico',
    dica: 'Os números dos lançamentos mudam a cada consulta'
  }),

  // Erros de operação cancelada
  OPERACAO_CANCELADA: (operacao: string) => gerarMensagemErro({
    titulo: `${operacao} cancelada`,
    causa: 'Você cancelou a operação',
    solucao: 'Digite o comando novamente se desejar continuar',
    dica: 'Use "ajuda" para ver todos os comandos disponíveis'
  }),

  // Nova mensagem de cancelamento mais amigável
  CANCELAMENTO_AMIGAVEL: (operacao: string, dicas?: string[]) => {
    let msg = `🛑 *${operacao} Cancelada*\n\n`;
    msg += `✅ Operação cancelada com sucesso!\n\n`;
    
    if (dicas && dicas.length > 0) {
      msg += `💡 *O que você pode fazer agora:*\n`;
      dicas.forEach(dica => {
        msg += `• ${dica}\n`;
      });
    } else {
      msg += `💡 *O que você pode fazer agora:*\n`;
      msg += `• Ver ajuda → \`ajuda\`\n`;
      msg += `• Ver histórico → \`historico\`\n`;
      msg += `• Ver resumo → \`resumo\`\n`;
    }
    
    msg += `\n✨ *Dica:* Você pode sempre digitar \`cancelar\` ou \`0\` para sair de qualquer operação`;
    
    return msg;
  }
};

/**
 * Mensagens de sucesso padronizadas
 */
export const SUCCESS_MESSAGES = {
  LANCAMENTO_SALVO: (valor: string, categoria: string) => 
    `✅ *Lançamento salvo com sucesso!*\n\n💰 Valor: R$ ${valor}\n📂 Categoria: ${categoria}\n\n💡 Use "histórico" para ver seus lançamentos`,

  CARTAO_CONFIGURADO: (nome: string, vencimento: number, fechamento?: number) => 
    `✅ *Cartão configurado com sucesso!*\n\n💳 ${nome}\n📅 Vencimento: dia ${vencimento}${fechamento ? `\n📅 Fechamento: dia ${fechamento}` : ''}\n\n💡 Use "cartões" para ver todos os cartões`,

  LANCAMENTO_EXCLUIDO: (valor: string, categoria: string) => 
    `✅ *Lançamento excluído com sucesso!*\n\n💰 Valor: R$ ${valor}\n📂 Categoria: ${categoria}\n\n💡 Use "histórico" para ver seus lançamentos`,

  CARTAO_EXCLUIDO: (nome: string) => 
    `✅ *Cartão excluído com sucesso!*\n\n💳 ${nome}\n\n💡 Use "cartões" para ver seus cartões restantes`,

  LANCAMENTO_EDITADO: (campo: string, valor: string) => 
    `✅ *Lançamento editado com sucesso!*\n\n📝 ${campo}: ${valor}\n\n💡 Use "histórico" para ver seus lançamentos`
};