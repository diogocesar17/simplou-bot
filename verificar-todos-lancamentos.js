require('dotenv').config();
const { pool } = require('./databaseService.js');

async function verificarTodosLancamentos() {
  try {
    const userId = '556193096344@s.whatsapp.net';
    console.log('🔍 Verificando todos os lançamentos para o usuário:', userId);
    
    // Buscar todos os lançamentos do usuário específico
    const query = `
      SELECT 
        id,
        data,
        tipo,
        descricao,
        valor,
        categoria,
        pagamento,
        recorrente,
        recorrente_id,
        parcelamento_id,
        parcela_atual,
        total_parcelas,
        criado_em,
        EXTRACT(MONTH FROM data) as mes,
        EXTRACT(YEAR FROM data) as ano
      FROM lancamentos 
      WHERE user_id = $1
      ORDER BY criado_em DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query, [userId]);
    const lancamentos = result.rows;
    
    console.log(`\n📊 Total de lançamentos no banco para o usuário: ${lancamentos.length}`);
    
    if (lancamentos.length === 0) {
      console.log('❌ Nenhum lançamento encontrado para este usuário!');
      console.log('💡 Isso pode significar que:');
      console.log('   - O usuário ainda não fez nenhum lançamento');
      console.log('   - Os dados foram perdidos/limpos');
      console.log('   - Há um problema de conexão com o banco');
      return;
    }
    
    console.log('\n=== ÚLTIMOS LANÇAMENTOS ===');
    
    lancamentos.forEach((lancamento, i) => {
      console.log(`\n${i + 1}. ID: ${lancamento.id}`);
      console.log(`   Data: ${lancamento.data} (mês ${lancamento.mes}/${lancamento.ano})`);
      console.log(`   Descrição: ${lancamento.descricao}`);
      console.log(`   Valor: R$ ${lancamento.valor}`);
      console.log(`   Tipo: ${lancamento.tipo}`);
      console.log(`   Categoria: ${lancamento.categoria}`);
      console.log(`   Pagamento: ${lancamento.pagamento}`);
      console.log(`   Recorrente: ${lancamento.recorrente ? 'Sim' : 'Não'}`);
      console.log(`   Parcelamento: ${lancamento.parcelamento_id ? `Sim (${lancamento.parcela_atual}/${lancamento.total_parcelas})` : 'Não'}`);
      console.log(`   Criado: ${lancamento.criado_em}`);
    });
    
    // Estatísticas
    const tipos = [...new Set(lancamentos.map(l => l.tipo))];
    const categorias = [...new Set(lancamentos.map(l => l.categoria))];
    const recorrentes = lancamentos.filter(l => l.recorrente).length;
    const parcelamentos = lancamentos.filter(l => l.parcelamento_id).length;
    
    console.log('\n=== ESTATÍSTICAS ===');
    console.log(`   Tipos: ${tipos.join(', ')}`);
    console.log(`   Categorias: ${categorias.join(', ')}`);
    console.log(`   Recorrentes: ${recorrentes}`);
    console.log(`   Parcelamentos: ${parcelamentos}`);
    
  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error);
  } finally {
    await pool.end();
  }
}

verificarTodosLancamentos(); 