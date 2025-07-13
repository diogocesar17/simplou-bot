require('dotenv').config();
const { listarCartoesConfigurados } = require('./databaseService.js');

async function verificarCartoes() {
  try {
    console.log('=== VERIFICANDO CARTÕES CONFIGURADOS ===\n');
    
    const cartoes = await listarCartoesConfigurados('556193096344@s.whatsapp.net');
    console.log('Cartões encontrados:', cartoes.length);
    
    if (cartoes.length > 0) {
      console.log('Cartões:');
      cartoes.forEach((cartao, index) => {
        console.log(`${index + 1}. ${cartao.nome_cartao} (vence: ${cartao.dia_vencimento}, fecha: ${cartao.dia_fechamento})`);
      });
    } else {
      console.log('❌ Nenhum cartão configurado!');
      console.log('\n💡 Isso explica por que o lançamento recorrente no crédito não está funcionando.');
      console.log('   Quando não há cartões configurados, o sistema registra como gasto comum (não recorrente).');
    }
    
    console.log('\n=== FIM DA VERIFICAÇÃO ===');
  } catch (error) {
    console.error('Erro ao verificar cartões:', error);
  }
}

verificarCartoes(); 