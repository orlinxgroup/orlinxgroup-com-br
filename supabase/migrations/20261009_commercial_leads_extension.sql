-- ==============================================================================
-- ORLINX GROUP & ORLINX ADS - Extensão de Captação Comercial & Campanhas B2B
-- Projeto Oficial Exclusivo: ulajrvkaqqedwuaiaksp
-- Migração: 20261009_commercial_leads_extension.sql
-- ==============================================================================
-- ATENÇÃO: Esta migração adiciona campos para qualificação de leads comerciais
-- e rastreamento de campanhas Google Ads (UTMs / GCLID) sem quebrar compatibilidade.
-- RLS continua restrito: anon só insere status = 'pending_review'.
-- ==============================================================================

-- 1. Extensão da Tabela de Pedidos / Leads (orx_ads_orders)
ALTER TABLE IF EXISTS public.orx_ads_orders
    ADD COLUMN IF NOT EXISTS lead_source VARCHAR(50) DEFAULT 'anuncie_page',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
    ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100),
    ADD COLUMN IF NOT EXISTS gclid VARCHAR(150);

-- 2. Atualização da Política RLS de Inserção Pública
DROP POLICY IF EXISTS "Anon can insert orders" ON public.orx_ads_orders;
CREATE POLICY "Anon can insert orders"
    ON public.orx_ads_orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        status = 'pending_review'
        AND length(company_name) >= 3
        AND length(email) >= 5
        AND (target_url IS NULL OR target_url LIKE 'http://%' OR target_url LIKE 'https://%')
    );

-- 3. Índice para Consultas por Origem de Lead
CREATE INDEX IF NOT EXISTS idx_orx_orders_lead_source ON public.orx_ads_orders(lead_source);
CREATE INDEX IF NOT EXISTS idx_orx_orders_utm_source ON public.orx_ads_orders(utm_source);
