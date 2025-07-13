require('dotenv').config();
const { pool } = require('./databaseService.js');

async function verificarTodosRecorrentes() {
  try {
    const userId = '556193096344@s.whatsapp.net';
    console.log('🔍 Verificando todos os lançamentos recorrentes para o usuário:', userId);
    
    // Buscar todos os lançamentos recorrentes do usuário específico
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
        recorrente_fim,
        criado_em,
        EXTRACT(MONTH FROM data) as mes,
        EXTRACT(YEAR FROM data) as ano
      FROM lancamentos 
      WHERE user_id = $1 AND recorrente = true
      ORDER BY recorrente_id, data ASC
    `;
    
    const result = await pool.query(query, [userId]);
    const lancamentos = result.rows;
    
    console.log(`\n📊 Encontrados ${lancamentos.length} lançamentos recorrentes:`);
    
    if (lancamentos.length === 0) {
      console.log('❌ Nenhum lançamento recorrente encontrado');
      return;
    }
    
    // Agrupar por recorrente_id
    const grupos = {};
    lancamentos.forEach(l => {
      if (!grupos[l.recorrente_id]) {
        grupos[l.recorrente_id] = [];
      }
      grupos[l.recorrente_id].push(l);
    });
    
    console.log(`\n📋 Total de grupos recorrentes: ${Object.keys(grupos).length}`);
    
    Object.keys(grupos).forEach((grupoId, index) => {
      const grupo = grupos[grupoId];
      console.log(`\n--- Grupo ${index + 1} (ID: ${grupoId}) ---`);
      console.log(`   Descrição: ${grupo[0].descricao}`);
      console.log(`   Valor: R$ ${grupo[0].valor}`);
      console.log(`   Categoria: ${grupo[0].categoria}`);
      console.log(`   Pagamento: ${grupo[0].pagamento}`);
      console.log(`   Total de parcelas: ${grupo.length}`);
      console.log(`   Fim: ${grupo[0].recorrente_fim}`);
      
      // Verificar distribuição por meses
      const meses = [...new Set(grupo.map(l => `${l.mes}/${l.ano}`))];
      console.log(`   Meses: ${meses.join(', ')}`);
      
      if (meses.length === 1) {
        console.log(`   ⚠️ PROBLEMA: Todas as parcelas estão no mesmo mês (${meses[0]})`);
      } else {
        console.log(`   ✅ OK: Parcelas distribuídas em ${meses.length} meses`);
      }
      
      // Mostrar todas as parcelas
      grupo.forEach((lancamento, i) => {
        console.log(`   ${i + 1}. ${lancamento.data} (mês ${lancamento.mes}/${lancamento.ano}) - R$ ${lancamento.valor}`);
      });
    });
    
    // Verificar se há problemas específicos
    console.log('\n=== ANÁLISE DE PROBLEMAS ===');
    
    let problemasEncontrados = 0;
    
    Object.keys(grupos).forEach((grupoId) => {
      const grupo = grupos[grupoId];
      const meses = [...new Set(grupo.map(l => `${l.mes}/${l.ano}`))];
      
      if (meses.length === 1) {
        problemasEncontrados++;
        console.log(`❌ Grupo ${grupoId}: Todas as ${grupo.length} parcelas estão no mês ${meses[0]}`);
        console.log(`   Descrição: ${grupo[0].descricao}`);
        console.log(`   Criado em: ${grupo[0].criado_em}`);
      }
    });
    
    if (problemasEncontrados === 0) {
      console.log('✅ Nenhum problema encontrado - todos os grupos estão distribuídos corretamente');
    } else {
      console.log(`\n⚠️ Total de problemas encontrados: ${problemasEncontrados}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error);
  } finally {
    await pool.end();
  }
}

verificarTodosRecorrentes(); 