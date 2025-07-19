const { Pool } = require('pg');
const { logger, fileLogger } = require('./logger');

// Configuração otimizada da conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Otimizações de performance
  max: 20, // Máximo de conexões
  idleTimeoutMillis: 30000, // 30 segundos
  connectionTimeoutMillis: 2000, // 2 segundos
  allowExitOnIdle: true,
  // Configurações de query
  statement_timeout: 10000, // 10 segundos
  query_timeout: 10000, // 10 segundos
});

// Monitoramento de conexões
pool.on('connect', (client) => {
  logger.info('🔌 Nova conexão PostgreSQL estabelecida');
});

pool.on('error', (err, client) => {
  fileLogger.error('❌ Erro no pool PostgreSQL:', err.message);
});

// Inicializar tabelas se não existirem
async function initializeDatabase() {
  try {
    logger.info('🔌 Tentando conectar ao PostgreSQL...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada. Verifique as variáveis de ambiente.');
    }
    
    const client = await pool.connect();
    logger.info('✅ Conectado ao PostgreSQL com sucesso');
    
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
        status_fatura VARCHAR(20) DEFAULT 'pendente',
        data_vencimento DATE
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

    // Criar tabela de logs de auditoria
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs_auditoria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        acao VARCHAR(100) NOT NULL,
        detalhes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migração: Adicionar colunas de cartão se não existirem
    await migrateCartaoColumns(client);
    
    // Migração: Adicionar colunas de parcelamento e recorrente se não existirem
    await migrateParcelamentoRecorrenteColumns(client);
    
    // Migração: Adicionar coluna dia_fechamento na tabela cartoes_config
    await migrateCartoesConfigTable(client);

    // Migração: Adicionar coluna data_vencimento para boletos
    await migrateDataVencimentoColumn(client);

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
    logger.info('✅ Banco de dados inicializado com sucesso');
  } catch (error) {
    fileLogger.error('❌ Erro ao inicializar banco de dados:', error.message);
    logger.error('🔍 Verifique se:');
    logger.error('   - DATABASE_URL está configurada');
    logger.error('   - PostgreSQL está rodando');
    logger.error('   - Credenciais estão corretas');
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
      logger.info('🔄 Migrando colunas de cartão de crédito...');
      
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
          logger.info(`✅ Coluna ${column} adicionada`);
        }
      }
      
      logger.info('✅ Migração de colunas concluída');
    } else {
      logger.info('✅ Colunas de cartão já existem');
    }
  } catch (error) {
    fileLogger.error('❌ Erro na migração:', error.message);
    throw error;
  }
}

async function migrateParcelamentoRecorrenteColumns(client) {
  try {
    // Verificar se as colunas já existem
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lancamentos' 
      AND column_name IN ('parcelamento_id', 'parcela_atual', 'total_parcelas', 'recorrente', 'recorrente_fim', 'recorrente_id')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    const newColumns = [
      'parcelamento_id',
      'parcela_atual',
      'total_parcelas',
      'recorrente',
      'recorrente_fim',
      'recorrente_id'
    ];
    
    const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col));
    
    if (columnsToAdd.length > 0) {
      logger.info('🔄 Migrando colunas de parcelamento e recorrente...');
      
      for (const column of columnsToAdd) {
        let columnDefinition = '';
        switch (column) {
          case 'parcelamento_id':
            columnDefinition = 'ADD COLUMN parcelamento_id VARCHAR(100)';
            break;
          case 'parcela_atual':
            columnDefinition = 'ADD COLUMN parcela_atual INTEGER';
            break;
          case 'total_parcelas':
            columnDefinition = 'ADD COLUMN total_parcelas INTEGER';
            break;
          case 'recorrente':
            columnDefinition = 'ADD COLUMN recorrente BOOLEAN DEFAULT FALSE';
            break;
          case 'recorrente_fim':
            columnDefinition = 'ADD COLUMN recorrente_fim DATE';
            break;
          case 'recorrente_id':
            columnDefinition = 'ADD COLUMN recorrente_id VARCHAR(100)';
            break;
        }
        
        if (columnDefinition) {
          await client.query(`ALTER TABLE lancamentos ${columnDefinition}`);
          logger.info(`✅ Coluna ${column} adicionada`);
        }
      }
      
      logger.info('✅ Migração de colunas de parcelamento e recorrente concluída');
    } else {
      logger.info('✅ Colunas de parcelamento e recorrente já existem');
    }
  } catch (error) {
    fileLogger.error('❌ Erro na migração de parcelamento e recorrente:', error.message);
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
      logger.info('🔄 Adicionando coluna dia_fechamento à tabela cartoes_config...');
      await client.query(`ALTER TABLE cartoes_config ADD COLUMN dia_fechamento INTEGER`);
      logger.info('✅ Coluna dia_fechamento adicionada à tabela cartoes_config');
    } else {
      logger.info('✅ Coluna dia_fechamento já existe na tabela cartoes_config');
    }
  } catch (error) {
    fileLogger.error('❌ Erro na migração da tabela cartoes_config:', error.message);
    throw error;
  }
}

