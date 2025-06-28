const { Pool } = require('pg');

// Configuração da conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Inicializar tabelas se não existirem
async function initializeDatabase() {
  try {
    console.log('🔌 Tentando conectar ao PostgreSQL...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada. Verifique as variáveis de ambiente.');
    }
    
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso');
    
    // Criar tabela de lançamentos
    await client.query(`
      CREATE TABLE IF NOT EXISTS lancamentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        data DATE NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'gasto')),
        descricao TEXT,
        valor DECIMAL(10,2) NOT NULL,
        categoria VARCHAR(50),
        pagamento VARCHAR(20),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índices para melhor performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id ON lancamentos(user_id);
      CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
      CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos(categoria);
    `);

    client.release();
    console.log('✅ Banco de dados inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    console.error('🔍 Verifique se:');
    console.error('   - DATABASE_URL está configurada');
    console.error('   - PostgreSQL está rodando');
    console.error('   - Credenciais estão corretas');
    throw error;
  }
}

function formatarDataParaISO(dataBR) {
  if (!dataBR) return null;
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// Funções para operações CRUD
async function appendRowToDatabase(userId, values) {
  let [data, tipo, descricao, valor, categoria, pagamento] = values;
  data = formatarDataParaISO(data);
  tipo = tipo.toLowerCase();
  const query = `
    INSERT INTO lancamentos (user_id, data, tipo, descricao, valor, categoria, pagamento)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  const result = await pool.query(query, [userId, data, tipo, descricao, valor, categoria, pagamento]);
  return result.rows[0].id;
}

async function getDatabaseData(userId) {
  const query = `
    SELECT id, data, tipo, descricao, valor, categoria, pagamento
    FROM lancamentos 
    WHERE user_id = $1 
    ORDER BY data DESC, criado_em DESC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows.map(row => [
    row.id,
    row.data,
    row.tipo,
    row.descricao,
    row.valor,
    row.categoria,
    row.pagamento
  ]);
}

async function getResumoDoMesAtual(userId) {
  const query = `
    SELECT 
      tipo,
      SUM(valor) as total,
      COUNT(*) as quantidade
    FROM lancamentos 
    WHERE user_id = $1 
      AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY tipo
  `;
  
  const result = await pool.query(query, [userId]);
  
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalLancamentos = 0;
  
  result.rows.forEach(row => {
    if (row.tipo === 'receita') {
      totalReceitas = parseFloat(row.total);
    } else if (row.tipo === 'gasto') {
      totalDespesas = parseFloat(row.total);
    }
    totalLancamentos += parseInt(row.quantidade);
  });
  
  const saldo = totalReceitas - totalDespesas;
  
  return {
    totalReceitas,
    totalDespesas,
    saldo,
    totalLancamentos,
  };
}

async function getResumoPorMes(userId, mes, ano) {
  const query = `
    SELECT 
      tipo,
      SUM(valor) as total,
      COUNT(*) as quantidade
    FROM lancamentos 
    WHERE user_id = $1 
      AND EXTRACT(MONTH FROM data) = $2
      AND EXTRACT(YEAR FROM data) = $3
    GROUP BY tipo
  `;
  
  const result = await pool.query(query, [userId, mes + 1, ano]); // +1 porque PostgreSQL usa 1-12
  
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalLancamentos = 0;
  
  result.rows.forEach(row => {
    if (row.tipo === 'receita') {
      totalReceitas = parseFloat(row.total);
    } else if (row.tipo === 'gasto') {
      totalDespesas = parseFloat(row.total);
    }
    totalLancamentos += parseInt(row.quantidade);
  });
  
  const saldo = totalReceitas - totalDespesas;
  
  return {
    totalReceitas,
    totalDespesas,
    saldo,
    totalLancamentos,
  };
}

async function getGastosPorCategoria(userId, mes = null, ano = null) {
  let query = `
    SELECT 
      categoria,
      SUM(valor) as total,
      COUNT(*) as lancamentos,
      AVG(valor) as media
    FROM lancamentos 
    WHERE user_id = $1 AND tipo = 'gasto'
  `;
  
  const params = [userId];
  let paramIndex = 2;
  
  if (mes !== null && ano !== null) {
    query += ` AND EXTRACT(MONTH FROM data) = $${paramIndex} AND EXTRACT(YEAR FROM data) = $${paramIndex + 1}`;
    params.push(mes + 1, ano); // +1 porque PostgreSQL usa 1-12
  } else {
    query += ` AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)`;
  }
  
  query += ` GROUP BY categoria ORDER BY total DESC`;
  
  const result = await pool.query(query, params);
  
  const categorias = result.rows.map(row => ({
    nome: row.categoria,
    total: parseFloat(row.total),
    lancamentos: parseInt(row.lancamentos),
    media: parseFloat(row.media)
  }));
  
  const totalGeral = categorias.reduce((sum, cat) => sum + cat.total, 0);
  const totalLancamentos = categorias.reduce((sum, cat) => sum + cat.lancamentos, 0);
  
  return {
    categorias,
    totalGeral,
    totalLancamentos
  };
}

async function getUltimosLancamentos(userId, n = 5) {
  const query = `
    SELECT id, data, tipo, descricao, valor, categoria, pagamento
    FROM lancamentos 
    WHERE user_id = $1 
    ORDER BY data DESC, criado_em DESC 
    LIMIT $2
  `;
  
  const result = await pool.query(query, [userId, n]);
  return result.rows;
}

async function getLancamentoPorId(userId, id) {
  const query = `
    SELECT id, data, tipo, descricao, valor, categoria, pagamento
    FROM lancamentos 
    WHERE user_id = $1 AND id = $2
  `;
  
  const result = await pool.query(query, [userId, id]);
  return result.rows[0];
}

async function atualizarLancamentoPorId(userId, id, novosDados) {
  const { data, tipo, descricao, valor, categoria, pagamento } = novosDados;
  
  const query = `
    UPDATE lancamentos 
    SET data = $1, tipo = $2, descricao = $3, valor = $4, categoria = $5, pagamento = $6, atualizado_em = CURRENT_TIMESTAMP
    WHERE user_id = $7 AND id = $8
    RETURNING id
  `;
  
  const result = await pool.query(query, [data, tipo, descricao, valor, categoria, pagamento, userId, id]);
  return result.rows[0];
}

async function excluirLancamentoPorId(userId, id) {
  const query = `
    DELETE FROM lancamentos 
    WHERE user_id = $1 AND id = $2
    RETURNING id
  `;
  
  const result = await pool.query(query, [userId, id]);
  return result.rows[0];
}

module.exports = {
  initializeDatabase,
  appendRowToDatabase,
  getDatabaseData,
  getResumoDoMesAtual,
  getResumoPorMes,
  getGastosPorCategoria,
  getUltimosLancamentos,
  getLancamentoPorId,
  atualizarLancamentoPorId,
  excluirLancamentoPorId,
  pool
}; 