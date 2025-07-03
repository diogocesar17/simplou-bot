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
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parcelamento_id VARCHAR(100),
        parcela_atual INTEGER,
        total_parcelas INTEGER,
        recorrente BOOLEAN DEFAULT FALSE,
        recorrente_fim DATE,
        recorrente_id VARCHAR(100),
        cartao_nome VARCHAR(50),
        data_lancamento DATE,
        data_contabilizacao DATE,
        mes_fatura INTEGER,
        ano_fatura INTEGER,
        dia_vencimento INTEGER,
        status_fatura VARCHAR(20) DEFAULT 'pendente'
      )
    `);

    // Criar tabela de configuração de cartões
    await client.query(`
      CREATE TABLE IF NOT EXISTS cartoes_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        nome_cartao VARCHAR(50) NOT NULL,
        dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
        dia_fechamento INTEGER,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, nome_cartao)
      )
    `);

    // Migração: Adicionar colunas de cartão se não existirem
    await migrateCartaoColumns(client);
    
    // Migração: Adicionar coluna dia_fechamento na tabela cartoes_config
    await migrateCartoesConfigTable(client);

    // Criar índices para melhor performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id ON lancamentos(user_id);
      CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos(data);
      CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos(categoria);
      CREATE INDEX IF NOT EXISTS idx_lancamentos_cartao ON lancamentos(cartao_nome);
      CREATE INDEX IF NOT EXISTS idx_lancamentos_contabilizacao ON lancamentos(data_contabilizacao);
      CREATE INDEX IF NOT EXISTS idx_cartoes_config_user_id ON cartoes_config(user_id);
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

// Função para migrar colunas de cartão
async function migrateCartaoColumns(client) {
  try {
    // Verificar se as colunas já existem
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lancamentos' 
      AND column_name IN ('cartao_nome', 'data_lancamento', 'data_contabilizacao', 'mes_fatura', 'ano_fatura', 'dia_vencimento', 'status_fatura')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    const newColumns = [
      'cartao_nome',
      'data_lancamento', 
      'data_contabilizacao',
      'mes_fatura',
      'ano_fatura',
      'dia_vencimento',
      'status_fatura'
    ];
    
    const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col));
    
    if (columnsToAdd.length > 0) {
      console.log('🔄 Migrando colunas de cartão de crédito...');
      
      for (const column of columnsToAdd) {
        let columnDefinition = '';
        switch (column) {
          case 'cartao_nome':
            columnDefinition = 'ADD COLUMN cartao_nome VARCHAR(50)';
            break;
          case 'data_lancamento':
            columnDefinition = 'ADD COLUMN data_lancamento DATE';
            break;
          case 'data_contabilizacao':
            columnDefinition = 'ADD COLUMN data_contabilizacao DATE';
            break;
          case 'mes_fatura':
            columnDefinition = 'ADD COLUMN mes_fatura INTEGER';
            break;
          case 'ano_fatura':
            columnDefinition = 'ADD COLUMN ano_fatura INTEGER';
            break;
          case 'dia_vencimento':
            columnDefinition = 'ADD COLUMN dia_vencimento INTEGER';
            break;
          case 'status_fatura':
            columnDefinition = 'ADD COLUMN status_fatura VARCHAR(20) DEFAULT \'pendente\'';
            break;
        }
        
        if (columnDefinition) {
          await client.query(`ALTER TABLE lancamentos ${columnDefinition}`);
          console.log(`✅ Coluna ${column} adicionada`);
        }
      }
      
      console.log('✅ Migração de colunas concluída');
    } else {
      console.log('✅ Colunas de cartão já existem');
    }
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    throw error;
  }
}

async function migrateCartoesConfigTable(client) {
  try {
    // Verificar se a coluna dia_fechamento existe na tabela cartoes_config
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cartoes_config' 
      AND column_name = 'dia_fechamento'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('🔄 Adicionando coluna dia_fechamento à tabela cartoes_config...');
      await client.query(`ALTER TABLE cartoes_config ADD COLUMN dia_fechamento INTEGER`);
      console.log('✅ Coluna dia_fechamento adicionada à tabela cartoes_config');
    } else {
      console.log('✅ Coluna dia_fechamento já existe na tabela cartoes_config');
    }
  } catch (error) {
    console.error('❌ Erro na migração da tabela cartoes_config:', error.message);
    throw error;
  }
}

function formatarDataParaISO(dataBR) {
  if (!dataBR) return null;
  // Se já estiver no formato ISO, retorna direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataBR)) return dataBR;
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// Funções para gerenciar cartões de crédito
async function salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento = null) {
  const query = `
    INSERT INTO cartoes_config (user_id, nome_cartao, dia_vencimento, dia_fechamento)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, nome_cartao) 
    DO UPDATE SET dia_vencimento = $3, dia_fechamento = $4, criado_em = CURRENT_TIMESTAMP
    RETURNING id
  `;
  const result = await pool.query(query, [userId, nomeCartao, diaVencimento, diaFechamento]);
  return result.rows[0].id;
}

async function atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento = null) {
  const query = `
    UPDATE cartoes_config SET dia_vencimento = $3, dia_fechamento = $4, criado_em = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND nome_cartao = $2
    RETURNING *
  `;
  const result = await pool.query(query, [userId, nomeCartao, diaVencimento, diaFechamento]);
  return result.rows[0];
}

async function buscarConfiguracaoCartao(userId, nomeCartao) {
  const query = `
    SELECT nome_cartao, dia_vencimento, dia_fechamento
    FROM cartoes_config
    WHERE user_id = $1 AND nome_cartao ILIKE $2
  `;
  const result = await pool.query(query, [userId, nomeCartao]);
  return result.rows[0];
}

async function listarCartoesConfigurados(userId) {
  const query = `
    SELECT nome_cartao, dia_vencimento, COALESCE(dia_fechamento, NULL) as dia_fechamento
    FROM cartoes_config
    WHERE user_id = $1
    ORDER BY nome_cartao ASC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

