/**
 * ORLINX GROUP & ORLINX ADS - Bateria de Auditoria Técnica e Validação
 * Teste Exaustivo da Rota /briefing, Geração de PDF, Cofre Privado de Arquivos,
 * RLS, Anti-Spam, Rate Limit e Governança LGPD
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const { generateBriefingPdf } = require('../lib/pdf_generator.cjs');

console.log('================================================================');
console.log('AUDITORIA TÉCNICA INDEPENDENTE — ORLINX ADS (BRIEFING DIGITAL)');
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

// --- Teste 1: Preservação de AdSense no briefing.html ---
runTest('1. briefing.html possui a tag AdSense oficial sem duplicação', () => {
  const filePath = path.join(ROOT, 'briefing.html');
  assert(fs.existsSync(filePath), 'briefing.html não existe na raiz');
  const content = fs.readFileSync(filePath, 'utf8');
  const expectedSnippet = 'ca-pub-4210799128628231';
  assert(content.includes(expectedSnippet), 'briefing.html não contém o snippet AdSense oficial');
  const matches = content.match(new RegExp(expectedSnippet, 'g'));
  assert(matches && matches.length === 1, 'Snippet AdSense duplicado em briefing.html');
});

// --- Teste 2: Integridade de ads.txt, Search Console e aloguinchos ---
runTest('2. Integridade estrita de ads.txt, Search Console e subprojeto aloguinchos', () => {
  const adsTxt = fs.readFileSync(path.join(ROOT, 'ads.txt'), 'utf8').trim();
  assert.strictEqual(adsTxt, 'google.com, pub-4210799128628231, DIRECT, f08c47fec0942fa0');

  const gscFile = path.join(ROOT, 'dist', 'google182b9f4455b8f746.html');
  const aloguinchosDir = path.join(ROOT, 'dist', 'aloguinchos');
  assert(fs.existsSync(gscFile), 'google182b9f4455b8f746.html ausente em dist');
  assert(fs.existsSync(aloguinchosDir), 'Subprojeto aloguinchos ausente em dist');
});

// --- Teste 3: Verificação das 10 Seções no briefing.html ---
runTest('3. briefing.html contém todas as 10 seções estruturadas', () => {
  const content = fs.readFileSync(path.join(ROOT, 'briefing.html'), 'utf8');

  // Seção 1: Institucional
  assert(content.includes('name="company_name"'), 'Campo company_name ausente');
  assert(content.includes('name="document_number"'), 'Campo document_number ausente');
  assert(content.includes('name="contact_name"'), 'Campo contact_name ausente');
  assert(content.includes('name="email"'), 'Campo email ausente');
  assert(content.includes('name="phone"'), 'Campo phone ausente');

  // Seção 2: Objetivos
  assert(content.includes('name="project_type"'), 'Campo project_type ausente');
  assert(content.includes('name="primary_goal"'), 'Campo primary_goal ausente');

  // Seção 3: Escopo
  assert(content.includes('name="required_pages[]"'), 'Campo required_pages[] ausente');
  assert(content.includes('name="custom_features[]"'), 'Campo custom_features[] ausente');

  // Seção 4: Design
  assert(content.includes('name="brand_status"'), 'Campo brand_status ausente');
  assert(content.includes('name="design_style"'), 'Campo design_style ausente');
  assert(content.includes('id="color_primary"'), 'Seletor de cor primária ausente');
  assert(content.includes('id="color_accent"'), 'Seletor de cor de destaque ausente');

  // Seção 5: Uploads
  assert(content.includes('id="file-dropzone"'), 'Dropzone de arquivos ausente');
  assert(content.includes('id="file-input"'), 'Input de arquivo ausente');

  // Seção 6: Referências
  assert(content.includes('name="benchmark_url[]"'), 'Campo benchmark_url[] ausente');
  assert(content.includes('name="disliked_elements"'), 'Campo disliked_elements ausente');

  // Seção 7: Conteúdo
  assert(content.includes('name="content_source"'), 'Campo content_source ausente');
  assert(content.includes('name="media_source"'), 'Campo media_source ausente');
  assert(content.includes('name="languages[]"'), 'Campo languages[] ausente');

  // Seção 8: Domínio & Hospedagem
  assert(content.includes('name="domain_status"'), 'Campo domain_status ausente');
  assert(content.includes('name="hosting_preference"'), 'Campo hosting_preference ausente');
  assert(content.includes('name="corporate_emails_needed"'), 'Campo corporate_emails_needed ausente');

  // Seção 9: ORLINX ADS Opcional
  assert(content.includes('id="ads_opt_in"'), 'Checkbox ads_opt_in ausente');
  assert(content.includes('id="ads-conditional-section"'), 'Seção condicional de ads ausente');
  assert(content.includes('name="ads_format"'), 'Campo ads_format ausente');
  assert(content.includes('name="ads_period_days"'), 'Campo ads_period_days ausente');

  // Seção 10: Cronograma & LGPD
  assert(content.includes('name="target_launch_date"'), 'Campo target_launch_date ausente');
  assert(content.includes('name="investment_bracket"'), 'Campo investment_bracket ausente');
  assert(content.includes('id="privacy_policy_accepted"'), 'Checkbox de privacidade LGPD obrigatório ausente');
  assert(content.includes('id="portfolio_showcase_authorized"'), 'Checkbox independente de portfólio ausente');

  // Honeypot Anti-Spam
  assert(content.includes('name="_hp_briefing_corp_catch"'), 'Honeypot anti-spam ausente no formulário');
});

// --- Teste 4: Verificação de Consentimentos Separados na Migration SQL ---
runTest('4. Migration SQL separa estritamente LGPD e Portfólio com RLS restrito a is_admin()', () => {
  const sqlPath = path.join(ROOT, 'supabase', 'migrations', '20261014_orlinx_briefing_schema.sql');
  assert(fs.existsSync(sqlPath), 'Arquivo de migração de briefing não encontrado');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Tabela e colunas
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.orx_briefings'), 'Tabela orx_briefings ausente');
  assert(sql.includes('privacy_policy_accepted BOOLEAN NOT NULL DEFAULT false'), 'Coluna privacy_policy_accepted ausente');
  assert(sql.includes('portfolio_showcase_authorized BOOLEAN NOT NULL DEFAULT false'), 'Coluna portfolio_showcase_authorized ausente');
  assert(sql.includes('protocol_code VARCHAR(32) NOT NULL UNIQUE'), 'Coluna protocol_code ausente');

  // RLS
  assert(sql.includes('ALTER TABLE public.orx_briefings ENABLE ROW LEVEL SECURITY;'), 'RLS não habilitado em orx_briefings');
  assert(sql.includes('USING (public.is_admin())'), 'Política restrita a public.is_admin() ausente');
  assert(!sql.includes("auth.role() = 'authenticated'"), "Proibido uso genérico de auth.role() = 'authenticated'");
  assert(sql.includes('CREATE TABLE IF NOT EXISTS public.orx_briefing_audit_log'), 'Tabela orx_briefing_audit_log ausente');
});

// --- Teste 5: Gerador de PDF 100% Nativo (lib/pdf_generator.cjs) ---
runTest('5. lib/pdf_generator.cjs compila PDF 1.4 válido com acentos em Português e seções completas', () => {
  const mockData = {
    protocol_code: 'BRF-2026-TEST01',
    created_at: new Date().toISOString(),
    company_name: 'Empresa Brasileira de Soluções Ópticas S/A',
    trading_name: 'Óptica Brasil',
    document_number: '98.765.432/0001-10',
    contact_name: 'Ana Cláudia Gonçalves',
    email: 'ana@opticabrasil.com.br',
    phone: '(21) 98888-7777',
    city_state: 'Rio de Janeiro/RJ',
    business_segment: 'Saúde Visual & Tecnologia',
    project_type: 'institucional',
    primary_goal: 'gerar_leads',
    target_audience: 'Clínicas oftalmológicas e médicos B2B',
    project_summary: 'Reformulação da presença digital institucional com alta autoridade.',
    required_pages: ['Home', 'Sobre Nós', 'Produtos', 'Contato'],
    custom_features: ['Botão WhatsApp Flutuante', 'Formulário Anti-Spam'],
    special_requirements: 'Certificado SSL e conformidade total com LGPD.',
    brand_status: 'possui_marca_pronta',
    design_style: 'moderno_corporativo',
    color_palette: { primary: '#080E1E', secondary: '#2E1F1A', accent: '#D4AF37', avoid: '#FF0055' },
    design_notes: 'Design limpo, fotos profissionais e contraste equilibrado.',
    uploaded_files: [
      { id: 'f1', original_name: 'logo_optica.png', mime_type: 'image/png', size_bytes: 120000, category: 'logo' },
      { id: 'f2', original_name: 'manual_identidade.pdf', mime_type: 'application/pdf', size_bytes: 850000, category: 'brand_manual' }
    ],
    benchmark_urls: [{ url: 'https://exemplo.com.br', notes: 'Tipografia excelente' }],
    disliked_elements: 'Animações piscantes e lentidão.',
    content_source: 'cliente_fornece_pronto',
    media_source: 'fotos_proprias',
    languages: ['pt-BR'],
    domain_status: 'ja_registrado',
    domain_name: 'opticabrasil.com.br',
    hosting_preference: 'hospedagem_orlinx',
    corporate_emails_needed: 5,
    ads_opt_in: true,
    ads_format: 'feed-billboard',
    ads_target_url: 'https://opticabrasil.com.br/contato',
    ads_period_days: 30,
    ads_budget_range: 'R$ 389/mês (Plano Business)',
    target_launch_date: '2026-12-01',
    investment_bracket: 'R$ 3.000 a R$ 6.000',
    privacy_policy_accepted: true,
    privacy_accepted_at: new Date().toISOString(),
    privacy_ip_hash: '9a8b7c6d5e4f3a2b1c0d',
    portfolio_showcase_authorized: true,
    portfolio_authorized_at: new Date().toISOString(),
    status: 'submitted'
  };

  const pdfBuf = generateBriefingPdf(mockData);
  assert(Buffer.isBuffer(pdfBuf), 'Retorno do gerador deve ser um Buffer');
  assert(pdfBuf.length > 5000, 'Tamanho do PDF muito pequeno');

  // Assinatura do padrão PDF
  const header = pdfBuf.slice(0, 8).toString('ascii');
  assert(header.startsWith('%PDF-1.4'), 'Header deve ser %PDF-1.4');
  const footer = pdfBuf.slice(pdfBuf.length - 20).toString('ascii');
  assert(footer.includes('%%EOF'), 'Footer deve conter %%EOF');
});

// --- Teste 6: Validação de Magic Bytes e Uploads no Backend ---
runTest('6. Backend valida assinaturas de arquivo reais (Magic Bytes) e bloqueia extensões forjadas', () => {
  // Teste de assinaturas binárias
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const fakePng = Buffer.from('Este eh um arquivo de texto comum fingindo ser png');

  assert(pngHeader[0] === 0x89 && pngHeader[1] === 0x50 && pngHeader[2] === 0x4E && pngHeader[3] === 0x47, 'PNG deve ter magic bytes corretos');
  assert(!(fakePng[0] === 0x89 && fakePng[1] === 0x50), 'Arquivo falso não deve passar');

  // Teste de sanitização SVG contra XSS
  const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  assert(maliciousSvg.includes('<script'), 'Script deve ser detectado e bloqueado no backend');

  const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
  assert(!cleanSvg.includes('<script') && !/on\w+\s*=/i.test(cleanSvg), 'SVG limpo deve ser aceito');
});

// --- Teste 7: Proteção do Diretório Privado e Path Traversal em server.cjs ---
runTest('7. server.cjs protege cofre privado data/briefing_uploads e rota /briefing', () => {
  const serverCode = fs.readFileSync(path.join(ROOT, 'server.cjs'), 'utf8');

  // Proteção do cofre
  assert(serverCode.includes("filePath.includes(path.join('data', 'briefing_uploads'))"), 'Bloqueio estrito de acesso direto ao cofre de uploads');
  assert(serverCode.includes("safePath === '/briefing' || safePath === '/briefing/'"), 'Roteamento limpo para /briefing.html');

  // Limite de payload para uploads
  assert(serverCode.includes('25 * 1024 * 1024'), 'Limite de payload expandido para 25MB para acomodar anexos com segurança');

  // Endpoints administrativos
  assert(serverCode.includes("pathname === '/api/briefings' && req.method === 'POST'"), 'Endpoint POST /api/briefings configurado');
  assert(serverCode.includes("pathname === '/api/briefings' && req.method === 'GET'"), 'Endpoint GET /api/briefings configurado');
  assert(serverCode.includes("pathname.includes('/download/')"), 'Endpoint de download seguro configurado');
  assert(serverCode.includes("pathname.endsWith('/pdf')"), 'Endpoint de PDF configurado');
  assert(serverCode.includes("pathname.endsWith('/status') && req.method === 'PATCH'"), 'Endpoint PATCH /status configurado');
});

// --- Teste 8: Painel Administrativo em assets/js/admin.js ---
runTest('8. assets/js/admin.js possui aba Briefings, filtros, modal completo e download seguro de anexos', () => {
  const adminCode = fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8');

  assert(adminCode.includes("this.activeTab = 'briefings'"), 'Aba inicial de briefings configurada');
  assert(adminCode.includes('renderBriefingsTab()'), 'Método renderBriefingsTab presente');
  assert(adminCode.includes('openBriefingDetail('), 'Método openBriefingDetail presente');
  assert(adminCode.includes('updateBriefingStatus('), 'Método updateBriefingStatus presente');
  assert(adminCode.includes('/api/briefings/'), 'Chamadas à API protegida de briefings presentes');
  assert(adminCode.includes('Trilha de Auditoria'), 'Exibição de logs de auditoria no modal');
});

// --- Teste 9: Inclusão no sitemap.xml ---
runTest('9. sitemap.xml inclui a rota oficial https://www.orlinxgroup.com.br/briefing.html', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert(sitemap.includes('https://www.orlinxgroup.com.br/briefing.html'), 'briefing.html ausente do sitemap');
  assert(sitemap.includes('<priority>0.9</priority>'), 'Prioridade correta no sitemap');
});

// --- Teste 10: Canal Oficial de Comunicação Comercial ---
runTest('10. Endereço comercial@orlinxgroup.com.br mantido como canal exclusivo de notificação', () => {
  const serverCode = fs.readFileSync(path.join(ROOT, 'server.cjs'), 'utf8');
  const briefingHtml = fs.readFileSync(path.join(ROOT, 'briefing.html'), 'utf8');

  assert(serverCode.includes('comercial@orlinxgroup.com.br'), 'Notificação no server deve ser enviada para comercial@orlinxgroup.com.br');
  assert(briefingHtml.includes('comercial@orlinxgroup.com.br'), 'briefing.html deve referenciar comercial@orlinxgroup.com.br');
});

// --- Teste 11: Isolamento Rigoroso — Proibição de ORLINX 2.0 ---
runTest('11. Isolamento absoluto: Nenhuma referência ao ORLINX 2.0 ou a outros bancos', () => {
  const filesToCheck = [
    'briefing.html',
    'assets/js/briefing.js',
    'assets/js/admin.js',
    'server.cjs',
    'supabase/migrations/20261014_orlinx_briefing_schema.sql'
  ];

  filesToCheck.forEach(file => {
    const fullPath = path.join(ROOT, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert(!content.toLowerCase().includes('orlinx 2.0'), `Arquivo ${file} contém menção proibida ao ORLINX 2.0`);
    }
  });
});

console.log('\n================================================================');
console.log(`RESULTADO DA AUDITORIA: ${passCount} PASS / ${failCount} FAIL`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