async function migrateDataVencimentoColumn(client) {
  try {
    // Verificar se a coluna data_vencimento existe na tabela lancamentos
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lancamentos' 
      AND column_name = 'data_vencimento'
    `);
    
    if (checkColumn.rows.length === 0) {
      logger.info('🔄 Adicionando coluna data_vencimento à tabela lancamentos...');
      await client.query(`ALTER TABLE lancamentos ADD COLUMN data_vencimento DATE`);
      logger.info('✅ Coluna data_vencimento adicionada à tabela lancamentos');
    } else {
      logger.info('✅ Coluna data_vencimento já existe na tabela lancamentos');
    }
  } catch (error) {
    fileLogger.error('❌ Erro na migração da coluna data_vencimento:', error.message);
    throw error;
  }
}

function formatarDataParaISO(dataBR) {
  if (!dataBR) return null;
  // Se for um objeto Date, converter para string ISO considerando o timezone do Brasil
  if (dataBR instanceof Date) {
    // Corrigir: garantir que a data seja do Brasil
    const ano = dataBR.getFullYear();
    const mes = (dataBR.getMonth() + 1).toString().padStart(2, '0');
    const dia = dataBR.getDate().toString().padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  // Se já estiver no formato ISO, retorna direto
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataBR)) return dataBR;
  // Se for string no formato DD/MM/AAAA
  if (typeof dataBR === 'string' && dataBR.includes('/')) {
    const [dia, mes, ano] = dataBR.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return dataBR;
}

// Funções para gerenciar cartões de crédito
async function salvarConfiguracaoCartao(userId, nomeCartao, diaVencimento, diaFechamento = null) {
  try {
    const query = `
      INSERT INTO cartoes_config (user_id, nome_cartao, dia_vencimento, dia_fechamento)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, nome_cartao) 
      DO UPDATE SET 
        dia_vencimento = EXCLUDED.dia_vencimento,
        dia_fechamento = EXCLUDED.dia_fechamento
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, nomeCartao, diaVencimento, diaFechamento]);
    
    // Registrar log de auditoria
    const detalhes = `Cartão: ${nomeCartao}, Vencimento: dia ${diaVencimento}, Fechamento: dia ${diaFechamento || 'N/A'}`;
    await registrarLog(userId, 'CONFIGURAR_CARTAO', detalhes);
    
    return result.rows[0].id;
  } catch (error) {
    fileLogger.error('❌ Erro ao salvar configuração de cartão:', error);
    throw error;
  }
}

async function atualizarCartaoConfigurado(userId, nomeCartao, diaVencimento, diaFechamento = null) {
  try {
    const query = `
      UPDATE cartoes_config 
      SET dia_vencimento = $3, dia_fechamento = $4
      WHERE user_id = $1 AND nome_cartao = $2
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, nomeCartao, diaVencimento, diaFechamento]);
    
    // Registrar log de auditoria
    const detalhes = `Cartão: ${nomeCartao}, Vencimento: dia ${diaVencimento}, Fechamento: dia ${diaFechamento || 'N/A'}`;
    await registrarLog(userId, 'ATUALIZAR_CARTAO', detalhes);
    
    return result.rows[0]?.id;
  } catch (error) {
    fileLogger.error('❌ Erro ao atualizar configuração de cartão:', error);
    throw error;
  }
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

async function contarLancamentosAssociadosCartao(userId, nomeCartao) {
  try {
    const query = `
      SELECT COUNT(*) as total
      FROM lancamentos
      WHERE user_id = $1 AND cartao_nome ILIKE $2
    `;
    const result = await pool.query(query, [userId, nomeCartao]);
    return parseInt(result.rows[0].total);
  } catch (error) {
    fileLogger.error('❌ Erro ao contar lançamentos associados:', error);
    throw error;
  }
}

async function excluirCartaoConfigurado(userId, nomeCartao) {
  try {
    // Primeiro, verificar se existem lançamentos associados ao cartão
    const totalLancamentos = await contarLancamentosAssociadosCartao(userId, nomeCartao);

    // Excluir o cartão da configuração
    const deleteQuery = `
      DELETE FROM cartoes_config
      WHERE user_id = $1 AND nome_cartao ILIKE $2
    `;
    const result = await pool.query(deleteQuery, [userId, nomeCartao]);

    if (result.rowCount === 0) {
      throw new Error('Cartão não encontrado');
    }

    // Registrar log de auditoria
    await registrarLog(userId, 'EXCLUIR_CARTAO', `Cartão: ${nomeCartao}, Lançamentos associados: ${totalLancamentos}`);

    return {
      sucesso: true,
      cartaoExcluido: nomeCartao,
      lancamentosAssociados: totalLancamentos
    };
  } catch (error) {
    fileLogger.error('❌ Erro ao excluir cartão:', error);
    throw error;
  }
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
  try {
    const query = `
      INSERT INTO lancamentos (
        user_id, data, tipo, descricao, valor, categoria, pagamento,
        parcelamento_id, parcela_atual, total_parcelas,
        recorrente, recorrente_fim, recorrente_id,
        cartao_nome, data_lancamento, data_contabilizacao,
        mes_fatura, ano_fatura, dia_vencimento, status_fatura, data_vencimento
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, ...values]);
    const lancamentoId = result.rows[0].id;
    
    // Registrar log de auditoria
    const tipo = values[1] || 'gasto';
    const valor = values[3] || 0;
    const categoria = values[4] || 'Outros';
    const pagamento = values[5] || 'NÃO INFORMADO';
    const descricao = values[2] || 'Lançamento';
    
    let acao = 'CRIAR_LANCAMENTO';
    let detalhes = `Tipo: ${tipo}, Valor: R$ ${valor}, Categoria: ${categoria}, Pagamento: ${pagamento}`;
    
    // Verificar se é parcelamento
    if (values[6]) { // parcelamento_id
      acao = 'CRIAR_PARCELAMENTO';
      const totalParcelas = values[8] || 0;
      detalhes += `, Parcelamento: ${totalParcelas}x`;
    }
    
    // Verificar se é recorrente
    if (values[10]) { // recorrente
      acao = 'CRIAR_RECORRENTE';
      detalhes += `, Recorrente: ${values[11] || 'N/A'}`;
    }
    
    // Verificar se é cartão
    if (values[13]) { // cartao_nome
      detalhes += `, Cartão: ${values[13]}`;
    }
    
    await registrarLog(userId, acao, detalhes);
    
    return lancamentoId;
  } catch (error) {
    fileLogger.error('❌ Erro ao adicionar lançamento:', error);
    throw error;
  }
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

