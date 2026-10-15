-- ==============================================================================
-- ORLINX GROUP & ORLINX ADS — Validação de Autenticidade de Protocolos
-- Projeto Oficial Supabase: ulajrvkaqqedwuaiaksp
-- ==============================================================================
-- Função RPC Segura: verify_briefing_protocol
-- Retorna exclusivamente TRUE ou FALSE, sem expor nenhum dado confidencial
-- e sem conceder permissão SELECT ampla na tabela orx_briefings.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_briefing_protocol(p_protocol text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.orx_briefings
        WHERE protocol_code = p_protocol
          AND created_at >= (now() - interval '24 hours')
    );
$$;

REVOKE ALL ON FUNCTION public.verify_briefing_protocol(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_briefing_protocol(text) TO anon, authenticated, service_role;
