/**
 * ORLINX GROUP & ORLINX ADS - Testes Automatizados da Camada Comercial
 * 1. Verificação de Integridade das Páginas Públicas (HTML, Tags AdSense, Políticas)
 * 2. Validação da Camada de Métricas & Telemetria (UTM, Conversion Events)
 * 3. Validação de Sanitização e Protocolos de URL
 * 4. Validação de Migrações SQL e Governança RLS
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('INICIANDO AUDITORIA TÉCNICA E TESTES DA FASE COMERCIAL');
console.log('====================================================\n');

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
runTest('Todas as páginas públicas contêm o snippet AdSense oficial e sem duplicação', () => {
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
    
    // Deve conter o snippet
    assert(content.includes(expectedSnippet), `Arquivo ${file} não contém a tag AdSense`);
    
    // Não pode estar duplicado
    const matches = content.match(new RegExp(expectedSnippet, 'g'));
    assert(matches && matches.length === 1, `Arquivo ${file} possui snippet AdSense duplicado (${matches ? matches.length : 0})`);
  });
});

// --- Teste 2: Integridade do ads.txt ---
runTest('ads.txt possui exatamente a diretiva oficial do AdSense', () => {
  const adsTxtPath = path.join(ROOT, 'ads.txt');
  assert(fs.existsSync(adsTxtPath), 'ads.txt não encontrado');
  const content = fs.readFileSync(adsTxtPath, 'utf8').trim();
  const expectedLine = 'google.com, pub-4210799128628231, DIRECT, f08c47fec0942fa0';
  assert.strictEqual(content, expectedLine, 'Conteúdo do ads.txt diverge do padrão oficial');
});

// --- Teste 3: Preservação do Subprojeto aloguinchos e Search Console ---
runTest('Subprojeto aloguinchos e Search Console permanecem intactos', () => {
  const gscFile = path.join(ROOT, 'dist', 'google182b9f4455b8f746.html');
  const aloguinchosDir = path.join(ROOT, 'dist', 'aloguinchos');
  assert(fs.existsSync(gscFile), 'google182b9f4455b8f746.html ausente em dist');
  assert(fs.existsSync(aloguinchosDir), 'Diretório aloguinchos ausente em dist');
});

// --- Teste 4: Auditoria de Formulários e Campos Obrigatórios ---
runTest('anuncie.html e publicidade.html possuem formulários com campos estruturados', () => {
  const anuncieContent = fs.readFileSync(path.join(ROOT, 'anuncie.html'), 'utf8');
  const lpContent = fs.readFileSync(path.join(ROOT, 'publicidade.html'), 'utf8');

  // anuncie.html
  assert(anuncieContent.includes('id="orx-ad-order-form"'), 'Formulário ausente em anuncie.html');
  assert(anuncieContent.includes('name="company_name"'), 'Campo company_name ausente em anuncie.html');
  assert(anuncieContent.includes('name="document"'), 'Campo document ausente em anuncie.html');
  assert(anuncieContent.includes('name="email"'), 'Campo email ausente em anuncie.html');
  assert(anuncieContent.includes('name="phone"'), 'Campo phone ausente em anuncie.html');
  assert(anuncieContent.includes('name="plan"'), 'Campo plan ausente em anuncie.html');
  assert(anuncieContent.includes('name="target_url"'), 'Campo target_url ausente em anuncie.html');
  assert(anuncieContent.includes('name="notes"'), 'Campo notes ausente em anuncie.html');

  // publicidade.html (Landing Page Google Ads)
  assert(lpContent.includes('id="orx-lp-lead-form"'), 'Formulário ausente em publicidade.html');
  assert(lpContent.includes('id="lp_company_name"'), 'Campo company_name ausente em publicidade.html');
  assert(lpContent.includes('id="lp_document"'), 'Campo document ausente em publicidade.html');
  assert(lpContent.includes('id="lp_email"'), 'Campo email ausente em publicidade.html');
  assert(lpContent.includes('id="lp_phone"'), 'Campo phone ausente em publicidade.html');
  assert(lpContent.includes('id="lp-plan-select"'), 'Campo plan ausente em publicidade.html');
  assert(lpContent.includes('id="lp_target_url"'), 'Campo target_url ausente em publicidade.html');
});

// --- Teste 5: Validação da Camada de JavaScript Comercial ---
runTest('commercial.js implementa rastreamento de UTM, eventos de conversão e proteção XSS', () => {
  const commercialJs = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'commercial.js'), 'utf8');

  // Verificação de classes
  assert(commercialJs.includes('OrlinxAnalyticsTracker'), 'Classe OrlinxAnalyticsTracker ausente');
  assert(commercialJs.includes('OrlinxCommercialApp'), 'Classe OrlinxCommercialApp ausente');

  // UTM tracking
  assert(commercialJs.includes('utm_source'), 'Captura de utm_source ausente');
  assert(commercialJs.includes('utm_campaign'), 'Captura de utm_campaign ausente');
  assert(commercialJs.includes('gclid'), 'Captura de gclid ausente');

  // Eventos de conversão
  assert(commercialJs.includes('trackConversion'), 'Método trackConversion ausente');
  assert(commercialJs.includes('generate_lead'), 'Evento generate_lead ausente');

  // Proteção XSS
  assert(commercialJs.includes('escapeHtml'), 'Método escapeHtml ausente');

  // Supabase URL Oficial
  assert(commercialJs.includes('https://ulajrvkaqqedwuaiaksp.supabase.co'), 'URL do Supabase incorreta em commercial.js');

  // Zero senhas fixas
  assert(!commercialJs.includes('orlinx2026'), 'Senha fixa detectada em commercial.js');
});

// --- Teste 6: Validação de Segurança e Políticas RLS nos Schemas SQL ---
runTest('Migrações SQL não concedem privilégios genéricos e implementam RLS rigoroso', () => {
  const baseSql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261008_orlinx_ads_schema.sql'), 'utf8');
  const extSql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261009_commercial_leads_extension.sql'), 'utf8');

  // Nenhuma concessão de admin para auth.role() = 'authenticated'
  assert(!baseSql.includes("USING (auth.role() = 'authenticated')"), 'Falha de segurança RLS: permissão administrativa ampla detectada');

  // RLS habilitado
  assert(baseSql.includes('ENABLE ROW LEVEL SECURITY;'), 'RLS não habilitado em tabelas');

  // Função SECURITY DEFINER com search_path seguro
  assert(baseSql.includes('SET search_path = public, auth, pg_temp'), 'search_path inseguro na função is_admin');

  // Extensão de leads preserva RLS
  assert(extSql.includes("status = 'pending_review'"), 'Extensão RLS não restringe status a pending_review');
});

// --- Teste 7: Validação do sitemap.xml ---
runTest('sitemap.xml inclui todas as rotas públicas oficiais', () => {
  const sitemapContent = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert(sitemapContent.includes('https://www.orlinxgroup.com.br/'), 'Home ausente no sitemap');
  assert(sitemapContent.includes('https://www.orlinxgroup.com.br/anuncie.html'), 'anuncie.html ausente no sitemap');
  assert(sitemapContent.includes('https://www.orlinxgroup.com.br/publicidade.html'), 'publicidade.html ausente no sitemap');
  assert(sitemapContent.includes('https://www.orlinxgroup.com.br/termos-publicidade.html'), 'termos ausentes no sitemap');
  assert(sitemapContent.includes('https://www.orlinxgroup.com.br/politica-privacidade.html'), 'privacidade ausente no sitemap');
});

console.log('\n----------------------------------------------------');
console.log(`TOTAL DE TESTES: ${passCount + failCount}`);
console.log(`APROVADOS: ${passCount}`);
console.log(`FALHAS: ${failCount}`);
console.log('----------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n>> TODOS OS TESTES FORAM CONCLUÍDOS COM SUCESSO! <<\n');
}
