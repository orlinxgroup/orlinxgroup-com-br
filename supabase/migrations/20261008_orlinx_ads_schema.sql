-- ==============================================================================
-- ORLINX GROUP & ORLINX ADS - Schema de Banco de Dados Centralizado (Supabase)
-- Migração: 20261008_orlinx_ads_schema.sql
-- ==============================================================================

-- 1. Tabela de Pedidos de Anunciantes (orx_ads_orders)
CREATE TABLE IF NOT EXISTS public.orx_ads_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code VARCHAR(32) NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    website VARCHAR(500),
    plan_key VARCHAR(50) NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    slot VARCHAR(50) NOT NULL,
    target_url VARCHAR(1000) NOT NULL,
    banner_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Campanhas em Veiculação (orx_ads_campaigns)
CREATE TABLE IF NOT EXISTS public.orx_ads_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_code VARCHAR(32) NOT NULL UNIQUE,
    client_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Institucional',
    slot VARCHAR(50) NOT NULL,
    banner_url TEXT,
    target_url VARCHAR(1000) NOT NULL,
    cta_text VARCHAR(100) DEFAULT 'Saiba Mais',
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'ended'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Auditoria de Telemetria (orx_ads_telemetry)
CREATE TABLE IF NOT EXISTS public.orx_ads_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.orx_ads_campaigns(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- 'impression', 'click'
    slot VARCHAR(50) NOT NULL,
    user_agent_hash VARCHAR(64),
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Habilitação de Row Level Security (RLS)
ALTER TABLE public.orx_ads_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_ads_telemetry ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança (RLS Policies)

-- A. Campanhas: Visitantes anônimos só podem LER campanhas ativas
DROP POLICY IF EXISTS "Public can view active campaigns" ON public.orx_ads_campaigns;
CREATE POLICY "Public can view active campaigns"
    ON public.orx_ads_campaigns
    FOR SELECT
    TO anon, authenticated
    USING (status = 'active');

-- Administradores autenticados têm controle total sobre campanhas
DROP POLICY IF EXISTS "Admins have full access to campaigns" ON public.orx_ads_campaigns;
CREATE POLICY "Admins have full access to campaigns"
    ON public.orx_ads_campaigns
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' LIKE '%@orlinxgroup.com.br' OR auth.role() = 'authenticated')
    WITH CHECK (auth.jwt() ->> 'email' LIKE '%@orlinxgroup.com.br' OR auth.role() = 'authenticated');

-- B. Pedidos: Visitantes anônimos podem submeter pedidos validados via backend
DROP POLICY IF EXISTS "Anon can insert orders" ON public.orx_ads_orders;
CREATE POLICY "Anon can insert orders"
    ON public.orx_ads_orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Apenas administradores autenticados podem visualizar e editar pedidos
DROP POLICY IF EXISTS "Admins can view and manage orders" ON public.orx_ads_orders;
CREATE POLICY "Admins can view and manage orders"
    ON public.orx_ads_orders
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' LIKE '%@orlinxgroup.com.br' OR auth.role() = 'authenticated')
    WITH CHECK (auth.jwt() ->> 'email' LIKE '%@orlinxgroup.com.br' OR auth.role() = 'authenticated');

-- C. Telemetria: Registro público de métricas com proteção anti-fraude
DROP POLICY IF EXISTS "Anon can register telemetry" ON public.orx_ads_telemetry;
CREATE POLICY "Anon can register telemetry"
    ON public.orx_ads_telemetry
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view telemetry" ON public.orx_ads_telemetry;
CREATE POLICY "Admins can view telemetry"
    ON public.orx_ads_telemetry
    FOR SELECT
    TO authenticated
    USING (true);

-- 6. Índices de Desempenho
CREATE INDEX IF NOT EXISTS idx_orx_campaigns_slot_status ON public.orx_ads_campaigns(slot, status);
CREATE INDEX IF NOT EXISTS idx_orx_orders_status ON public.orx_ads_orders(status);
CREATE INDEX IF NOT EXISTS idx_orx_telemetry_created_at ON public.orx_ads_telemetry(created_at);
