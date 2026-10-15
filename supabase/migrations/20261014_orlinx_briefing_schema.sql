-- ==============================================================================
-- ORLINX GROUP & ORLINX ADS - Schema de Briefings Digitais & Captação de Sites
-- Projeto Oficial Exclusivo: ulajrvkaqqedwuaiaksp
-- Migração: 20261014_orlinx_briefing_schema.sql
-- ==============================================================================
-- ATENÇÃO: Regras estritas de governança RLS.
-- O público insere briefings exclusivamente com status 'submitted' e consentimento LGPD.
-- Consulta e gestão restritas estritamente a administradores (public.is_admin()).
-- ==============================================================================
-- BACKUP AUTOMÁTICO PRÉVIO (NÃO-DESTRUTIVO)
-- Se a tabela já existir com dados anteriores, cria um snapshot seguro antes da execução.
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orx_briefings') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS public.orx_briefings_pre_backup AS SELECT * FROM public.orx_briefings';
        RAISE NOTICE 'Snapshot de segurança public.orx_briefings_pre_backup criado com sucesso.';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orx_briefing_audit_log') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS public.orx_briefing_audit_log_pre_backup AS SELECT * FROM public.orx_briefing_audit_log';
        RAISE NOTICE 'Snapshot de segurança public.orx_briefing_audit_log_pre_backup criado com sucesso.';
    END IF;
END $$;

-- 0. Pré-requisito de Dependência: Garante existência da tabela de administradores e função is_admin()
-- Idempotente: se já criadas pela migração 20261008, preserva a estrutura; caso contrário, provisiona com segurança.
CREATE TABLE IF NOT EXISTS public.orx_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.orx_admins
        WHERE user_id = auth.uid()
          AND is_active = true
          AND role = 'admin'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 1. Tabela Principal de Briefings (orx_briefings)
CREATE TABLE IF NOT EXISTS public.orx_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_code VARCHAR(32) NOT NULL UNIQUE,

    -- Seção 1: Dados Institucionais & Contato
    company_name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255),
    document_number VARCHAR(32) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    city_state VARCHAR(100),
    business_segment VARCHAR(100),

    -- Seção 2: Visão Geral & Objetivos
    project_type VARCHAR(50) NOT NULL,
    primary_goal VARCHAR(100) NOT NULL,
    target_audience TEXT,
    project_summary TEXT,

    -- Seção 3: Escopo, Páginas & Funcionalidades
    required_pages JSONB DEFAULT '[]'::jsonb,
    custom_features JSONB DEFAULT '[]'::jsonb,
    special_requirements TEXT,

    -- Seção 4: Identidade Visual & Design
    brand_status VARCHAR(50) DEFAULT 'possui_marca_pronta',
    design_style VARCHAR(50) DEFAULT 'moderno_corporativo',
    color_palette JSONB DEFAULT '{}'::jsonb,
    design_notes TEXT,

    -- Seção 5: Documentos & Arquivos Privados (Metadados dos uploads)
    uploaded_files JSONB DEFAULT '[]'::jsonb,

    -- Seção 6: Referências & Concorrência
    benchmark_urls JSONB DEFAULT '[]'::jsonb,
    disliked_elements TEXT,

    -- Seção 7: Conteúdo, Textos & Idiomas
    content_source VARCHAR(50) DEFAULT 'cliente_fornece_pronto',
    media_source VARCHAR(50) DEFAULT 'fotos_proprias',
    languages JSONB DEFAULT '["pt-BR"]'::jsonb,

    -- Seção 8: Domínio, Hospedagem & E-mails
    domain_status VARCHAR(50) DEFAULT 'ja_registrado',
    domain_name VARCHAR(255),
    hosting_preference VARCHAR(50) DEFAULT 'hospedagem_orlinx',
    corporate_emails_needed INT DEFAULT 0,

    -- Seção 9: Publicidade ORLINX ADS (Opcional & Independente)
    ads_opt_in BOOLEAN DEFAULT false,
    ads_format VARCHAR(50),
    ads_target_url VARCHAR(1000),
    ads_period_days INT,
    ads_budget_range VARCHAR(50),
    ads_start_date DATE,

    -- Seção 10: Prazos, Investimento, LGPD & Consentimentos
    target_launch_date DATE,
    investment_bracket VARCHAR(50),
    privacy_policy_accepted BOOLEAN NOT NULL DEFAULT false,
    privacy_accepted_at TIMESTAMPTZ,
    privacy_ip_hash VARCHAR(64),
    portfolio_showcase_authorized BOOLEAN NOT NULL DEFAULT false,
    portfolio_authorized_at TIMESTAMPTZ,

    -- Status e Controle Interno
    status VARCHAR(30) NOT NULL DEFAULT 'submitted', -- 'submitted', 'under_review', 'proposal_sent', 'approved', 'archived'
    admin_notes TEXT,
    pdf_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Logs de Auditoria para Briefings (orx_briefing_audit_log)
CREATE TABLE IF NOT EXISTS public.orx_briefing_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id UUID REFERENCES public.orx_briefings(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'viewed', 'status_changed', 'file_downloaded', 'pdf_generated'
    actor_type VARCHAR(20) NOT NULL DEFAULT 'client', -- 'client', 'admin', 'system'
    actor_id UUID,
    ip_hash VARCHAR(64),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitação de Row Level Security (RLS)
ALTER TABLE public.orx_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_briefing_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança RLS para orx_briefings

-- A. Inserção pública: Qualquer visitante anônimo ou cliente autenticado pode enviar briefing
-- com campos mínimos obrigatórios, aceite explícito da LGPD e status inicial 'submitted'
DROP POLICY IF EXISTS "Public can submit briefing" ON public.orx_briefings;
CREATE POLICY "Public can submit briefing"
    ON public.orx_briefings
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        status = 'submitted'
        AND privacy_policy_accepted = true
        AND length(company_name) >= 3
        AND length(contact_name) >= 3
        AND length(email) >= 5
        AND length(phone) >= 8
        AND length(document_number) >= 8
    );

