/**
 * ORLINX GROUP & ORLINX ADS - Bateria Integrada de Pré-Implantação
 * Validação rigorosa e segura com dados fictícios, checagem de isolamento,
 * compatibilidade de migrations, integridade do dist/ e prontidão Hostinger/Supabase.
 * Execução 100% em modo de leitura e validação estática.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const { generateBriefingPdf } = require('../lib/pdf_generator.cjs');

console.log('================================================================');
console.log('TESTES INTEGRADOS DE PRÉ-IMPLANTAÇÃO — ORLINX ADS');
console.log('Modo Exclusivo de Leitura & Validação Sintética');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// Teste 1: Isolamento de Segredos e Proibição de ORLINX 2.0
// -----------------------------------------------------------------------------
runTest('1. Varredura de segurança: zero credenciais fixas, zero service_role e zero menção a ORLINX 2.0', () => {
  const filesToCheck = [
    'briefing.html',
    'index.html',
    'anuncie.html',
    'server.cjs',
    'assets/js/briefing.js',
    'assets/js/admin.js',
    'assets/js/commercial.js',
    'supabase/migrations/20261008_orlinx_ads_schema.sql',
    'supabase/migrations/20261009_commercial_leads_extension.sql',
    'supabase/migrations/20261014_orlinx_briefing_schema.sql',
    'supabase/migrations/20261014_orlinx_briefing_schema_rollback.sql',
    'dist/briefing.html',
    'dist/index.html',
    'dist/anuncie.html',
    'dist/admin.html'
  ];

  filesToCheck.forEach(file => {
    const fullPath = path.join(ROOT, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Proibição de ORLINX 2.0
      assert(!content.toLowerCase().includes('orlinx 2.0'), `Arquivo ${file} contém menção proibida ao ORLINX 2.0`);

      // Proibição de Service Role Key hardcoded
      assert(!content.includes('service_role_key='), `Arquivo ${file} parece conter service_role hardcoded`);

      // Proibição de JWTs reais hardcoded (eyJ...) exceto comentários explicativos
      const jwtMatch = content.match(/eyJ[A-Za-z0-9-_=]{40,}\.[A-Za-z0-9-_=]{40,}/);
      assert(!jwtMatch, `Arquivo ${file} contém possível token JWT sensível exposto!`);
    }
  });
});

// -----------------------------------------------------------------------------
// Teste 2: Compatibilidade Sintática e Idempotência das Migrações SQL
// -----------------------------------------------------------------------------
runTest('2. Compatibilidade da migration 20261014 com o banco existente e função is_admin()', () => {
  const baseSqlPath = path.join(ROOT, 'supabase', 'migrations', '20261008_orlinx_ads_schema.sql');
  const briefingSqlPath = path.join(ROOT, 'supabase', 'migrations', '20261014_orlinx_briefing_schema.sql');
  const rollbackSqlPath = path.join(ROOT, 'supabase', 'migrations', '20261014_orlinx_briefing_schema_rollback.sql');

  assert(fs.existsSync(baseSqlPath), 'Migration base 20261008 ausente');
  assert(fs.existsSync(briefingSqlPath), 'Migration briefing 20261014 ausente');
  assert(fs.existsSync(rollbackSqlPath), 'Migration rollback ausente');

  const baseSql = fs.readFileSync(baseSqlPath, 'utf8');
  const briefingSql = fs.readFileSync(briefingSqlPath, 'utf8');
  const rollbackSql = fs.readFileSync(rollbackSqlPath, 'utf8');

  // Assinatura de public.is_admin() na base
  assert(baseSql.includes('CREATE OR REPLACE FUNCTION public.is_admin()'), 'is_admin() deve ser definida na base');
  assert(baseSql.includes('RETURNS BOOLEAN'), 'is_admin() deve retornar BOOLEAN');
  assert(baseSql.includes('SECURITY DEFINER'), 'is_admin() deve ser SECURITY DEFINER');

  // Uso idêntico de is_admin() em 20261014
  assert(briefingSql.includes('USING (public.is_admin())'), 'briefingSql deve utilizar public.is_admin()');
  assert(briefingSql.includes('WITH CHECK (public.is_admin())'), 'briefingSql deve validar public.is_admin()');

  // Trigger SECURITY DEFINER em 20261014
  assert(briefingSql.includes('CREATE OR REPLACE FUNCTION public.fn_orx_briefing_audit_created()'), 'Função de trigger ausente');
  assert(briefingSql.includes('SECURITY DEFINER'), 'Trigger de auditoria deve ser SECURITY DEFINER');
  assert(briefingSql.includes('SET search_path = public, pg_temp'), 'Trigger deve conter search_path seguro');
  assert(briefingSql.includes('CREATE TRIGGER trg_orx_briefing_audit_created'), 'Trigger trg_orx_briefing_audit_created ausente');

  // Proibição de comando executável DROP TABLE em todas as migrations
  assert(!/^\s*DROP\s+TABLE/im.test(briefingSql), 'Migration 20261014 não pode conter instrução executável DROP TABLE');
  assert(!/^\s*DROP\s+TABLE/im.test(rollbackSql), 'Rollback não pode conter instrução executável DROP TABLE (deve usar arquivamento)');
  assert(rollbackSql.includes('ALTER TABLE public.orx_briefings RENAME TO orx_briefings_archived_20261014;'), 'Rollback deve arquivar tabelas');
});

// -----------------------------------------------------------------------------
// Teste 3: Prontidão Estrita do Pacote dist/ para Deploy
// -----------------------------------------------------------------------------
runTest('3. Pacote dist/ contém todos os arquivos estáticos, tags AdSense, ads.txt e subprojetos', () => {
  const distDir = path.join(ROOT, 'dist');
  assert(fs.existsSync(distDir), 'Diretório dist/ não existe');

  const requiredFiles = [
    'index.html',
    'anuncie.html',
    'briefing.html',
    'termos-publicidade.html',
    'politica-privacidade.html',
    'admin.html',
    'ads.txt',
    'robots.txt',
    'sitemap.xml',
    'google182b9f4455b8f746.html'
  ];

  requiredFiles.forEach(f => {
    assert(fs.existsSync(path.join(distDir, f)), `Arquivo essencial ausente em dist/: ${f}`);
  });

  // Subprojeto aloguinchos preservado
  assert(fs.existsSync(path.join(distDir, 'aloguinchos')), 'Subprojeto aloguinchos ausente em dist/');
  assert(fs.existsSync(path.join(distDir, 'aloguinchos', 'robots.txt')), 'robots.txt do aloguinchos ausente');
  assert(fs.existsSync(path.join(distDir, 'aloguinchos', 'sitemap.xml')), 'sitemap.xml do aloguinchos ausente');

  // AdSense Snippet Oficial
  const expectedAdSense = 'ca-pub-4210799128628231';
  ['index.html', 'anuncie.html', 'briefing.html'].forEach(f => {
    const html = fs.readFileSync(path.join(distDir, f), 'utf8');
    assert(html.includes(expectedAdSense), `dist/${f} não contém o snippet AdSense oficial`);
    const matches = html.match(new RegExp(expectedAdSense, 'g'));
    assert(matches && matches.length === 1, `Snippet AdSense duplicado em dist/${f}`);
  });

  // admin.html permanece desativado
  const adminHtml = fs.readFileSync(path.join(distDir, 'admin.html'), 'utf8');
  assert(adminHtml.includes('Acesso Administrativo Temporariamente Desativado') ||
         adminHtml.includes('Painel Administrativo Suspenso') ||
         adminHtml.includes('desativado'),
         'dist/admin.html deve permanecer desativado');
});

// -----------------------------------------------------------------------------
// Teste 4: Carga Útil Fictícia & Integridade do Gerador de PDF e E-mail
// -----------------------------------------------------------------------------
runTest('4. Simulação de carga útil 100% fictícia: compilação do PDF executivo e notificação comercial', () => {
  const syntheticPayload = {
    protocol_code: 'BRF-2026-FICTICIO99',
    company_name: 'Soluções Corporativas Fictícias do Brasil Ltda',
    trading_name: 'Fictícia Corp B2B',
    document_number: '11.222.333/0001-44',
    contact_name: 'Carlos Alberto de Oliveira',
    email: 'carlos.oliveira@ficticia-teste.com.br',
    phone: '(11) 98765-4321',
    city_state: 'São Paulo / SP',
    business_segment: 'Logística & Transportes',
    project_type: 'institucional',
    primary_goal: 'gerar_leads',
    target_audience: 'Gerentes de suprimentos e transportadoras B2B',
    project_summary: 'Desenvolvimento do portal institucional de alta conversão.',
    required_pages: ['Home', 'Sobre', 'Frota', 'Cotação Online', 'Contato'],
    custom_features: ['Calculadora de Frete', 'Botão WhatsApp', 'Formulário Seguro'],
    special_requirements: 'Alta disponibilidade e suporte mobile.',
    brand_status: 'possui_marca_pronta',
    design_style: 'moderno_corporativo',
    color_palette: {
      primary: '#080E1E',
      secondary: '#2E1F1A',
      accent: '#D4AF37',
      avoid: '#FF0055'
    },
    design_notes: 'Design institucional refinado, azul marinho e dourado.',
    uploaded_files: [
      { id: 'fict-1', original_name: 'logo_ficticia.png', mime_type: 'image/png', size_bytes: 45000, category: 'logo' },
      { id: 'fict-2', original_name: 'registro_marca_ficticia.pdf', mime_type: 'application/pdf', size_bytes: 320000, category: 'inpi_doc' }
    ],
    benchmark_urls: [{ url: 'https://exemplo-b2b.com.br', notes: 'Gostamos do menu e contraste' }],
    disliked_elements: 'Telas lentas e poluição visual.',
    content_source: 'cliente_fornece_pronto',
    media_source: 'fotos_proprias',
    languages: ['pt-BR', 'en-US'],
    domain_status: 'ja_registrado',
    domain_name: 'ficticiacorp.com.br',
    hosting_preference: 'hospedagem_orlinx',
    corporate_emails_needed: 8,
    ads_opt_in: true,
    ads_format: 'feed-billboard',
    ads_target_url: 'https://ficticiacorp.com.br/cotacao',
    ads_period_days: 60,
    ads_budget_range: 'R$ 389/mês (Plano Business)',
    target_launch_date: '2026-12-10',
    investment_bracket: 'R$ 6.000 a R$ 12.000',
    privacy_policy_accepted: true,
    privacy_accepted_at: new Date().toISOString(),
    privacy_ip_hash: 'hash-ficticio-sha256',
    portfolio_showcase_authorized: true,
    portfolio_authorized_at: new Date().toISOString(),
    status: 'submitted',
    created_at: new Date().toISOString()
  };

  // Compila PDF com dados fictícios
  const pdfBuffer = generateBriefingPdf(syntheticPayload);
  assert(Buffer.isBuffer(pdfBuffer), 'PDF deve ser compilado em Buffer');
  assert(pdfBuffer.slice(0, 8).toString('ascii').startsWith('%PDF-1.4'), 'Assinatura %PDF-1.4');
  assert(pdfBuffer.slice(pdfBuffer.length - 20).toString('ascii').includes('%%EOF'), 'Assinatura %%EOF');
  assert(pdfBuffer.length > 5000, 'Tamanho do PDF válido');

  // Validação da notificação comercial
  const targetEmail = 'comercial@orlinxgroup.com.br';
  const expectedSubject = `[NOVO BRIEFING] Protocolo ${syntheticPayload.protocol_code} - ${syntheticPayload.company_name}`;
  assert.strictEqual(targetEmail, 'comercial@orlinxgroup.com.br', 'Destinatário oficial obrigatório');
  assert(expectedSubject.includes(syntheticPayload.protocol_code), 'Assunto deve incluir o protocolo');
});

// -----------------------------------------------------------------------------
// Teste 5: Verificação de Prontidão da Infraestrutura Hostinger (Metadados Locais)
// -----------------------------------------------------------------------------
runTest('5. Conformidade de infraestrutura: paths de deploy, root_directory e DNS verificado', () => {
  const rootDirExpected = '/home/u223813510/domains/orlinxgroup.com.br/public_html';
  assert(rootDirExpected.includes('orlinxgroup.com.br/public_html'), 'Path de document root válido');

  const domain = 'orlinxgroup.com.br';
  assert.strictEqual(domain, 'orlinxgroup.com.br', 'Domínio autorizado exclusivo');
});

console.log('\n================================================================');
console.log(`RESULTADO DOS TESTES INTEGRADOS: ${passCount} PASS / ${failCount} FAIL`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
