-- simplou-bot — Schema PostgreSQL
-- Gerado pelo Reversa Reconstructor em 2026-05-17
-- Timezone: America/Sao_Paulo (configurar por conexão via SET timezone)
-- Sem FK constraints — integridade referencial na camada de aplicação

-- ---------------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------------------------
-- TABELA: usuarios
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
  id                     UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                VARCHAR(50)  NOT NULL UNIQUE,          -- JID WhatsApp: 55xx@s.whatsapp.net
  nome                   VARCHAR(100),
  telefone               VARCHAR(20),
  plano                  VARCHAR(20)  NOT NULL DEFAULT 'gratuito', -- gratuito | premium
  status                 VARCHAR(20)           DEFAULT 'ativo',    -- ativo | inativo
  data_cadastro          TIMESTAMPTZ           DEFAULT CURRENT_TIMESTAMP,
  data_ultimo_acesso     TIMESTAMPTZ,
  data_expiracao_premium TIMESTAMPTZ,                             -- NULL = gratuito ou premium permanente
  is_admin               BOOLEAN               DEFAULT false,
  criado_por             VARCHAR(50),                             -- user_id do admin que cadastrou
  observacoes            TEXT,
  criado_em              TIMESTAMPTZ           DEFAULT CURRENT_TIMESTAMP,
  atualizado_em          TIMESTAMPTZ           DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_user_id ON usuarios (user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_plano    ON usuarios (plano);
CREATE INDEX IF NOT EXISTS idx_usuarios_status   ON usuarios (status);
CREATE INDEX IF NOT EXISTS idx_usuarios_admin    ON usuarios (is_admin);

-- ---------------------------------------------------------------------------
-- TABELA: cartoes_config
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartoes_config (
  id              UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         VARCHAR(50)  NOT NULL,                -- FK app-level → usuarios.user_id
  nome_cartao     VARCHAR(50)  NOT NULL,                -- único por user_id
  dia_vencimento  INTEGER      NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  dia_fechamento  INTEGER               CHECK (dia_fechamento BETWEEN 1 AND 31), -- NULL = vencimento-7 (min 1)
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_cartoes_user_nome UNIQUE (user_id, nome_cartao)
);

-- ---------------------------------------------------------------------------
-- TABELA: lancamentos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lancamentos (
  id                  UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             VARCHAR(50)    NOT NULL,                -- FK app-level → usuarios.user_id
  data                DATE           NOT NULL,
  tipo                VARCHAR(20)    NOT NULL CHECK (tipo IN ('receita', 'gasto')),
  descricao           TEXT,
  valor               DECIMAL(10,2)  NOT NULL,
  categoria           VARCHAR(50),
  pagamento           VARCHAR(20),                            -- pix | credito | debito | boleto | transferencia
  criado_em           TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Parcelamento
  parcelamento_id     VARCHAR(100),                           -- agrupa parcelas do mesmo parcelamento
  parcela_atual       INTEGER,                                -- 1-based
  total_parcelas      INTEGER,

  -- Recorrência
  recorrente          BOOLEAN                 DEFAULT false,
  recorrente_fim      DATE,
  recorrente_id       VARCHAR(100),                           -- agrupa lançamentos recorrentes

  -- Cartão de crédito
  cartao_nome         VARCHAR(50),                            -- FK app-level → cartoes_config.nome_cartao
  data_lancamento     DATE,                                   -- data original do gasto
  data_contabilizacao DATE,                                   -- data de competência na fatura
  mes_fatura          INTEGER,                                -- 1-12
  ano_fatura          INTEGER,
  dia_vencimento      INTEGER,                                -- copiado do cartão na criação

  -- Boleto
  data_vencimento     DATE,                                   -- vencimento do boleto

  -- Status
  status_fatura       VARCHAR(20)             DEFAULT 'pendente'
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id         ON lancamentos (user_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data            ON lancamentos (data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo            ON lancamentos (tipo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_parcelamento_id ON lancamentos (parcelamento_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_recorrente_id   ON lancamentos (recorrente_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_cartao_fatura   ON lancamentos (user_id, mes_fatura, ano_fatura, cartao_nome);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_vencimento ON lancamentos (data_vencimento);

-- ---------------------------------------------------------------------------
-- TABELA: lembretes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lembretes (
  id                    UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               VARCHAR(50)    NOT NULL,              -- FK app-level → usuarios.user_id
  titulo                VARCHAR(100)   NOT NULL,
  descricao             TEXT,
  valor                 DECIMAL(10,2),
  categoria             VARCHAR(50),
  data_vencimento       DATE           NOT NULL,
  recorrente            BOOLEAN        NOT NULL DEFAULT false,
  tipo_recorrencia      VARCHAR(20)    CHECK (tipo_recorrencia IN ('semanal', 'mensal', 'anual')),
  dias_antecedencia     INTEGER        NOT NULL DEFAULT 3 CHECK (dias_antecedencia BETWEEN 0 AND 30),
  ativo                 BOOLEAN        NOT NULL DEFAULT true,
  auto_criar_lancamento BOOLEAN        NOT NULL DEFAULT false,
  proximo_envio         DATE,
  ultimo_envio          DATE,
  criado_em             TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lembretes_user_id         ON lembretes (user_id);
CREATE INDEX IF NOT EXISTS idx_lembretes_data_vencimento ON lembretes (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lembretes_ativo           ON lembretes (ativo);
CREATE INDEX IF NOT EXISTS idx_lembretes_proximo_envio   ON lembretes (proximo_envio);
CREATE INDEX IF NOT EXISTS idx_lembretes_user_ativo      ON lembretes (user_id, ativo);

-- ---------------------------------------------------------------------------
-- TABELA: config_sistema
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS config_sistema (
  id          UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave       VARCHAR(50)  NOT NULL UNIQUE,
  valor       TEXT         NOT NULL,
  descricao   TEXT,
  criado_em   TIMESTAMPTZ           DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMPTZ         DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- TABELA: logs_auditoria
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS logs_auditoria (
  id        UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   VARCHAR(50)  NOT NULL,
  acao      VARCHAR(100) NOT NULL,
  detalhes  TEXT,                    -- JSON com detalhes da ação
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_user_id   ON logs_auditoria (user_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_timestamp ON logs_auditoria (timestamp DESC);