// Resumo do dia atual
async function getResumoDoDia(userId) {
  const query = `
    SELECT 
      tipo,
      SUM(valor) as total,
      COUNT(*) as quantidade
    FROM lancamentos 
    WHERE user_id = $1 
      AND EXTRACT(DAY FROM data) = EXTRACT(DAY FROM CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
      AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
      AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
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
  logger.debug('[DEBUG] getResumoPorMes chamada com:', { userId, mes, ano });
  
  const query = `
    SELECT 
      tipo,
      SUM(valor) as total,
      COUNT(*) as quantidade
    FROM lancamentos 
    WHERE user_id = $1 
      AND (
        (EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3)
        OR
        (data_contabilizacao IS NOT NULL AND EXTRACT(MONTH FROM data_contabilizacao) = $2 AND EXTRACT(YEAR FROM data_contabilizacao) = $3)
      )
    GROUP BY tipo
  `;
  
  const params = [userId, mes, ano];
  logger.debug('[DEBUG] Query params:', params);
  logger.debug('[DEBUG] Query SQL:', query);
  
  const result = await pool.query(query, params);
  logger.debug('[DEBUG] Resultado da query:', result.rows);
  
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalLancamentos = 0;
  
  result.rows.forEach(row => {
    logger.debug('[DEBUG] Processando row:', row);
    if (row.tipo === 'receita') {
      totalReceitas = parseFloat(row.total);
    } else if (row.tipo === 'gasto') {
      totalDespesas = parseFloat(row.total);
    }
    totalLancamentos += parseInt(row.quantidade);
  });
  
  const saldo = totalReceitas - totalDespesas;
  
  logger.debug('[DEBUG] Totais calculados:', { totalReceitas, totalDespesas, saldo, totalLancamentos });
  
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
           cartao_nome, data_lancamento, data_contabilizacao, mes_fatura, ano_fatura, dia_vencimento,
           criado_em
    FROM lancamentos 
    WHERE user_id = $1
  `;
  
  const params = [userId];
  let paramIndex = 2;
  
  if (mes !== null && ano !== null) {
    // Histórico por período: filtra por data do gasto (data, data_lancamento ou data_contabilizacao)
    query += ` AND (
      (EXTRACT(MONTH FROM data) = $${paramIndex} AND EXTRACT(YEAR FROM data) = $${paramIndex + 1}) OR
      (data_lancamento IS NOT NULL AND EXTRACT(MONTH FROM data_lancamento) = $${paramIndex} AND EXTRACT(YEAR FROM data_lancamento) = $${paramIndex + 1}) OR
      (data_contabilizacao IS NOT NULL AND EXTRACT(MONTH FROM data_contabilizacao) = $${paramIndex} AND EXTRACT(YEAR FROM data_contabilizacao) = $${paramIndex + 1})
    )`;
    params.push(mes, ano);
    query += ` ORDER BY COALESCE(data_contabilizacao, data_lancamento, data) DESC LIMIT $${paramIndex + 2}`;
    params.push(limite * 5); // Busca mais para garantir agrupamento
  } else {
    // Histórico simples: ordena por criado_em (últimos lançamentos)
    query += ` ORDER BY criado_em DESC LIMIT $${paramIndex}`;
    params.push(limite * 5);
  }
  
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
      // Ordena o grupo por criado_em para pegar o mais recente como representante
      grupo.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
      const representante = grupo[0]; // Pega o mais recente
      
      // Se é histórico por período, mostra apenas o valor da parcela específica
      // Se é histórico geral, mostra o valor total do parcelamento
      let valorParaMostrar;
      let descricaoParaMostrar;
      
      if (mes !== null && ano !== null) {
        // Histórico por período: mostra apenas o valor da parcela
        valorParaMostrar = parseFloat(representante.valor);
        descricaoParaMostrar = `${representante.descricao.replace(/\(1\/\d+\)/, '').trim()} (${representante.parcela_atual}/${representante.total_parcelas})`;
      } else {
        // Histórico geral: mostra o valor total do parcelamento
        valorParaMostrar = parseFloat(representante.valor) * parseInt(representante.total_parcelas);
        descricaoParaMostrar = `${representante.descricao.replace(/\(1\/\d+\)/, '').trim()} (${representante.total_parcelas}x de R$ ${formatarValor(representante.valor)})`;
      }
      
      lancamentosAgrupados.push({
        ...representante,
        valor: valorParaMostrar,
        descricao: descricaoParaMostrar,
        agrupado: true,
        tipoAgrupamento: 'parcelado',
        grupo: grupo
      });
      vistosParcelamentos.add(l.parcelamento_id);
    } else if (l.recorrente) {
      // Agrupa recorrentes
      const grupo = lancamentos.filter(x => x.recorrente_id === l.recorrente_id);
      // Ordena o grupo por criado_em para pegar o mais recente como representante
      grupo.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
      const representante = grupo[0]; // Pega o mais recente
      // Valor de uma recorrência (não somar todas)
      const valorRecorrente = parseFloat(representante.valor);
      lancamentosAgrupados.push({
        ...representante,
        valor: valorRecorrente,
        descricao: `${representante.descricao} (Fixo: ${grupo.length}x)`,
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
  try {
    // Buscar informações do lançamento antes de atualizar
    const lancamentoAntes = await getLancamentoPorId(userId, id);
    
    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Adiciona os campos a serem atualizados
    if (novosDados.data !== undefined) {
      campos.push(`data = $${paramIndex}`);
      valores.push(formatarDataParaISO(novosDados.data));
      paramIndex++;
    }
    if (novosDados.tipo !== undefined) {
      campos.push(`tipo = $${paramIndex}`);
      valores.push(novosDados.tipo.toLowerCase());
      paramIndex++;
    }
    if (novosDados.descricao !== undefined) {
      campos.push(`descricao = $${paramIndex}`);
      valores.push(novosDados.descricao);
      paramIndex++;
    }
    if (novosDados.valor !== undefined) {
      campos.push(`valor = $${paramIndex}`);
      valores.push(novosDados.valor);
      paramIndex++;
    }
    if (novosDados.categoria !== undefined) {
      campos.push(`categoria = $${paramIndex}`);
      valores.push(novosDados.categoria);
      paramIndex++;
    }
    if (novosDados.pagamento !== undefined) {
      campos.push(`pagamento = $${paramIndex}`);
      valores.push(novosDados.pagamento);
      paramIndex++;
    }

    if (campos.length === 0) {
      throw new Error('Nenhum campo foi fornecido para atualização');
    }

    campos.push(`atualizado_em = CURRENT_TIMESTAMP`);

    // Adiciona os parâmetros de WHERE
    valores.push(userId, id);

    const query = `
      UPDATE lancamentos 
      SET ${campos.join(', ')}
      WHERE user_id = $${paramIndex} AND id = $${paramIndex + 1}
      RETURNING id
    `;
    
    logger.debug('[DEBUG] Query de atualização:', query);
    logger.debug('[DEBUG] Valores:', valores);
    
    const result = await pool.query(query, valores);
    
    // Registrar log de auditoria
    if (lancamentoAntes) {
      const mudancas = [];
      if (novosDados.data !== undefined && novosDados.data !== lancamentoAntes.data) {
        mudancas.push(`Data: ${lancamentoAntes.data} → ${novosDados.data}`);
      }
      if (novosDados.tipo !== undefined && novosDados.tipo !== lancamentoAntes.tipo) {
        mudancas.push(`Tipo: ${lancamentoAntes.tipo} → ${novosDados.tipo}`);
      }
      if (novosDados.valor !== undefined && novosDados.valor !== lancamentoAntes.valor) {
        mudancas.push(`Valor: R$ ${lancamentoAntes.valor} → R$ ${novosDados.valor}`);
      }
      if (novosDados.categoria !== undefined && novosDados.categoria !== lancamentoAntes.categoria) {
        mudancas.push(`Categoria: ${lancamentoAntes.categoria} → ${novosDados.categoria}`);
      }
      if (novosDados.pagamento !== undefined && novosDados.pagamento !== lancamentoAntes.pagamento) {
        mudancas.push(`Pagamento: ${lancamentoAntes.pagamento} → ${novosDados.pagamento}`);
      }
      if (novosDados.descricao !== undefined && novosDados.descricao !== lancamentoAntes.descricao) {
        mudancas.push(`Descrição: ${lancamentoAntes.descricao} → ${novosDados.descricao}`);
      }
      
      if (mudancas.length > 0) {
        const detalhes = `ID: ${id}, Mudanças: ${mudancas.join(', ')}`;
        await registrarLog(userId, 'EDITAR_LANCAMENTO', detalhes);
      }
    }
    
    return result.rows[0];
  } catch (error) {
    fileLogger.error('❌ Erro ao atualizar lançamento:', error);
    throw error;
  }
}

async function excluirLancamentoPorId(userId, id) {
  try {
    // Buscar informações do lançamento antes de excluir
    const lancamento = await getLancamentoPorId(userId, id);
    
    const query = `DELETE FROM lancamentos WHERE user_id = $1 AND id = $2`;
    await pool.query(query, [userId, id]);
    
    // Registrar log de auditoria
    if (lancamento) {
      const detalhes = `ID: ${id}, Tipo: ${lancamento.tipo}, Valor: R$ ${lancamento.valor}, Categoria: ${lancamento.categoria}, Descrição: ${lancamento.descricao}`;
      await registrarLog(userId, 'EXCLUIR_LANCAMENTO', detalhes);
    }
  } catch (error) {
    fileLogger.error('❌ Erro ao excluir lançamento:', error);
    throw error;
  }
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
  try {
    // Buscar informações do parcelamento antes de excluir
    const query = `
      SELECT COUNT(*) as total_parcelas, SUM(valor) as valor_total, descricao, categoria
      FROM lancamentos 
      WHERE user_id = $1 AND parcelamento_id = $2
    `;
    const result = await pool.query(query, [userId, parcelamentoId]);
    const info = result.rows[0];
    
    const deleteQuery = `
      DELETE FROM lancamentos
      WHERE user_id = $1 AND parcelamento_id = $2
      RETURNING id
    `;
    const deleteResult = await pool.query(deleteQuery, [userId, parcelamentoId]);
    
    // Registrar log de auditoria
    if (info && info.total_parcelas > 0) {
      const detalhes = `Parcelamento ID: ${parcelamentoId}, Parcelas: ${info.total_parcelas}, Valor Total: R$ ${info.valor_total}, Categoria: ${info.categoria}, Descrição: ${info.descricao}`;
      await registrarLog(userId, 'EXCLUIR_PARCELAMENTO', detalhes);
    }
    
    return deleteResult.rowCount;
  } catch (error) {
    fileLogger.error('❌ Erro ao excluir parcelamento:', error);
    throw error;
  }
}

// Excluir todos os lançamentos futuros de um recorrente
async function excluirRecorrentePorId(userId, recorrenteId) {
  try {
    // Buscar informações do recorrente antes de excluir
    const query = `
      SELECT COUNT(*) as total_recorrencias, valor, descricao, categoria
      FROM lancamentos 
      WHERE user_id = $1 AND recorrente_id = $2
    `;
    const result = await pool.query(query, [userId, recorrenteId]);
    const info = result.rows[0];
    
    const deleteQuery = `
      DELETE FROM lancamentos
      WHERE user_id = $1 AND recorrente_id = $2 AND data >= CURRENT_DATE
      RETURNING id
    `;
    const deleteResult = await pool.query(deleteQuery, [userId, recorrenteId]);
    
    // Registrar log de auditoria
    if (info && info.total_recorrencias > 0) {
      const detalhes = `Recorrente ID: ${recorrenteId}, Recorrências: ${info.total_recorrencias}, Valor: R$ ${info.valor}, Categoria: ${info.categoria}, Descrição: ${info.descricao}`;
      await registrarLog(userId, 'EXCLUIR_RECORRENTE', detalhes);
    }
    
    return deleteResult.rowCount;
  } catch (error) {
    fileLogger.error('❌ Erro ao excluir recorrente:', error);
    throw error;
  }
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

// Função para normalizar texto removendo acentos
function normalizarTexto(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Buscar faturas de cartão por mês/ano
async function buscarFaturaCartao(userId, nomeCartao, mes, ano) {
  // Normalizar o nome do cartão para remover acentos
  const nomeCartaoNormalizado = normalizarTexto(nomeCartao);
  
  // Buscar todos os cartões configurados para encontrar matches
  const cartoesQuery = `
    SELECT nome_cartao
    FROM cartoes_config 
    WHERE user_id = $1
  `;
  
  const cartoesResult = await pool.query(cartoesQuery, [userId]);
  const cartoes = cartoesResult.rows;
  
  // Encontrar o nome exato do cartão que corresponde ao input normalizado
  let nomeCartaoExato = null;
  for (const cartao of cartoes) {
    if (normalizarTexto(cartao.nome_cartao) === nomeCartaoNormalizado) {
      nomeCartaoExato = cartao.nome_cartao;
      break;
    }
  }
  
  // Se não encontrou match, usar o nome original
  if (!nomeCartaoExato) {
    nomeCartaoExato = nomeCartao;
  }
  
  const query = `
    SELECT id, data_lancamento, descricao, valor, categoria, data_contabilizacao, dia_vencimento
    FROM lancamentos 
    WHERE user_id = $1 
      AND cartao_nome ILIKE $2
      AND mes_fatura = $3
      AND ano_fatura = $4
    ORDER BY data_lancamento ASC
  `;
  
  const result = await pool.query(query, [userId, `%${nomeCartaoExato}%`, mes, ano]);
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

// ===== FUNÇÕES DE ALERTA =====

// Buscar cartões com vencimento próximo (3 dias antes e no dia)
async function buscarCartoesVencimentoProximo(userId) {
  const hoje = new Date();
  const tresDias = new Date(hoje);
  tresDias.setDate(hoje.getDate() + 3);
  
  const query = `
    SELECT DISTINCT nome_cartao, dia_vencimento
    FROM cartoes_config 
    WHERE user_id = $1
      AND (
        dia_vencimento = EXTRACT(DAY FROM CURRENT_DATE) OR
        dia_vencimento = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '3 days')
      )
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
}

// Buscar boletos com vencimento próximo (3 dias antes e no dia)
async function buscarBoletosVencimentoProximo(userId) {
  const hoje = new Date();
  const tresDias = new Date(hoje);
  tresDias.setDate(hoje.getDate() + 3);
  
  const query = `
    SELECT id, descricao, valor, data_vencimento, categoria
    FROM lancamentos 
    WHERE user_id = $1
      AND pagamento ILIKE '%boleto%'
      AND data_vencimento IS NOT NULL
      AND data_vencimento >= CURRENT_DATE
      AND data_vencimento <= CURRENT_DATE + INTERVAL '3 days'
    ORDER BY data_vencimento ASC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
}

// Buscar todos os alertas do dia (cartões + boletos)
async function buscarAlertasDoDia(userId) {
  const cartoes = await buscarCartoesVencimentoProximo(userId);
  const boletos = await buscarBoletosVencimentoProximo(userId);
  
  return {
    cartoes,
    boletos,
    temAlertas: cartoes.length > 0 || boletos.length > 0
  };
}

// Função para formatar mensagem de alerta de cartão
function formatarAlertaCartao(cartao) {
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  
  if (cartao.dia_vencimento === diaHoje) {
    return `🔴 *VENCIMENTO HOJE*: Cartão ${cartao.nome_cartao}`;
  } else {
    const diasRestantes = cartao.dia_vencimento - diaHoje;
    return `🟡 *VENCIMENTO EM ${diasRestantes} DIAS*: Cartão ${cartao.nome_cartao}`;
  }
}

// Função para formatar mensagem de alerta de boleto
function formatarAlertaBoleto(boleto) {
  const hoje = new Date();
  const vencimento = new Date(boleto.data_vencimento);
  const diffTime = vencimento - hoje;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const valorFormatado = parseFloat(boleto.valor).toFixed(2);
  
  if (diffDays === 0) {
    return `🔴 *VENCIMENTO HOJE*: ${boleto.descricao} - R$ ${valorFormatado}`;
  } else {
    return `🟡 *VENCIMENTO EM ${diffDays} DIAS*: ${boleto.descricao} - R$ ${valorFormatado}`;
  }
}

// Função para gerar mensagem completa de alertas
function gerarMensagemAlertas(alertas) {
  if (!alertas.temAlertas) {
    return null;
  }
  
  let mensagem = "🚨 *ALERTAS DE VENCIMENTO*\n\n";
  
  // Alertas de cartões
  if (alertas.cartoes.length > 0) {
    mensagem += "*💳 CARTÕES DE CRÉDITO:*\n";
    alertas.cartoes.forEach(cartao => {
      mensagem += `• ${formatarAlertaCartao(cartao)}\n`;
    });
    mensagem += "\n";
  }
  
  // Alertas de boletos
  if (alertas.boletos.length > 0) {
    mensagem += "*📄 BOLETOS:*\n";
    alertas.boletos.forEach(boleto => {
      mensagem += `• ${formatarAlertaBoleto(boleto)}\n`;
    });
  }
  
  return mensagem;
}

// Função genérica para executar queries
async function queryDatabase(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    fileLogger.error('[DATABASE] Erro na query:', error);
    throw error;
  }
}

// ===== FUNÇÕES DE ADMINISTRAÇÃO E AUDITORIA =====

/**
 * Registra log de auditoria
 */
async function registrarLog(userId, acao, detalhes = null) {
  try {
    const query = `
      INSERT INTO logs_auditoria (user_id, acao, detalhes) 
      VALUES ($1, $2, $3)
    `;
    await pool.query(query, [userId, acao, detalhes]);
  } catch (error) {
    fileLogger.error('[LOGS] Erro ao registrar log:', error);
  }
}

/**
 * Busca logs recentes de auditoria
 */
async function buscarLogsRecentes(limite = 10) {
  try {
    const query = `
      SELECT user_id, acao, detalhes, timestamp
      FROM logs_auditoria 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limite]);
    return result.rows;
  } catch (error) {
    fileLogger.error('[LOGS] Erro ao buscar logs:', error);
    return [];
  }
}

/**
 * Gera estatísticas do sistema
 */
async function gerarEstatisticasSistema() {
  try {
    // Contar usuários ativos (que fizeram lançamentos nos últimos 30 dias)
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);
    
    const usuariosAtivosQuery = `
      SELECT COUNT(DISTINCT user_id) as total
      FROM lancamentos 
      WHERE criado_em >= $1
    `;
    const usuariosResult = await pool.query(usuariosAtivosQuery, [dataLimite.toISOString()]);
    
    // Total de lançamentos
    const totalLancamentosQuery = `SELECT COUNT(*) as total FROM lancamentos`;
    const totalResult = await pool.query(totalLancamentosQuery);
    
    // Cartões configurados
    const cartoesQuery = `SELECT COUNT(*) as total FROM cartoes_config`;
    const cartoesResult = await pool.query(cartoesQuery);
    
    // Lançamentos de hoje
    const hoje = new Date().toISOString().split('T')[0];
    const lancamentosHojeQuery = `
      SELECT COUNT(*) as total 
      FROM lancamentos 
      WHERE DATE(criado_em) = $1
    `;
    const lancamentosHojeResult = await pool.query(lancamentosHojeQuery, [hoje]);
    
    // Última atividade
    const ultimaAtividadeQuery = `
      SELECT MAX(criado_em) as ultima
      FROM lancamentos
    `;
    const ultimaResult = await pool.query(ultimaAtividadeQuery);
    
    // Tamanho aproximado do banco
    const tamanhoQuery = `
      SELECT pg_size_pretty(pg_total_relation_size('lancamentos')) as tamanho
    `;
    const tamanhoResult = await pool.query(tamanhoQuery);
    
    return {
      usuariosAtivos: usuariosResult.rows[0]?.total || 0,
      totalLancamentos: totalResult.rows[0]?.total || 0,
      cartoesConfigurados: cartoesResult.rows[0]?.total || 0,
      alertasHoje: 0, // Será implementado quando tivermos tabela de alertas
      tamanhoBanco: tamanhoResult.rows[0]?.tamanho || 'N/A',
      ultimaAtividade: ultimaResult.rows[0]?.ultima ? 
        new Date(ultimaResult.rows[0].ultima).toLocaleString('pt-BR') : 'N/A',
      lancamentosHoje: lancamentosHojeResult.rows[0]?.total || 0
    };
  } catch (error) {
    fileLogger.error('[STATS] Erro ao gerar estatísticas:', error);
    throw error;
  }
}

/**
 * Gera backup em formato CSV
 */
async function gerarBackupCSV(userId) {
  try {
    // Buscar todos os lançamentos do usuário
    const query = `
      SELECT 
        data,
        tipo,
        descricao,
        valor,
        categoria,
        pagamento,
        criado_em,
        parcelamento_id,
        parcela_atual,
        total_parcelas,
        recorrente,
        recorrente_fim,
        recorrente_id,
        cartao_nome,
        data_lancamento,
        data_contabilizacao,
        mes_fatura,
        ano_fatura,
        dia_vencimento,
        status_fatura,
        data_vencimento
      FROM lancamentos 
      WHERE user_id = $1 
      ORDER BY data DESC, criado_em DESC
    `;
    
    const result = await pool.query(query, [userId]);
    const lancamentos = result.rows;
    
    // Gerar cabeçalho CSV
    const headers = [
      'Data',
      'Tipo',
      'Descrição',
      'Valor',
      'Categoria',
      'Pagamento',
      'Criado em',
      'Parcelamento ID',
      'Parcela Atual',
      'Total Parcelas',
      'Recorrente',
      'Recorrente Fim',
      'Recorrente ID',
      'Cartão',
      'Data Lançamento',
      'Data Contabilização',
      'Mês Fatura',
      'Ano Fatura',
      'Dia Vencimento',
      'Status Fatura',
      'Data Vencimento'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    // Adicionar dados
    lancamentos.forEach(lancamento => {
      // Função para formatar data
      const formatarData = (data) => {
        if (!data) return '';
        if (typeof data === 'string') {
          // Se já é string, verificar se é formato ISO
          if (data.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [ano, mes, dia] = data.split('-');
            return `${dia}/${mes}/${ano}`;
          }
          return data;
        }
        if (data instanceof Date) {
          return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        }
        return '';
      };

      const row = [
        formatarData(lancamento.data),
        lancamento.tipo,
        `"${lancamento.descricao || ''}"`,
        lancamento.valor,
        lancamento.categoria,
        lancamento.pagamento,
        formatarData(lancamento.criado_em),
        lancamento.parcelamento_id || '',
        lancamento.parcela_atual || '',
        lancamento.total_parcelas || '',
        lancamento.recorrente ? 'true' : 'false',
        formatarData(lancamento.recorrente_fim),
        lancamento.recorrente_id || '',
        lancamento.cartao_nome || '',
        formatarData(lancamento.data_lancamento),
        formatarData(lancamento.data_contabilizacao),
        lancamento.mes_fatura || '',
        lancamento.ano_fatura || '',
        lancamento.dia_vencimento || '',
        lancamento.status_fatura || '',
        formatarData(lancamento.data_vencimento)
      ];
      csvContent += row.join(',') + '\n';
    });
    
    const tamanho = Math.round(csvContent.length / 1024); // KB
    
    return {
      csvContent,
      totalLancamentos: lancamentos.length,
      tamanho
    };
  } catch (error) {
    fileLogger.error('[BACKUP] Erro ao gerar backup:', error);
    throw error;
  }
}

/**
 * Limpa dados antigos (mais de 2 anos)
 */
async function limparDadosAntigos() {
  const inicio = Date.now();
  
  try {
    // Calcular data limite (2 anos atrás)
    const dataLimite = new Date();
    dataLimite.setFullYear(dataLimite.getFullYear() - 2);
    
    // Contar lançamentos que serão removidos
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lancamentos 
      WHERE data < $1
    `;
    const countResult = await pool.query(countQuery, [dataLimite.toISOString().split('T')[0]]);
    const lancamentosParaRemover = countResult.rows[0]?.total || 0;
    
    // Remover lançamentos antigos
    const deleteQuery = `
      DELETE FROM lancamentos 
      WHERE data < $1
    `;
    await pool.query(deleteQuery, [dataLimite.toISOString().split('T')[0]]);
    
    // Calcular tempo de processamento
    const tempoProcessamento = Math.round((Date.now() - inicio) / 1000);
    
    // Calcular espaço liberado (aproximado)
    const espacoLiberado = Math.round(lancamentosParaRemover * 0.1); // ~100 bytes por registro
    
    return {
      lancamentosRemovidos: lancamentosParaRemover,
      espacoLiberado,
      tempoProcessamento,
      dataLimite: dataLimite.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };
  } catch (error) {
    fileLogger.error('[LIMPEZA] Erro ao limpar dados:', error);
    throw error;
  }
}

/**
 * Gera log de auditoria em formato CSV
 */
async function gerarLogAuditoria(limite = 100) {
  try {
    const query = `
      SELECT user_id, acao, detalhes, timestamp
      FROM logs_auditoria
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limite]);
    const logs = result.rows;
    const headers = ['User ID', 'Ação', 'Detalhes', 'Timestamp'];
    let csv = headers.join(',') + '\n';
    logs.forEach(log => {
      csv += [
        log.user_id,
        log.acao,
        '"' + (log.detalhes ? log.detalhes.replace(/"/g, '""') : '') + '"',
        log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
      ].join(',') + '\n';
    });
    return { csv, total: logs.length };
  } catch (error) {
    fileLogger.error('[LOGS] Erro ao gerar log de auditoria:', error);
    throw error;
  }
}

// Função para buscar lançamentos parcelados ativos
async function buscarParceladosAtivos(userId, limite = 20) {
  try {
    const query = `
      SELECT 
        l.*,
        COUNT(*) OVER (PARTITION BY l.parcelamento_id) as total_parcelas,
        ROW_NUMBER() OVER (PARTITION BY l.parcelamento_id ORDER BY l.data) as parcela_atual
      FROM lancamentos l
      WHERE l.user_id = $1 
        AND l.parcelamento_id IS NOT NULL
        AND l.data >= CURRENT_DATE - INTERVAL '1 year'
      ORDER BY l.parcelamento_id, l.data
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limite]);
    
    // Agrupar por parcelamento_id
    const parcelamentos = {};
    result.rows.forEach(row => {
      if (!parcelamentos[row.parcelamento_id]) {
        parcelamentos[row.parcelamento_id] = {
          parcelamento_id: row.parcelamento_id,
          descricao: row.descricao.replace(/ \(\d+\/\d+\)$/, ''), // Remove (1/12) da descrição
          valor_total: 0,
          valor_parcela: 0,
          total_parcelas: row.total_parcelas,
          parcelas: [],
          categoria: row.categoria,
          pagamento: row.pagamento,
          primeira_parcela: null,
          ultima_parcela: null
        };
      }
      
      parcelamentos[row.parcelamento_id].parcelas.push({
        id: row.id,
        data: row.data,
        valor: parseFloat(row.valor),
        parcela_atual: row.parcela_atual,
        status: row.data < CURRENT_DATE ? 'paga' : 'pendente'
      });
      
      parcelamentos[row.parcelamento_id].valor_total += parseFloat(row.valor);
      parcelamentos[row.parcelamento_id].valor_parcela = parseFloat(row.valor);
      
      if (!parcelamentos[row.parcelamento_id].primeira_parcela || row.data < parcelamentos[row.parcelamento_id].primeira_parcela) {
        parcelamentos[row.parcelamento_id].primeira_parcela = row.data;
      }
      if (!parcelamentos[row.parcelamento_id].ultima_parcela || row.data > parcelamentos[row.parcelamento_id].ultima_parcela) {
        parcelamentos[row.parcelamento_id].ultima_parcela = row.data;
      }
    });
    
    return Object.values(parcelamentos);
  } catch (error) {
    fileLogger.error('Erro ao buscar parcelados ativos:', error);
    throw error;
  }
}

// Função para buscar lançamentos recorrentes ativos
async function buscarRecorrentesAtivos(userId, limite = 20) {
  try {
    const query = `
      SELECT 
        l.*,
        COUNT(*) OVER (PARTITION BY l.recorrente_id) as total_recorrencias,
        ROW_NUMBER() OVER (PARTITION BY l.recorrente_id ORDER BY l.data) as recorrencia_atual
      FROM lancamentos l
      WHERE l.user_id = $1 
        AND l.recorrente_id IS NOT NULL
        AND l.data >= CURRENT_DATE - INTERVAL '1 year'
      ORDER BY l.recorrente_id, l.data
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limite]);
    
    // Agrupar por recorrente_id
    const recorrentes = {};
    result.rows.forEach(row => {
      if (!recorrentes[row.recorrente_id]) {
        recorrentes[row.recorrente_id] = {
          recorrente_id: row.recorrente_id,
          descricao: row.descricao,
          valor: parseFloat(row.valor),
          total_recorrencias: row.total_recorrencias,
          recorrencias: [],
          categoria: row.categoria,
          pagamento: row.pagamento,
          primeira_recorrencia: null,
          ultima_recorrencia: null,
          recorrente_fim: row.recorrente_fim
        };
      }
      
      recorrentes[row.recorrente_id].recorrencias.push({
        id: row.id,
        data: row.data,
        recorrencia_atual: row.recorrencia_atual,
        status: row.data < CURRENT_DATE ? 'paga' : 'pendente'
      });
      
      if (!recorrentes[row.recorrente_id].primeira_recorrencia || row.data < recorrentes[row.recorrente_id].primeira_recorrencia) {
        recorrentes[row.recorrente_id].primeira_recorrencia = row.data;
      }
      if (!recorrentes[row.recorrente_id].ultima_recorrencia || row.data > recorrentes[row.recorrente_id].ultima_recorrencia) {
        recorrentes[row.recorrente_id].ultima_recorrencia = row.data;
      }
    });
    
    return Object.values(recorrentes);
  } catch (error) {
    fileLogger.error('Erro ao buscar recorrentes ativos:', error);
    throw error;
  }
}

// Função para buscar próximos vencimentos
async function buscarProximosVencimentos(userId, dias = 30) {
  try {
    const query = `
      SELECT 
        l.*,
        CASE 
          WHEN l.cartao_nome IS NOT NULL THEN 'cartao'
          WHEN l.data_vencimento IS NOT NULL THEN 'boleto'
          ELSE 'outro'
        END as tipo_vencimento,
        CASE 
          WHEN l.cartao_nome IS NOT NULL THEN l.data_contabilizacao
          ELSE l.data_vencimento
        END as data_vencimento_real
      FROM lancamentos l
      WHERE l.user_id = $1 
        AND (
          (l.cartao_nome IS NOT NULL AND l.data_contabilizacao >= CURRENT_DATE AND l.data_contabilizacao <= CURRENT_DATE + INTERVAL '1 day' * $2)
          OR 
          (l.data_vencimento IS NOT NULL AND l.data_vencimento >= CURRENT_DATE AND l.data_vencimento <= CURRENT_DATE + INTERVAL '1 day' * $2)
        )
        AND l.tipo = 'gasto'
      ORDER BY data_vencimento_real
    `;
    
    const result = await pool.query(query, [userId, dias]);
    
    // Agrupar por tipo e data
    const vencimentos = {
      cartoes: [],
      boletos: [],
      outros: []
    };
    
    result.rows.forEach(row => {
      const vencimento = {
        id: row.id,
        descricao: row.descricao,
        valor: parseFloat(row.valor),
        categoria: row.categoria,
        data_vencimento: row.data_vencimento_real,
        dias_restantes: Math.ceil((new Date(row.data_vencimento_real) - new Date()) / (1000 * 60 * 60 * 24)),
        cartao_nome: row.cartao_nome,
        status: row.status_fatura || 'pendente'
      };
      
      if (row.tipo_vencimento === 'cartao') {
        vencimentos.cartoes.push(vencimento);
      } else if (row.tipo_vencimento === 'boleto') {
        vencimentos.boletos.push(vencimento);
      } else {
        vencimentos.outros.push(vencimento);
      }
    });
    
    return vencimentos;
  } catch (error) {
    fileLogger.error('Erro ao buscar próximos vencimentos:', error);
    throw error;
  }
}

// Função para buscar gastos por categoria específica
async function buscarGastosPorCategoria(userId, categoria, limite = 20, mes = null, ano = null) {
  try {
    let query = `
      SELECT l.*
      FROM lancamentos l
      WHERE l.user_id = $1 
        AND LOWER(l.categoria) = LOWER($2)
        AND l.tipo = 'gasto'
    `;
    
    const params = [userId, categoria];
    let paramIndex = 3;
    
    if (mes && ano) {
      query += ` AND EXTRACT(MONTH FROM l.data) = $${paramIndex} AND EXTRACT(YEAR FROM l.data) = $${paramIndex + 1}`;
      params.push(mes, ano);
      paramIndex += 2;
    }
    
    query += ` ORDER BY l.data DESC LIMIT $${paramIndex}`;
    params.push(limite);
    
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      valor: parseFloat(row.valor)
    }));
  } catch (error) {
    fileLogger.error('Erro ao buscar gastos por categoria:', error);
    throw error;
  }
}

// Função para buscar gastos com valor alto
async function buscarGastosValorAlto(userId, valorMinimo = 100, limite = 20, mes = null, ano = null) {
  try {
    let query = `
      SELECT l.*
      FROM lancamentos l
      WHERE l.user_id = $1 
        AND l.valor >= $2
        AND l.tipo = 'gasto'
    `;
    
    const params = [userId, valorMinimo];
    let paramIndex = 3;
    
    if (mes && ano) {
      query += ` AND EXTRACT(MONTH FROM l.data) = $${paramIndex} AND EXTRACT(YEAR FROM l.data) = $${paramIndex + 1}`;
      params.push(mes, ano);
      paramIndex += 2;
    }
    
    query += ` ORDER BY l.valor DESC, l.data DESC LIMIT $${paramIndex}`;
    params.push(limite);
    
    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      valor: parseFloat(row.valor)
    }));
  } catch (error) {
    fileLogger.error('Erro ao buscar gastos com valor alto:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initializeDatabase,
  appendRowToDatabase,
  getDatabaseData,
  getResumoDoMesAtual,
  getResumoDoDia,
  getResumoPorMes,
  getGastosPorCategoria,
  listarLancamentos,
  formatarValor,
  getUltimosLancamentos,
  getLancamentoPorId,
  atualizarLancamentoPorId,
  excluirLancamentoPorId,
  getTotalGastosPorPagamento,
  excluirParcelamentoPorId,
  excluirRecorrentePorId,
  buscarLancamentosParaExclusao,
  buscarFaturaCartao,
  getResumoReal,
  buscarCartoesVencimentoProximo,
  buscarBoletosVencimentoProximo,
  buscarAlertasDoDia,
  formatarAlertaCartao,
  formatarAlertaBoleto,
  gerarMensagemAlertas,
  queryDatabase,
  registrarLog,
  buscarLogsRecentes,
  gerarEstatisticasSistema,
  gerarBackupCSV,
  limparDadosAntigos,
  gerarLogAuditoria,
  salvarConfiguracaoCartao,
  atualizarCartaoConfigurado,
  buscarConfiguracaoCartao,
  listarCartoesConfigurados,
  excluirCartaoConfigurado,
  contarLancamentosAssociadosCartao,
  calcularDataContabilizacao,
  normalizarTexto,
  buscarParceladosAtivos,
  buscarRecorrentesAtivos,
  buscarProximosVencimentos,
  buscarGastosPorCategoria,
  buscarGastosValorAlto
}; 