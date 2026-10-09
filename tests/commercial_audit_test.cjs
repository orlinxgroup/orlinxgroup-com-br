/**
 * ORLINX GROUP & ORLINX ADS - Bateria Completa de Auditoria Técnica e Segurança
 * 1. Verificação de Integridade das Páginas Públicas (HTML, Tags AdSense, Políticas)
 * 2. Integridade de ads.txt, Search Console e Subprojeto aloguinchos
 * 3. Validação de Formulários Estruturados e Honeypot Anti-Spam
 * 4. Validação de Segurança do Módulo commercial.js (Sem Conversão Pré-Persistência, Rate Limit)
 * 5. Auditoria de Segurança RLS (Perfis: Anônimo, Autenticado Comum, Administrador)
 * 6. Verificação de Ordem, Idempotência e Segurança das Migrações SQL
 * 7. Validação do sitemap.xml e Rotas Canônicas
 * 8. Comparação com Versão Pública para Prevenção de Regressões
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('AUDITORIA TÉCNICA INDEPENDENTE — ORLINX ADS (FASE COMERCIAL)');
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

// --- Teste 1: Preservação de AdSense em Todas as Páginas Públicas ---
runTest('1. Todas as páginas públicas contêm o snippet AdSense oficial e sem duplicação', () => {
  const publicFiles = [
    'index.html',
    'anuncie.html',
    'publicidade.html',
    'termos-publicidade.html',
    'politica-privacidade.html'
  ];

  const expectedSnippet = 'ca-pub-4210799128628231';

  publicFiles.forEach((file) => {
    const filePath = path.join(ROOT, file);
    assert(fs.existsSync(filePath), `Arquivo ${file} não existe no diretório raiz`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes(expectedSnippet), `Arquivo ${file} não contém a tag AdSense`);
    const matches = content.match(new RegExp(expectedSnippet, 'g'));
    assert(matches && matches.length === 1, `Arquivo ${file} possui snippet AdSense duplicado`);
  });
});

// --- Teste 2: Integridade do ads.txt ---
runTest('2. ads.txt possui exatamente a diretiva oficial do AdSense', () => {
  const adsTxtPath = path.join(ROOT, 'ads.txt');
  assert(fs.existsSync(adsTxtPath), 'ads.txt não encontrado');
  const content = fs.readFileSync(adsTxtPath, 'utf8').trim();
  const expectedLine = 'google.com, pub-4210799128628231, DIRECT, f08c47fec0942fa0';
  assert.strictEqual(content, expectedLine, 'Conteúdo do ads.txt diverge do padrão oficial');
});

// --- Teste 3: Preservação do Subprojeto aloguinchos e Search Console ---
runTest('3. Subprojeto aloguinchos e Search Console permanecem intactos em dist/', () => {
  const gscFile = path.join(ROOT, 'dist', 'google182b9f4455b8f746.html');
  const aloguinchosDir = path.join(ROOT, 'dist', 'aloguinchos');
  assert(fs.existsSync(gscFile), 'google182b9f4455b8f746.html ausente em dist');
  assert(fs.existsSync(aloguinchosDir), 'Diretório aloguinchos ausente em dist');
});

// --- Teste 4: Auditoria de Formulários e Campos Obrigatórios ---
runTest('4. Formulários em anuncie.html e publicidade.html possuem campos e honeypot anti-spam', () => {
  const anuncieContent = fs.readFileSync(path.join(ROOT, 'anuncie.html'), 'utf8');
  const lpContent = fs.readFileSync(path.join(ROOT, 'publicidade.html'), 'utf8');

  // anuncie.html
  assert(anuncieContent.includes('id="orx-ad-order-form"'), 'Formulário ausente em anuncie.html');
  assert(anuncieContent.includes('name="_hp_company_fax_orx"'), 'Honeypot ausente em anuncie.html');
  assert(anuncieContent.includes('name="company_name"'), 'Campo company_name ausente');
  assert(anuncieContent.includes('name="document"'), 'Campo document ausente');
  assert(anuncieContent.includes('name="email"'), 'Campo email ausente');
  assert(anuncieContent.includes('name="phone"'), 'Campo phone ausente');
  assert(anuncieContent.includes('name="plan"'), 'Campo plan ausente');
  assert(anuncieContent.includes('name="target_url"'), 'Campo target_url ausente');
  assert(anuncieContent.includes('name="notes"'), 'Campo notes ausente');

  // publicidade.html (Landing Page Google Ads)
  assert(lpContent.includes('id="orx-lp-lead-form"'), 'Formulário ausente em publicidade.html');
  assert(lpContent.includes('name="_hp_company_fax_orx"'), 'Honeypot ausente em publicidade.html');
  assert(lpContent.includes('id="lp_company_name"'), 'Campo company_name ausente na LP');
  assert(lpContent.includes('id="lp_document"'), 'Campo document ausente na LP');
  assert(lpContent.includes('id="lp_email"'), 'Campo email ausente na LP');
  assert(lpContent.includes('id="lp_phone"'), 'Campo phone ausente na LP');
  assert(lpContent.includes('id="lp-plan-select"'), 'Campo plan ausente na LP');
  assert(lpContent.includes('id="lp_target_url"'), 'Campo target_url ausente na LP');
});

// --- Teste 5: Garantia de Não Disparo de Conversão Sem Persistência ---
runTest('5. commercial.js NÃO dispara conversão quando a persistência falha (persisted === false)', () => {
  const commercialJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'commercial.js'), 'utf8');

  // Isola o método handleSubmit até a definição de renderSuccessModal
  const submitIndex = commercialJs.indexOf('async handleSubmit(');
  assert(submitIndex !== -1, 'Método handleSubmit não encontrado');
  const handleSubmitBody = commercialJs.slice(submitIndex, commercialJs.indexOf('renderSuccessModal(resData'));

  // Encontra estritamente o bloco if (persisted) { ... } else { ... }
  const ifPersistedMatch = handleSubmitBody.match(/if\s*\(\s*persisted\s*\)\s*\{([\s\S]*?)\}\s*else\s*\{([\s\S]*?)\}/);
  assert(ifPersistedMatch, 'Bloco if (persisted) ... else ... não encontrado em handleSubmit');

  const ifBlock = ifPersistedMatch[1];
  const elseBlock = ifPersistedMatch[2];

  // O disparo deve estar ESTRITAMENTE dentro do ifBlock
  assert(ifBlock.includes('this.analytics.trackConversion'), 'Regra violada: trackConversion deve ser chamado quando persisted for true');
  assert(!elseBlock.includes('trackConversion'), 'Regra violada: trackConversion detectado no bloco de falha (persisted === false)');
  assert(elseBlock.includes('this.renderFallbackModal'), 'Regra violada: renderFallbackModal não foi chamado na falha de persistência');
});

// --- Teste 6: Proteção Anti-Spam e Debounce ---
runTest('6. commercial.js implementa detecção de Honeypot e Debounce/Rate-Limiting local', () => {
  const commercialJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'commercial.js'), 'utf8');

  // Verificação de honeypot
  assert(commercialJs.includes('_hp_company_fax_orx'), 'Checagem de honeypot ausente no submit');

  // Verificação de debounce / rate limiting
  assert(commercialJs.includes('LAST_SUBMIT_KEY'), 'Chave de rate limiting ausente');
  assert(commercialJs.includes('Date.now()'), 'Checagem de timestamp para rate limiting ausente');
});

// --- Teste 7: Ausência Total de Senhas Fixas, Chaves Privadas e URLs Antigas ---
runTest('7. Varredura de segurança: zero senhas padrão, zero service_role no frontend e Supabase oficial exclusivo', () => {
  const filesToScan = [
    'assets/js/commercial.js',
    'assets/js/admin.js',
    'assets/js/ads-engine.js',
    'server.cjs',
    'index.html',
    'anuncie.html',
    'publicidade.html'
  ];

  const forbiddenTerms = [
    'orlinx2026',
    'service_role',
    'SUPABASE_SERVICE_ROLE_KEY',
    'orlinx 2.0',
    'orlinx2.0'
  ];

  filesToScan.forEach((file) => {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');

    // Chave de serviço nunca pode estar no frontend
    if (file.startsWith('assets/')) {
      assert(!content.includes('service_role'), `Termo "service_role" encontrado indevidamente no frontend: ${file}`);
      assert(!content.includes('SUPABASE_SERVICE_ROLE_KEY'), `Chave de serviço mencionada no frontend: ${file}`);
    }

    assert(!content.includes('orlinx2026'), `Senha fixa "orlinx2026" encontrada em ${file}`);

    // Qualquer referência a supabase.co deve ser estritamente ulajrvkaqqedwuaiaksp
    const sbMatches = content.match(/https?:\/\/[a-z0-9_-]+\.supabase\.co/gi) || [];
    sbMatches.forEach((url) => {
      assert.strictEqual(url, 'https://ulajrvkaqqedwuaiaksp.supabase.co', `URL não autorizada do Supabase em ${file}: ${url}`);
    });
  });
});

// --- Teste 8: Validação de Segurança RLS e Simulação de Perfis de Acesso ---
runTest('8. Políticas RLS garantem isolamento: anônimo só insere pendente, admin exclusivo em orx_admins consulta', () => {
  const baseSql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261008_orlinx_ads_schema.sql'), 'utf8');
  const extSql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261009_commercial_leads_extension.sql'), 'utf8');

  // RLS Habilitado em todas as tabelas
  assert(baseSql.includes('ALTER TABLE public.orx_admins ENABLE ROW LEVEL SECURITY;'), 'RLS não habilitado em orx_admins');
  assert(baseSql.includes('ALTER TABLE public.orx_ads_orders ENABLE ROW LEVEL SECURITY;'), 'RLS não habilitado em orx_ads_orders');
  assert(baseSql.includes('ALTER TABLE public.orx_ads_campaigns ENABLE ROW LEVEL SECURITY;'), 'RLS não habilitado em orx_ads_campaigns');
  assert(baseSql.includes('ALTER TABLE public.orx_ads_telemetry ENABLE ROW LEVEL SECURITY;'), 'RLS não habilitado em orx_ads_telemetry');

  // Função SECURITY DEFINER sem brecha de recursão
  assert(baseSql.includes('CREATE OR REPLACE FUNCTION public.is_admin()'), 'Função is_admin ausente');
  assert(baseSql.includes('SECURITY DEFINER'), 'is_admin deve ser SECURITY DEFINER');
  assert(baseSql.includes('SET search_path = public, auth, pg_temp'), 'search_path não blindado');

  // Restrição de EXECUTE em is_admin
  assert(baseSql.includes('REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;'), 'is_admin acessível para anon');

  // Anônimo: Permissão estrita de INSERT com validação de status
  assert(baseSql.includes('CREATE POLICY "Anon can insert orders"'), 'Política Anon can insert orders ausente');
  assert(baseSql.includes("status = 'pending_review'"), 'Validação de status pending_review ausente na inserção anônima');

  // Usuário autenticado comum: NÃO possui acesso a pedidos de outros
  assert(!baseSql.includes("USING (auth.role() = 'authenticated')"), 'Permissão ampla para qualquer usuário autenticado detectada');

  // Consulta de pedidos: restrita a public.is_admin()
  assert(baseSql.includes('CREATE POLICY "Admins can view and manage orders"'), 'Política de gestão de pedidos ausente');
  assert(baseSql.includes('USING (public.is_admin())'), 'Política de leitura de pedidos não usa public.is_admin()');
});

// --- Teste 9: Ordem e Idempotência das Migrações SQL ---
runTest('9. Migrações são idempotentes e aplicáveis na ordem correta', () => {
  const migDir = path.join(ROOT, 'supabase', 'migrations');
  const migFiles = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();

  assert.strictEqual(migFiles[0], '20261008_orlinx_ads_schema.sql', 'Primeira migração deve ser o schema base');
  assert.strictEqual(migFiles[1], '20261009_commercial_leads_extension.sql', 'Segunda migração deve ser a extensão de leads');

  const extContent = fs.readFileSync(path.join(migDir, migFiles[1]), 'utf8');
  assert(extContent.includes('ALTER TABLE IF EXISTS public.orx_ads_orders'), 'Extensão deve usar IF EXISTS');
  assert(extContent.includes('ADD COLUMN IF NOT EXISTS lead_source'), 'Extensão deve usar ADD COLUMN IF NOT EXISTS');
});

// --- Teste 10: Integridade do sitemap.xml ---
runTest('10. sitemap.xml inclui todas as rotas públicas oficiais', () => {
  const sitemapContent = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const expectedRoutes = [
    'https://www.orlinxgroup.com.br/',
    'https://www.orlinxgroup.com.br/anuncie.html',
    'https://www.orlinxgroup.com.br/publicidade.html',
    'https://www.orlinxgroup.com.br/termos-publicidade.html',
    'https://www.orlinxgroup.com.br/politica-privacidade.html'
  ];

  expectedRoutes.forEach((route) => {
    assert(sitemapContent.includes(route), `Rota ${route} ausente no sitemap.xml`);
  });
});

// --- Teste 11: Prevenção de Regressão em dist/ ---
runTest('11. Diretório dist/ preserva todos os recursos essenciais da versão pública', () => {
  const distDir = path.join(ROOT, 'dist');
  assert(fs.existsSync(distDir), 'Diretório dist/ não existe');

  const requiredDistFiles = [
    'index.html',
    'anuncie.html',
    'publicidade.html',
    'termos-publicidade.html',
    'politica-privacidade.html',
    'ads.txt',
    'robots.txt',
    'sitemap.xml',
    'google182b9f4455b8f746.html',
    'admin.html'
  ];

  requiredDistFiles.forEach((file) => {
    assert(fs.existsSync(path.join(distDir, file)), `Arquivo ${file} ausente em dist/`);
  });

  // admin.html em dist/ deve permanecer desativado
  const distAdmin = fs.readFileSync(path.join(distDir, 'admin.html'), 'utf8');
  assert(distAdmin.includes('Acesso Administrativo Restrito') || distAdmin.includes('Ambiente Privado'), 'admin.html em dist não está desativado com segurança');
});

// --- Teste 12: Canal Oficial Exclusivo comercial@orlinxgroup.com.br ---
runTest('12. comercial@orlinxgroup.com.br é o canal exclusivo de atendimento e contingência comercial', () => {
  const termsContent = fs.readFileSync(path.join(ROOT, 'termos-publicidade.html'), 'utf8');
  const anuncieContent = fs.readFileSync(path.join(ROOT, 'anuncie.html'), 'utf8');
  const lpContent = fs.readFileSync(path.join(ROOT, 'publicidade.html'), 'utf8');
  const commercialJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'commercial.js'), 'utf8');

  // Termos de publicidade deve apontar para comercial@orlinxgroup.com.br
  assert(termsContent.includes('comercial@orlinxgroup.com.br'), 'termos-publicidade.html não referencia comercial@orlinxgroup.com.br');
  assert(!termsContent.includes('contato@orlinxgroup.com.br'), 'termos-publicidade.html ainda referencia contato@orlinxgroup.com.br indevidamente');

  // anuncie.html e publicidade.html devem ter comercial@orlinxgroup.com.br
  assert(anuncieContent.includes('comercial@orlinxgroup.com.br'), 'anuncie.html não referencia comercial@orlinxgroup.com.br');
  assert(lpContent.includes('comercial@orlinxgroup.com.br'), 'publicidade.html não referencia comercial@orlinxgroup.com.br');

  // commercial.js deve utilizar comercial@orlinxgroup.com.br no mailto de contingência
  assert(commercialJs.includes('mailto:comercial@orlinxgroup.com.br'), 'commercial.js não aponta mailto para comercial@orlinxgroup.com.br');
});

// --- Teste 13: Validação do Fluxo de Contingência por E-mail ---
runTest('13. Fluxo de contingência por e-mail gera formatação completa com parâmetros subject e body', () => {
  const commercialJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'commercial.js'), 'utf8');

  // Verifica método renderFallbackModal
  assert(commercialJs.includes('renderFallbackModal('), 'Método renderFallbackModal ausente em commercial.js');
  assert(commercialJs.includes('emailSubject = encodeURIComponent('), 'Codificação de subject ausente no fallback');
  assert(commercialJs.includes('emailBody = encodeURIComponent('), 'Codificação de body ausente no fallback');

  // Verifica que o corpo inclui os campos essenciais
  assert(commercialJs.includes('orderPayload.company_name'), 'Nome da empresa ausente no payload de contingência');
  assert(commercialJs.includes('orderPayload.email'), 'E-mail ausente no payload de contingência');
  assert(commercialJs.includes('orderPayload.phone'), 'Telefone ausente no payload de contingência');
  assert(commercialJs.includes('orderPayload.target_url'), 'Target URL ausente no payload de contingência');
});

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL DE TESTES EXECUTADOS: ${passCount + failCount}`);
console.log(`APROVADOS: ${passCount}`);
console.log(`FALHAS: ${failCount}`);
console.log('----------------------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n>> TODAS AS 13 VERIFICAÇÕES DE AUDITORIA FORAM APROVADAS COM SUCESSO! <<\n');
}
