-- ==============================================================================
-- ORLINX GROUP & ORLINX ADS - Schema de Banco de Dados Centralizado (Supabase)
-- Projeto Oficial Exclusivo: ulajrvkaqqedwuaiaksp
-- Migração: 20261008_orlinx_ads_schema.sql
-- ==============================================================================
-- ATENÇÃO: Controles estritos de segurança RLS baseados em tabela de administradores.
-- NENHUMA concessão genérica para auth.role() = 'authenticated'.
-- Prevenção total de recursão infinita via função SECURITY DEFINER.
-- ==============================================================================

-- 1. Tabela de Administradores Autorizados (orx_admins)
CREATE TABLE IF NOT EXISTS public.orx_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Função de Verificação Administrativa com Prevenção de Recursão RLS
-- Executada como SECURITY DEFINER com search_path restrito para evitar recursão
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.orx_admins
        WHERE user_id = p_user_id
          AND is_active = true
          AND role = 'admin'
    );
$$;

-- 3. Tabela de Pedidos Comerciais de Anunciantes (orx_ads_orders)
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

-- 4. Tabela de Campanhas em Rotação Ativa (orx_ads_campaigns)
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

-- 5. Tabela de Auditoria e Telemetria (orx_ads_telemetry)
CREATE TABLE IF NOT EXISTS public.orx_ads_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.orx_ads_campaigns(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL, -- 'impression', 'click'
    slot VARCHAR(50) NOT NULL,
    user_agent_hash VARCHAR(64),
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Habilitação Obrigatória de Row Level Security (RLS)
ALTER TABLE public.orx_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_ads_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_ads_telemetry ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS DE CONTROLE DE ACESSO (RLS POLICIES)
-- Autorização restrita exclusivamente a administradores validados em orx_admins
-- ==============================================================================

-- A. Tabela orx_admins
DROP POLICY IF EXISTS "Admins can view admin list" ON public.orx_admins;
CREATE POLICY "Admins can view admin list"
    ON public.orx_admins
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage admin list" ON public.orx_admins;
CREATE POLICY "Admins can manage admin list"
    ON public.orx_admins
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- B. Tabela orx_ads_campaigns
-- Visitantes anônimos e autenticados só visualizam campanhas ATIVAS dentro do prazo
DROP POLICY IF EXISTS "Public can view active campaigns" ON public.orx_ads_campaigns;
CREATE POLICY "Public can view active campaigns"
    ON public.orx_ads_campaigns
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'active'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
    );

-- Somente administradores explícitos em orx_admins têm controle total de campanhas
DROP POLICY IF EXISTS "Admins have full access to campaigns" ON public.orx_ads_campaigns;
CREATE POLICY "Admins have full access to campaigns"
    ON public.orx_ads_campaigns
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- C. Tabela orx_ads_orders
-- Anunciantes anônimos/públicos só podem submeter pedidos sob análise com campos válidos
DROP POLICY IF EXISTS "Anon can insert orders" ON public.orx_ads_orders;
CREATE POLICY "Anon can insert orders"
    ON public.orx_ads_orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        status = 'pending_review'
        AND length(company_name) >= 3
        AND length(email) >= 5
        AND (target_url LIKE 'http://%' OR target_url LIKE 'https://%')
    );

-- Somente administradores explícitos em orx_admins podem visualizar e gerenciar pedidos
DROP POLICY IF EXISTS "Admins can view and manage orders" ON public.orx_ads_orders;
CREATE POLICY "Admins can view and manage orders"
    ON public.orx_ads_orders
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- D. Tabela orx_ads_telemetry
-- Registro público de telemetria com restrição de tipos de evento
DROP POLICY IF EXISTS "Anon can register telemetry" ON public.orx_ads_telemetry;
CREATE POLICY "Anon can register telemetry"
    ON public.orx_ads_telemetry
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (event_type IN ('impression', 'click'));

-- Somente administradores explícitos em orx_admins podem ler dados de telemetria
DROP POLICY IF EXISTS "Admins can view telemetry" ON public.orx_ads_telemetry;
CREATE POLICY "Admins can view telemetry"
    ON public.orx_ads_telemetry
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- 7. Índices de Desempenho e Integridade
CREATE INDEX IF NOT EXISTS idx_orx_admins_role_active ON public.orx_admins(user_id, is_active, role);
CREATE INDEX IF NOT EXISTS idx_orx_campaigns_slot_status ON public.orx_ads_campaigns(slot, status);
CREATE INDEX IF NOT EXISTS idx_orx_orders_status ON public.orx_ads_orders(status);
CREATE INDEX IF NOT EXISTS idx_orx_telemetry_created_at ON public.orx_ads_telemetry(created_at);
