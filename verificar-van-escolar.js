require('dotenv').config();
const { pool } = require('./databaseService.js');

async function verificarVanEscolar() {
  try {
    const userId = '556193096344@s.whatsapp.net';
    console.log('🔍 Verificando lançamentos da van escolar para o usuário:', userId);
    
    // Buscar todos os lançamentos relacionados à van escolar do usuário específico
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
      WHERE user_id = $1
        AND (descricao ILIKE '%van escolar%'
          OR descricao ILIKE '%van%'
          OR descricao ILIKE '%escolar%')
      ORDER BY data ASC, criado_em ASC
    `;
    
    const result = await pool.query(query, [userId]);
    const lancamentos = result.rows;
    
    console.log(`\n📊 Encontrados ${lancamentos.length} lançamentos relacionados:`);
    
    if (lancamentos.length === 0) {
      console.log('❌ Nenhum lançamento encontrado para van escolar');
      return;
    }
    
    // Agrupar por recorrente_id
    const grupos = {};
    lancamentos.forEach(l => {
      if (l.recorrente_id) {
        if (!grupos[l.recorrente_id]) {
          grupos[l.recorrente_id] = [];
        }
        grupos[l.recorrente_id].push(l);
      } else {
        // Lançamento único
        if (!grupos['unico']) {
          grupos['unico'] = [];
        }
        grupos['unico'].push(l);
      }
    });
    
    console.log('\n=== GRUPOS DE LANÇAMENTOS ===');
    
    Object.keys(grupos).forEach((grupoId, index) => {
      const grupo = grupos[grupoId];
      console.log(`\n--- Grupo ${index + 1} (${grupoId === 'unico' ? 'Lançamento único' : 'Recorrente'}) ---`);
      
      grupo.forEach((lancamento, i) => {
        console.log(`${i + 1}. ID: ${lancamento.id}`);
        console.log(`   Data: ${lancamento.data} (mês ${lancamento.mes}/${lancamento.ano})`);
        console.log(`   Descrição: ${lancamento.descricao}`);
        console.log(`   Valor: R$ ${lancamento.valor}`);
        console.log(`   Categoria: ${lancamento.categoria}`);
        console.log(`   Pagamento: ${lancamento.pagamento}`);
        console.log(`   Recorrente: ${lancamento.recorrente ? 'Sim' : 'Não'}`);
        if (lancamento.recorrente_fim) {
          console.log(`   Fim: ${lancamento.recorrente_fim}`);
        }
        console.log(`   Criado: ${lancamento.criado_em}`);
        console.log('');
      });
    });
    
    // Verificar se há problemas
    console.log('\n=== ANÁLISE DE PROBLEMAS ===');
    
    Object.keys(grupos).forEach((grupoId) => {
      const grupo = grupos[grupoId];
      if (grupo.length > 1) {
        console.log(`\n🔍 Analisando grupo ${grupoId}:`);
        
        // Verificar se todas as parcelas estão no mesmo mês
        const meses = [...new Set(grupo.map(l => `${l.mes}/${l.ano}`))];
        console.log(`   Meses encontrados: ${meses.join(', ')}`);
        
        if (meses.length === 1) {
          console.log(`   ⚠️ PROBLEMA: Todas as parcelas estão no mesmo mês (${meses[0]})`);
        } else {
          console.log(`   ✅ OK: Parcelas distribuídas em ${meses.length} meses diferentes`);
        }
        
        // Verificar se as datas estão em sequência
        const datas = grupo.map(l => l.data).sort();
        console.log(`   Datas: ${datas.join(', ')}`);
        
        // Verificar se há parcelas no mês 12
        const parcelasDezembro = grupo.filter(l => l.mes === 12);
        if (parcelasDezembro.length > 0) {
          console.log(`   📅 Parcelas em dezembro: ${parcelasDezembro.length}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error);
  } finally {
    await pool.end();
  }
}

verificarVanEscolar(); 