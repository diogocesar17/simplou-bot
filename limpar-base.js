require('dotenv').config();
const { pool } = require('./databaseService.js');

async function limparBase() {
  try {
    console.log('🧹 Iniciando limpeza da base de dados...');
    
    // Verificar se DATABASE_URL está configurada
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada. Verifique o arquivo .env');
    }
    
    console.log('🔌 Conectando ao banco...');
    
    // Conectar ao banco
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    // Limpar todas as tabelas
    console.log('🗑️ Removendo todos os dados...');
    
    // Limpar logs de auditoria
    await client.query('DELETE FROM logs_auditoria');
    console.log('✅ Logs de auditoria removidos');
    
    // Limpar configurações de cartões
    await client.query('DELETE FROM cartoes_config');
    console.log('✅ Configurações de cartões removidas');
    
    // Limpar todos os lançamentos
    await client.query('DELETE FROM lancamentos');
    console.log('✅ Todos os lançamentos removidos');
    
    // Resetar sequências (se houver)
    try {
      await client.query('ALTER SEQUENCE IF EXISTS lancamentos_id_seq RESTART WITH 1');
      console.log('✅ Sequências resetadas');
    } catch (error) {
      console.log('ℹ️ Nenhuma sequência para resetar');
    }
    
    // Verificar se as tabelas estão vazias
    const lancamentosCount = await client.query('SELECT COUNT(*) as total FROM lancamentos');
    const cartoesCount = await client.query('SELECT COUNT(*) as total FROM cartoes_config');
    const logsCount = await client.query('SELECT COUNT(*) as total FROM logs_auditoria');
    
    console.log('\n📊 Status após limpeza:');
    console.log(`   • Lançamentos: ${lancamentosCount.rows[0].total}`);
    console.log(`   • Cartões configurados: ${cartoesCount.rows[0].total}`);
    console.log(`   • Logs de auditoria: ${logsCount.rows[0].total}`);
    
    client.release();
    console.log('\n✅ Base de dados limpa com sucesso!');
    console.log('🎯 Você pode começar a testar do zero.');
    
  } catch (error) {
    console.error('❌ Erro ao limpar base de dados:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Executar limpeza
limparBase().catch(console.error); 