-- B. Leitura e Gestão restritas EXCLUSIVAMENTE a Administradores Ativos em orx_admins
DROP POLICY IF EXISTS "Admins have full access to briefings" ON public.orx_briefings;
CREATE POLICY "Admins have full access to briefings"
    ON public.orx_briefings
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. Governança e Políticas de Segurança RLS para orx_briefing_audit_log
-- REGRA DE AUDITORIA: Inserções por anônimos são ESTRITAMENTE PROIBIDAS via API REST pública.
-- A gravação de criação de briefing ocorre exclusivamente via trigger confiável no banco de dados.
-- Demais eventos de auditoria e leitura são permitidos exclusivamente para administradores ativos.

-- A. Revoga qualquer política permissiva anterior
DROP POLICY IF EXISTS "System and public can log briefing events" ON public.orx_briefing_audit_log;

-- B. Inserção direta de logs de auditoria restrita EXCLUSIVAMENTE a Administradores Ativos
-- (utilizada para auditoria de ações administrativas: 'status_changed', 'file_downloaded', 'pdf_viewed')
DROP POLICY IF EXISTS "Admins can insert briefing audit logs" ON public.orx_briefing_audit_log;
CREATE POLICY "Admins can insert briefing audit logs"
    ON public.orx_briefing_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- C. Leitura de logs de auditoria restrita EXCLUSIVAMENTE a Administradores Ativos
DROP POLICY IF EXISTS "Admins can view briefing audit logs" ON public.orx_briefing_audit_log;
CREATE POLICY "Admins can view briefing audit logs"
    ON public.orx_briefing_audit_log
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- D. Mecanismo Confiável: Trigger Automático de Auditoria na Criação do Briefing
-- Executa com privilégios de SECURITY DEFINER e search_path restrito, garantindo integridade
-- sem expor a tabela de logs a inserções fraudulentas pelo endpoint anônimo da API.
CREATE OR REPLACE FUNCTION public.fn_orx_briefing_audit_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.orx_briefing_audit_log (
        briefing_id,
        action,
        actor_type,
        actor_id,
        ip_hash,
        details,
        created_at
    ) VALUES (
        NEW.id,
        'created',
        'client',
        NULL,
        NEW.privacy_ip_hash,
        jsonb_build_object(
            'protocol_code', NEW.protocol_code,
            'company_name', NEW.company_name,
            'project_type', NEW.project_type,
            'email', NEW.email
        ),
        timezone('utc'::text, now())
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orx_briefing_audit_created ON public.orx_briefings;
CREATE TRIGGER trg_orx_briefing_audit_created
    AFTER INSERT ON public.orx_briefings
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_orx_briefing_audit_created();

-- E. Controle estrito de concessões (Grants/Revokes)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT, SELECT ON public.orx_briefings TO anon, authenticated;
REVOKE ALL ON public.orx_briefing_audit_log FROM anon, public;
GRANT SELECT, INSERT ON public.orx_briefing_audit_log TO authenticated;


-- 6. Índices para Otimização de Consultas e Relatórios
CREATE INDEX IF NOT EXISTS idx_orx_briefings_protocol ON public.orx_briefings(protocol_code);
CREATE INDEX IF NOT EXISTS idx_orx_briefings_status ON public.orx_briefings(status);
CREATE INDEX IF NOT EXISTS idx_orx_briefings_created_at ON public.orx_briefings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orx_briefings_email ON public.orx_briefings(email);
CREATE INDEX IF NOT EXISTS idx_orx_briefing_audit_briefing_id ON public.orx_briefing_audit_log(briefing_id);

-- 7. Cofre de Arquivos Privados no Supabase Storage (briefing-vault)
-- Armazena logotipos e documentos diretamente no Storage S3 do Supabase (Zero dependência de disco efêmero na Hostinger)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'briefing-vault',
    'briefing-vault',
    false, -- Estritamente PRIVADO (sem acesso público não-autenticado)
    26214400, -- Limite estrito de 25MB por arquivo
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- A. Inserção controlada: Permite upload de anexos para submissão de briefing
DROP POLICY IF EXISTS "Public can upload briefing files" ON storage.objects;
CREATE POLICY "Public can upload briefing files"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'briefing-vault');

-- B. Leitura e Gestão restritas EXCLUSIVAMENTE a Administradores Ativos
DROP POLICY IF EXISTS "Admins have full access to briefing files" ON storage.objects;
CREATE POLICY "Admins have full access to briefing files"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'briefing-vault' AND public.is_admin())
    WITH CHECK (bucket_id = 'briefing-vault' AND public.is_admin());

-- 8. Verificação de Integridade e Validação Imediata no SQL Editor
SELECT 
    'MIGRACAO_BRIEFING_CONCLUIDA' AS status,
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('orx_briefings', 'orx_briefing_audit_log', 'orx_admins')) AS tabelas_ativas,
    (SELECT count(*) FROM storage.buckets WHERE id = 'briefing-vault') AS storage_vault_ativo;


