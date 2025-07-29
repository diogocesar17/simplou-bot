async function ajudaCommand(sock, userId) {
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
      "📦 *Comandos Específicos*\n" +
      "• `parcelados` - Listar parcelamentos ativos\n" +
      "• `recorrentes` / `fixos` - Listar gastos recorrentes/fixos\n" +
      "• `vencimentos` - Próximos vencimentos (30 dias)\n" +
      "• `vencimentos [dias]` - Vencimentos em X dias (ex: vencimentos 7)\n" +
      "• `categoria [nome]` - Gastos por categoria (ex: categoria lazer)\n" +
      "• `valor alto [valor]` - Gastos acima de X reais (ex: valor alto 200)\n\n" +
      "💳 *Gestão de Cartões*\n" +
      "• `configurar cartao` - Cadastrar cartão de crédito\n" +
      "• `editar cartao` - Editar vencimento/fechamento\n" +
      "• `excluir cartao` - Excluir cartão configurado\n" +
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
      "👥 *Gestão de Usuários (apenas admin)*\n" +
      "• `cadastrar 5511999999999 Nome` - Cadastrar novo usuário\n" +
      "• `premium 5511999999999 [dias]` - Promover para premium\n" +
      "• `remover 5511999999999` - Remover usuário\n" +
      "• `usuarios` - Listar todos os usuários\n" +
      "• `status 5511999999999` - Status de usuário específico\n\n" +
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
}

module.exports = ajudaCommand; 