// Calcular data de contabilização baseada no dia de vencimento e fechamento
function calcularDataContabilizacao(dataLancamento, diaVencimento, diaFechamento = null) {
  const lancamento = new Date(dataLancamento);
  const dia = lancamento.getDate();
  let mes = lancamento.getMonth(); // 0-11
  let ano = lancamento.getFullYear();

  if (diaFechamento === null || diaFechamento === undefined) {
    // Lógica antiga: só vencimento
    const vencimentoAtual = new Date(ano, mes, diaVencimento);
    if (lancamento > vencimentoAtual) {
      return {
        dataContabilizacao: new Date(ano, mes + 1, diaVencimento),
        mesFatura: mes + 2, // +1 para mês 1-12, +1 para próximo mês
        anoFatura: mes === 11 ? ano + 1 : ano
      };
    } else {
      return {
        dataContabilizacao: vencimentoAtual,
        mesFatura: mes + 1,
        anoFatura: ano
      };
    }
  }

  // Lógica correta: fechamento
  let mesFatura, anoFatura;
  if (dia <= diaFechamento) {
    // Antes ou no fechamento: fatura do mês corrente
    mesFatura = mes + 1;
    anoFatura = ano;
  } else {
    // Após fechamento: fatura do mês seguinte
    mesFatura = mes + 2;
    anoFatura = mes === 11 ? ano + 1 : ano;
  }
  // Data de vencimento da fatura
  let dataVencimento = new Date(anoFatura, mesFatura - 1, diaVencimento);
  return {
    dataContabilizacao: dataVencimento,
    mesFatura,
    anoFatura
  };
}

