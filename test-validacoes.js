require('dotenv').config();
const { parseMessage } = require('./messageParser');

function testValidacoes() {
  console.log('🧪 Testando validações de valor...\n');
  
  const testes = [
    // Testes de valores baixos
    'gastei 0.50 no mercado com pix',
    'gastei 0.01 na farmácia com débito',
    'gastei 0.10 no uber com crédito',
    
    // Testes de valores altos
    'gastei 300 no mercado com pix',
    'gastei 1500 na farmácia com débito',
    'gastei 600 no uber com crédito',
    'gastei 6000 no aluguel com boleto',
    
    // Testes de valores extremos
    'gastei 0.001 no mercado com pix',
    'gastei 15000 no aluguel com boleto',
    
    // Testes de categorias específicas
    'gastei 80 no ifood com pix',
    'gastei 150 no uber com crédito',
    'gastei 800 na farmácia com débito',
    
    // Testes de receitas (não devem ter alertas)
    'recebi 5000 salário com crédito',
    'ganhei 10000 freela com pix'
  ];
  
  testes.forEach((teste, index) => {
    console.log(`📊 Teste ${index + 1}: "${teste}"`);
    try {
      const resultado = parseMessage(teste);
      
      if (resultado.error) {
        console.log(`❌ Erro: ${resultado.error}`);
      } else {
        console.log(`✅ Tipo: ${resultado.tipo}`);
        console.log(`💰 Valor: R$ ${resultado.valor.toFixed(2)}`);
        console.log(`📂 Categoria: ${resultado.categoria}`);
        console.log(`💳 Pagamento: ${resultado.pagamento}`);
        
        if (resultado.validacoes && resultado.validacoes.length > 0) {
          console.log(`⚠️ Alertas:`);
          resultado.validacoes.forEach(alerta => {
            console.log(`   ${alerta}`);
          });
        } else {
          console.log(`✅ Sem alertas`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro no teste: ${error.message}`);
    }
    console.log('');
  });
}

testValidacoes(); 