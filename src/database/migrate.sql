-- simplou-bot — Scripts de Migração
-- Gerado pelo Reversa Reconstructor em 2026-05-17

-- ---------------------------------------------------------------------------
-- M-001 — Renomeação tipo='despesa' → tipo='gasto'
-- ADR-003 | G-05 do gaps.md
-- Executar ANTES do primeiro deploy da reimplementação em produção
-- ---------------------------------------------------------------------------

-- Verificar registros afetados antes de executar:
-- SELECT COUNT(*) FROM lancamentos WHERE tipo = 'despesa';

UPDATE lancamentos
  SET tipo = 'gasto',
      atualizado_em = CURRENT_TIMESTAMP
WHERE tipo = 'despesa';

-- Confirmar resultado:
-- SELECT COUNT(*) FROM lancamentos WHERE tipo = 'despesa'; -- deve retornar 0
