-- ==============================================================================
-- ORLINX GROUP & ORLINX ADS - Procedimento de Rollback Não-Destrutivo
-- Projeto Oficial Exclusivo: ulajrvkaqqedwuaiaksp
-- Arquivo: 20261014_orlinx_briefing_schema_rollback.sql
-- ==============================================================================
-- DIRETRIZ DE GOVERNANÇA: NUNCA EXECUTAR DROP TABLE INDISCRIMINADAMENTE.
-- Briefings e consentimentos LGPD constituem registros jurídicos e comerciais.
-- Em caso de rollback, as tabelas são arquivadas de forma segura e preservadas.
-- ==============================================================================

BEGIN;

-- 1. Desativação Imediata de Acesso Público (Corta submissões sem perder dados)
REVOKE INSERT ON public.orx_briefings FROM anon;
REVOKE ALL ON public.orx_briefing_audit_log FROM anon;
DROP POLICY IF EXISTS "Public can submit briefing" ON public.orx_briefings;
DROP POLICY IF EXISTS "Public can upload briefing files" ON storage.objects;

-- 2. Remoção Segura de Triggers e Funções de Auditoria
DROP TRIGGER IF EXISTS trg_orx_briefing_audit_created ON public.orx_briefings;
DROP FUNCTION IF EXISTS public.fn_orx_briefing_audit_created();

-- 3. Arquivamento Não-Destrutivo das Tabelas (Preservação Integral de Histórico)
-- As tabelas operacionais são renomeadas com carimbo de arquivamento para não colidir
-- com futuras implementações, mantendo todos os registros acessíveis para a diretoria.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orx_briefings') THEN
        ALTER TABLE public.orx_briefings RENAME TO orx_briefings_archived_20261014;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orx_briefing_audit_log') THEN
        ALTER TABLE public.orx_briefing_audit_log RENAME TO orx_briefing_audit_log_archived_20261014;
    END IF;
END $$;

-- 4. Governança e Restrição Estrita das Tabelas Arquivadas
-- Somente administradores têm permissão de leitura nos arquivos mortos; anônimo tem acesso ZERO.
REVOKE ALL ON public.orx_briefings_archived_20261014 FROM anon, public;
REVOKE ALL ON public.orx_briefing_audit_log_archived_20261014 FROM anon, public;

COMMIT;

-- OBSERVAÇÃO TÉCNICA PARA O SERVIDOR:
-- Os arquivos físicos armazenados em data/briefing_uploads/ no servidor NÃO são excluídos
-- no rollback, garantindo conformidade com a política de retenção documental e LGPD.