// Funções para operações CRUD
async function appendRowToDatabase(userId, values) {
  // Suporte a novos campos opcionais
  let [data, tipo, descricao, valor, categoria, pagamento, parcelamento_id, parcela_atual, total_parcelas, recorrente, recorrente_fim, recorrente_id, cartao_nome, data_lancamento, data_contabilizacao, mes_fatura, ano_fatura, dia_vencimento, status_fatura] = values;
  data = formatarDataParaISO(data);
  tipo = tipo.toLowerCase();

  // Monta query dinâmica conforme os campos fornecidos
  const campos = ['user_id', 'data', 'tipo', 'descricao', 'valor', 'categoria', 'pagamento'];
  const params = [userId, data, tipo, descricao, valor, categoria, pagamento];

  if (parcelamento_id !== undefined) { campos.push('parcelamento_id'); params.push(parcelamento_id); }
  if (parcela_atual !== undefined) { campos.push('parcela_atual'); params.push(parcela_atual); }
  if (total_parcelas !== undefined) { campos.push('total_parcelas'); params.push(total_parcelas); }
  if (recorrente !== undefined) { campos.push('recorrente'); params.push(recorrente); }
  if (recorrente_fim !== undefined) { campos.push('recorrente_fim'); params.push(recorrente_fim); }
  if (recorrente_id !== undefined) { campos.push('recorrente_id'); params.push(recorrente_id); }
  if (cartao_nome !== undefined) { campos.push('cartao_nome'); params.push(cartao_nome); }
  if (data_lancamento !== undefined) { campos.push('data_lancamento'); params.push(data_lancamento); }
  if (data_contabilizacao !== undefined) { campos.push('data_contabilizacao'); params.push(data_contabilizacao); }
  if (mes_fatura !== undefined) { campos.push('mes_fatura'); params.push(mes_fatura); }
  if (ano_fatura !== undefined) { campos.push('ano_fatura'); params.push(ano_fatura); }
  if (dia_vencimento !== undefined) { campos.push('dia_vencimento'); params.push(dia_vencimento); }
  if (status_fatura !== undefined) { campos.push('status_fatura'); params.push(status_fatura); }

  const placeholders = params.map((_, i) => `$${i + 1}`);
  const query = `
    INSERT INTO lancamentos (${campos.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING id
  `;
  const result = await pool.query(query, params);
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

// Listar lançamentos com agrupamento de parcelados e recorrentes
async function listarLancamentos(userId, limite = 20, mes = null, ano = null) {
  let query = `
    SELECT id, data, tipo, descricao, valor, categoria, pagamento, 
           parcelamento_id, parcela_atual, total_parcelas,
           recorrente, recorrente_fim, recorrente_id,
           cartao_nome, data_lancamento, data_contabilizacao, mes_fatura, ano_fatura, dia_vencimento
    FROM lancamentos 
    WHERE user_id = $1
  `;
  
  const params = [userId];
  let paramIndex = 2;
  
  if (mes !== null && ano !== null) {
    query += ` AND EXTRACT(MONTH FROM data) = $${paramIndex} AND EXTRACT(YEAR FROM data) = $${paramIndex + 1}`;
    params.push(mes + 1, ano); // +1 porque PostgreSQL usa 1-12
  }
  
  query += ` ORDER BY data DESC, criado_em DESC LIMIT $${paramIndex + (mes !== null && ano !== null ? 2 : 0)}`;
  params.push(limite * 3); // Busca mais para garantir agrupamento
  
  const result = await pool.query(query, params);
  const lancamentos = result.rows;
  
  // Agrupa parcelamentos e recorrentes
  const vistosParcelamentos = new Set();
  const vistosRecorrentes = new Set();
  const lancamentosAgrupados = [];
  
  for (let l of lancamentos) {
    // Pula se já foi processado como parte de um grupo
    if (vistosParcelamentos.has(l.parcelamento_id) || vistosRecorrentes.has(l.recorrente_id)) {
      continue;
    }
    
    if (l.parcelamento_id) {
      // Agrupa parcelamentos
      const grupo = lancamentos.filter(x => x.parcelamento_id === l.parcelamento_id);
      const valorTotal = grupo.reduce((soma, x) => soma + parseFloat(x.valor), 0);
      const primeiraParcela = grupo[0];
      
      lancamentosAgrupados.push({
        ...primeiraParcela,
        valor: valorTotal,
        descricao: `${primeiraParcela.descricao.replace(/\(1\/\d+\)/, '').trim()} (${l.total_parcelas}x de R$ ${formatarValor(primeiraParcela.valor)})`,
        agrupado: true,
        tipoAgrupamento: 'parcelado',
        grupo: grupo
      });
      vistosParcelamentos.add(l.parcelamento_id);
    } else if (l.recorrente) {
      // Agrupa recorrentes
      const grupo = lancamentos.filter(x => x.recorrente_id === l.recorrente_id);
      const valorTotal = grupo.reduce((soma, x) => soma + parseFloat(x.valor), 0);
      const primeiroRecorrente = grupo[0];
      
      lancamentosAgrupados.push({
        ...primeiroRecorrente,
        valor: valorTotal,
        descricao: `${primeiroRecorrente.descricao} (Fixo: ${grupo.length}x)`,
        agrupado: true,
        tipoAgrupamento: 'recorrente',
        grupo: grupo
      });
      vistosRecorrentes.add(l.recorrente_id);
    } else {
      // Lançamento simples
      lancamentosAgrupados.push({
        ...l,
        agrupado: false
      });
    }
    
    if (lancamentosAgrupados.length >= limite) break;
  }
  
  return lancamentosAgrupados;
}

// Função auxiliar para formatar valor (reutilizada)
function formatarValor(valor, casasDecimais = 2) {
  if (valor === null || valor === undefined) return '0.00';
  const valorNumerico = Number(valor);
  if (isNaN(valorNumerico)) return '0.00';
  return valorNumerico.toFixed(casasDecimais);
}

async function getUltimosLancamentos(userId, n = 5) {
  const query = `
    SELECT id, data, tipo, descricao, valor, categoria, pagamento, parcelamento_id, parcela_atual, total_parcelas
    FROM lancamentos 
    WHERE user_id = $1 
    ORDER BY data DESC, criado_em DESC 
    LIMIT $2
  `;
  
  const result = await pool.query(query, [userId, n * 5]); // Busca mais para garantir agrupamento
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

// Consulta total de gastos por tipo de pagamento
async function getTotalGastosPorPagamento(userId, pagamento, mes = null, ano = null) {
  let query = `
    SELECT SUM(valor) as total
    FROM lancamentos
    WHERE user_id = $1 AND tipo = 'gasto' AND pagamento ILIKE $2
  `;
  
  const params = [userId, `%${pagamento}%`];
  let paramIndex = 3;
  
  if (mes !== null && ano !== null) {
    query += ` AND EXTRACT(MONTH FROM data) = $${paramIndex} AND EXTRACT(YEAR FROM data) = $${paramIndex + 1}`;
    params.push(mes + 1, ano); // +1 porque PostgreSQL usa 1-12
  } else {
    query += ` AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)`;
  }
  
  const result = await pool.query(query, params);
  return result.rows[0].total ? parseFloat(result.rows[0].total) : 0;
}

// Excluir todas as parcelas de um parcelamento
async function excluirParcelamentoPorId(userId, parcelamentoId) {
  const query = `
    DELETE FROM lancamentos
    WHERE user_id = $1 AND parcelamento_id = $2
    RETURNING id
  `;
  const result = await pool.query(query, [userId, parcelamentoId]);
  return result.rowCount;
}

// Excluir todos os lançamentos futuros de um recorrente
async function excluirRecorrentePorId(userId, recorrenteId) {
  const query = `
    DELETE FROM lancamentos
    WHERE user_id = $1 AND recorrente_id = $2 AND data >= CURRENT_DATE
    RETURNING id
  `;
  const result = await pool.query(query, [userId, recorrenteId]);
  return result.rowCount;
}

// Buscar lançamentos agrupados para exclusão (similar à listagem mas com foco na exclusão)
async function buscarLancamentosParaExclusao(userId, limite = 20) {
  const query = `
    SELECT id, data, tipo, descricao, valor, categoria, pagamento, 
           parcelamento_id, parcela_atual, total_parcelas,
           recorrente, recorrente_fim, recorrente_id
    FROM lancamentos 
    WHERE user_id = $1
    ORDER BY data DESC, criado_em DESC 
    LIMIT $2
  `;
  
  const result = await pool.query(query, [userId, limite * 3]); // Busca mais para garantir agrupamento
  const lancamentos = result.rows;
  
  // Agrupa parcelamentos e recorrentes
  const vistosParcelamentos = new Set();
  const vistosRecorrentes = new Set();
  const lancamentosAgrupados = [];
  
  for (let l of lancamentos) {
    // Pula se já foi processado como parte de um grupo
    if (vistosParcelamentos.has(l.parcelamento_id) || vistosRecorrentes.has(l.recorrente_id)) {
      continue;
    }
    
    if (l.parcelamento_id) {
      // Agrupa parcelamentos
      const grupo = lancamentos.filter(x => x.parcelamento_id === l.parcelamento_id);
      const valorTotal = grupo.reduce((soma, x) => soma + parseFloat(x.valor), 0);
      const primeiraParcela = grupo[0];
      
      lancamentosAgrupados.push({
        ...primeiraParcela,
        valor: valorTotal,
        descricao: `${primeiraParcela.descricao.replace(/\(1\/\d+\)/, '').trim()} (${l.total_parcelas}x de R$ ${formatarValor(primeiraParcela.valor)})`,
        agrupado: true,
        tipoAgrupamento: 'parcelado',
        grupo: grupo,
        idsParaExcluir: grupo.map(x => x.id)
      });
      vistosParcelamentos.add(l.parcelamento_id);
    } else if (l.recorrente) {
      // Agrupa recorrentes
      const grupo = lancamentos.filter(x => x.recorrente_id === l.recorrente_id);
      const valorTotal = grupo.reduce((soma, x) => soma + parseFloat(x.valor), 0);
      const primeiroRecorrente = grupo[0];
      
      lancamentosAgrupados.push({
        ...primeiroRecorrente,
        valor: valorTotal,
        descricao: `${primeiroRecorrente.descricao} (Fixo: ${grupo.length}x)`,
        agrupado: true,
        tipoAgrupamento: 'recorrente',
        grupo: grupo,
        idsParaExcluir: grupo.map(x => x.id)
      });
      vistosRecorrentes.add(l.recorrente_id);
    } else {
      // Lançamento simples
      lancamentosAgrupados.push({
        ...l,
        agrupado: false,
        idsParaExcluir: [l.id]
      });
    }
    
    if (lancamentosAgrupados.length >= limite) break;
  }
  
  return lancamentosAgrupados;
}

// Buscar faturas de cartão por mês/ano
async function buscarFaturaCartao(userId, nomeCartao, mes, ano) {
  const query = `
    SELECT id, data_lancamento, descricao, valor, categoria, data_contabilizacao, dia_vencimento
    FROM lancamentos 
    WHERE user_id = $1 
      AND cartao_nome ILIKE $2
      AND mes_fatura = $3
      AND ano_fatura = $4
    ORDER BY data_lancamento ASC
  `;
  
  const result = await pool.query(query, [userId, nomeCartao, mes, ano]);
  return result.rows;
}

// Resumo real (excluindo gastos de cartão pendentes)
async function getResumoReal(userId, mes = null, ano = null) {
  let query = `
    SELECT 
      tipo,
      SUM(valor) as total,
      COUNT(*) as quantidade
    FROM lancamentos 
    WHERE user_id = $1 
      AND (
        cartao_nome IS NULL 
        OR data_contabilizacao <= CURRENT_DATE
      )
  `;
  
  const params = [userId];
  let paramIndex = 2;
  
  if (mes !== null && ano !== null) {
    query += ` AND EXTRACT(MONTH FROM data) = $${paramIndex} AND EXTRACT(YEAR FROM data) = $${paramIndex + 1}`;
    params.push(mes + 1, ano); // +1 porque PostgreSQL usa 1-12
  } else {
    query += ` AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)`;
  }
  
  query += ` GROUP BY tipo`;
  
  const result = await pool.query(query, params);
  
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
  
  // Buscar gastos pendentes no cartão
  const queryPendentes = `
    SELECT SUM(valor) as total_pendente, COUNT(*) as qtd_pendente
    FROM lancamentos 
    WHERE user_id = $1 
      AND cartao_nome IS NOT NULL 
      AND data_contabilizacao > CURRENT_DATE
  `;
  
  const paramsPendentes = [userId];
  if (mes !== null && ano !== null) {
    queryPendentes += ` AND EXTRACT(MONTH FROM data_lancamento) = $2 AND EXTRACT(YEAR FROM data_lancamento) = $3`;
    paramsPendentes.push(mes + 1, ano);
  } else {
    queryPendentes += ` AND EXTRACT(MONTH FROM data_lancamento) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM data_lancamento) = EXTRACT(YEAR FROM CURRENT_DATE)`;
  }
  
  const resultPendentes = await pool.query(queryPendentes, paramsPendentes);
  const totalPendente = resultPendentes.rows[0]?.total_pendente ? parseFloat(resultPendentes.rows[0].total_pendente) : 0;
  const qtdPendente = resultPendentes.rows[0]?.qtd_pendente ? parseInt(resultPendentes.rows[0].qtd_pendente) : 0;
  
  return {
    totalReceitas,
    totalDespesas,
    saldo,
    totalLancamentos,
    totalPendente,
    qtdPendente
  };
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
  getTotalGastosPorPagamento,
  pool,
  excluirParcelamentoPorId,
  listarLancamentos,
  excluirRecorrentePorId,
  buscarLancamentosParaExclusao,
  salvarConfiguracaoCartao,
  atualizarCartaoConfigurado,
  listarCartoesConfigurados,
  calcularDataContabilizacao,
  buscarFaturaCartao,
  getResumoReal
}; 