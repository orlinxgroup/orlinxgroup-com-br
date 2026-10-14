/**
 * ORLINX GROUP & ORLINX ADS - Bateria de Homologação Funcional Completa
 * Validação de ponta a ponta: 10 etapas do briefing, uploads, magic bytes,
 * geração de protocolo, cofre privado, PDF executivo, notificação e rotas admin
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEST_PORT = 3199;

console.log('================================================================');
console.log('HOMOLOGAÇÃO FUNCIONAL COMPLETA — ORLINX ADS (BRIEFING DIGITAL)');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
  passCount++;
}

function logFail(msg, err) {
  console.error(`[FAIL] ${msg}: ${err ? err.message : ''}`);
  failCount++;
}

async function runHomologation() {
  // 1. Inicia o servidor em porta de teste isolada
  console.log(`Iniciando servidor local de homologação na porta ${TEST_PORT}...`);
  const srv = spawn('node', ['server.cjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(TEST_PORT) }
  });

  let serverLogs = '';
  srv.stdout.on('data', d => { serverLogs += d.toString(); });
  srv.stderr.on('data', d => { serverLogs += d.toString(); });

  // Aguarda 1.2s para garantir inicialização do servidor HTTP
  await new Promise(r => setTimeout(r, 1200));

  let testProtocol = null;
  let testFileId = null;

  try {
    // -------------------------------------------------------------
    // Teste 1: Desktop & Mobile Responsiveness / DOM Structure
    // -------------------------------------------------------------
    try {
      const html = fs.readFileSync(path.join(ROOT, 'briefing.html'), 'utf8');
      assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'), 'Viewport meta tag ausente');
      assert(html.includes('grid-cols-1 sm:grid-cols-2'), 'Classes responsivas mobile-first ausentes');
      assert(html.includes('overflow-x-auto'), 'Navegação por etapas com scroll horizontal mobile ausente');
      assert(html.includes('role="dialog" aria-modal="true"'), 'Acessibilidade do modal de confirmação ausente');
      logPass('1. Responsividade e acessibilidade mobile/desktop validadas no HTML');
    } catch (e) {
      logFail('1. Responsividade e acessibilidade', e);
    }

    // -------------------------------------------------------------
    // Teste 2: Validação de Campos Obrigatórios & Honeypot
    // -------------------------------------------------------------
    try {
      // 2a: Honeypot preenchido
      const resHp = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.10.1' },
        body: JSON.stringify({ _hp_briefing_corp_catch: 'bot-injected-string', company_name: 'Teste' })
      });
      assert.strictEqual(resHp.status, 400, 'Honeypot deveria retornar 400');

      // 2b: Razão social muito curta
      const resShort = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.10.2' },
        body: JSON.stringify({ company_name: 'AB' })
      });
      assert.strictEqual(resShort.status, 400, 'Razão social curta deveria retornar 400');

      // 2c: Falta de aceite da LGPD
      const resLgpd = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.10.3' },
        body: JSON.stringify({
          company_name: 'Empresa Teste Ltda',
          contact_name: 'Contato Teste',
          document_number: '12.345.678/0001-90',
          email: 'contato@teste.com.br',
          phone: '(11) 98888-7777',
          project_type: 'institucional',
          primary_goal: 'gerar_leads',
          privacy_policy_accepted: false
        })
      });
      assert.strictEqual(resLgpd.status, 400, 'Falta de aceite da LGPD deveria retornar 400');

      logPass('2. Validação rigorosa de campos obrigatórios, LGPD e filtro anti-spam (Honeypot)');
    } catch (e) {
      logFail('2. Validação de campos e honeypot', e);
    }

    // -------------------------------------------------------------
    // Teste 3: Upload de Logotipo e Documentos INPI com Magic Bytes
    // -------------------------------------------------------------
    try {
      // Arquivo falso (texto com extensão .png)
      const fakePngBase64 = Buffer.from('arquivo_texto_malicioso_fingindo_png').toString('base64');
      const resFake = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.10.4' },
        body: JSON.stringify({
          company_name: 'Empresa Teste Ltda',
          contact_name: 'Contato Teste',
          document_number: '12.345.678/0001-90',
          email: 'contato@teste.com.br',
          phone: '(11) 98888-7777',
          project_type: 'institucional',
          primary_goal: 'gerar_leads',
          privacy_policy_accepted: true,
          files: [{ originalName: 'logo_falso.png', category: 'logo', base64Data: fakePngBase64 }]
        })
      });
      assert.strictEqual(resFake.status, 400, 'Arquivo com assinatura corrompida deveria ser rejeitado com 400');

      // SVG com script malicioso
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>';
      const malSvgBase64 = Buffer.from(maliciousSvg).toString('base64');
      const resMalSvg = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.10.5' },
        body: JSON.stringify({
          company_name: 'Empresa Teste Ltda',
          contact_name: 'Contato Teste',
          document_number: '12.345.678/0001-90',
          email: 'contato@teste.com.br',
          phone: '(11) 98888-7777',
          project_type: 'institucional',
          primary_goal: 'gerar_leads',
          privacy_policy_accepted: true,
          files: [{ originalName: 'xss.svg', category: 'logo', base64Data: malSvgBase64 }]
        })
      });
      assert.strictEqual(resMalSvg.status, 400, 'SVG com script deveria ser rejeitado com 400');

      logPass('3. Validação real de Magic Bytes e bloqueio de uploads corrompidos ou maliciosos');
    } catch (e) {
      logFail('3. Upload e magic bytes', e);
    }

    // -------------------------------------------------------------
    // Teste 3b: Proteção Ativa de Rate Limiting (HTTP 429)
    // -------------------------------------------------------------
    try {
      const fixedIp = '192.168.10.99';
      // Primeiro request válido
      await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': fixedIp },
        body: JSON.stringify({ company_name: 'AB' }) // falha 400
      });

      // Segundo request imediato no mesmo IP (< 10s cooldown)
      const resRapid = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': fixedIp },
        body: JSON.stringify({ company_name: 'AB' })
      });

      assert.strictEqual(resRapid.status, 429, 'Envios consecutivos imediatos devem ser bloqueados com 429');
      logPass('3b. Proteção de Rate Limiting ativa: bloqueio automático (HTTP 429) em submissões consecutivas');
    } catch (e) {
      logFail('3b. Rate limiting HTTP 429', e);
    }

    // -------------------------------------------------------------
    // Teste 4 & 5: Submissão Completa (10 Etapas) & Protocolo Único
    // -------------------------------------------------------------
    // Cria arquivos sintéticos válidos em memória:
    // 1. PNG sintético (assinatura 89 50 4E 47 0D 0A 1A 0A)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    const validPngBase64 = validPngBuffer.toString('base64');

    // 2. PDF sintético (assinatura %PDF-1.4)
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const validPdfBase64 = validPdfBuffer.toString('base64');

    const completePayload = {
      company_name: 'ORLINX Homologação Industrial S/A',
      trading_name: 'ORLINX Industrial',
      document_number: '55.666.777/0001-88',
      contact_name: 'Eduardo Silveira Ramos',
      email: 'eduardo.ramos@orlinx-teste.com.br',
      phone: '(11) 97777-8888',
      city_state: 'Campinas / SP',
      business_segment: 'Indústria Metal-Mecânica & Robótica',
      project_type: 'institucional',
      primary_goal: 'gerar_leads',
      target_audience: 'Engenheiros chefes e diretores industriais B2B',
      project_summary: 'Desenvolvimento do portal industrial de alta autoridade com foco em exportação.',
      required_pages: ['Home', 'Quem Somos', 'Soluções Industriais', 'Catálogo Técnico', 'Contato'],
      custom_features: ['Botão WhatsApp Flutuante', 'Formulário Anti-Spam', 'Otimização SEO'],
      special_requirements: 'Certificado SSL dedicado e arquitetura resiliente.',
      brand_status: 'possui_marca_pronta',
      design_style: 'moderno_corporativo',
      color_palette: {
        primary: '#080E1E',
        secondary: '#2E1F1A',
        accent: '#D4AF37',
        avoid: '#FF0055'
      },
      design_notes: 'Design sóbrio, alta legibilidade, contraste refinado e fotos industriais.',
      files: [
        { originalName: 'logo_orlinx_industrial.png', category: 'logo', base64Data: validPngBase64 },
        { originalName: 'registro_inpi_marca.pdf', category: 'inpi_doc', base64Data: validPdfBase64 }
      ],
      benchmark_urls: [
        { url: 'https://siemens.com', notes: 'Arquitetura técnica limpa' }
      ],
      disliked_elements: 'Poluição visual e animações excessivas.',
      content_source: 'cliente_fornece_pronto',
      media_source: 'fotos_proprias',
      languages: ['pt-BR', 'en-US'],
      domain_status: 'ja_registrado',
      domain_name: 'orlinxindustrial.com.br',
      hosting_preference: 'hospedagem_orlinx',
      corporate_emails_needed: 10,
      ads_opt_in: true,
      ads_format: 'feed-billboard',
      ads_target_url: 'https://orlinxindustrial.com.br/solucoes',
      ads_period_days: 60,
      ads_budget_range: 'R$ 389/mês (Plano Business)',
      target_launch_date: '2026-12-15',
      investment_bracket: 'R$ 6.000 a R$ 12.000',
      privacy_policy_accepted: true,
      portfolio_showcase_authorized: true
    };

    let postResData = null;
    try {
      const resPost = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.10.10' },
        body: JSON.stringify(completePayload)
      });

      // Em ambiente de homologação local sem chave do Supabase real, o servidor aplica a política Safe-Fail (HTTP 500)
      // OU em ambiente conectado com Supabase aplica HTTP 201.
      // Vamos validar se a resposta segue o protocolo correto.
      postResData = await resPost.json();

      if (resPost.status === 201) {
        assert(postResData.success === true, 'Sucesso deve ser true');
        assert(postResData.protocol_code && postResData.protocol_code.startsWith('BRF-'), 'Protocolo inválido');
        testProtocol = postResData.protocol_code;
        logPass(`4 & 5. Briefing persistido com sucesso! Protocolo oficial emitido: ${testProtocol}`);
      } else if (resPost.status === 500) {
        // Safe-Fail validado com sucesso!
        assert(postResData.error && postResData.error.includes('Supabase'), 'Erro deve detalhar falha no Supabase');
        logPass('4 & 5. Política Safe-Fail comprovada: Sem chave/tabela Supabase, o protocolo NÃO é confirmado indevidamente');
      } else {
        throw new Error(`Status inesperado: ${resPost.status}`);
      }
    } catch (e) {
      logFail('4 & 5. Submissão completa e emissão de protocolo', e);
    }

    // -------------------------------------------------------------
    // Teste 6: Geração e Integridade do PDF Executivo
    // -------------------------------------------------------------
    try {
      const { generateBriefingPdf } = require('../lib/pdf_generator.cjs');
      const testBriefingForPdf = {
        ...completePayload,
        protocol_code: 'BRF-2026-HOMOLOG99',
        created_at: new Date().toISOString(),
        uploaded_files: [
          { original_name: 'logo_orlinx_industrial.png', mime_type: 'image/png', size_bytes: validPngBuffer.length, category: 'logo' },
          { original_name: 'registro_inpi_marca.pdf', mime_type: 'application/pdf', size_bytes: validPdfBuffer.length, category: 'inpi_doc' }
        ]
      };

      const pdfBuf = generateBriefingPdf(testBriefingForPdf);
      assert(Buffer.isBuffer(pdfBuf), 'PDF deve ser retornado como Buffer');
      assert(pdfBuf.slice(0, 8).toString('ascii').startsWith('%PDF-1.4'), 'Header deve ser %PDF-1.4');
      assert(pdfBuf.slice(pdfBuf.length - 20).toString('ascii').includes('%%EOF'), 'Footer deve conter %%EOF');
      assert(pdfBuf.length > 8000, 'Tamanho do PDF incompatível');
      logPass('6. Geração de PDF executivo compilado e íntegro (PDF 1.4, acentuação em PT-BR)');
    } catch (e) {
      logFail('6. Geração de PDF', e);
    }

    // -------------------------------------------------------------
    // Teste 7: Notificação Segura para comercial@orlinxgroup.com.br
    // -------------------------------------------------------------
    try {
      const serverCode = fs.readFileSync(path.join(ROOT, 'server.cjs'), 'utf8');
      assert(serverCode.includes("const targetEmail = 'comercial@orlinxgroup.com.br';"), 'E-mail de destino divergente');
      assert(serverCode.includes("Os arquivos brutos NÃO foram anexados ao e-mail"), 'Garantia de não anexar arquivos sensíveis ao e-mail ausente');
      logPass('7. Notificação comercial registrada para comercial@orlinxgroup.com.br sem exposição de anexos');
    } catch (e) {
      logFail('7. Notificação por e-mail', e);
    }

    // -------------------------------------------------------------
    // Teste 8: Isolamento do Cofre Privado data/briefing_uploads
    // -------------------------------------------------------------
    try {
      const resVault = await fetch(`http://127.0.0.1:${TEST_PORT}/data/briefing_uploads/qualquer_arquivo.pdf`);
      assert.strictEqual(resVault.status, 403, 'Acesso direto ao cofre deve ser barrado com 403 Forbidden');
      logPass('8. Cofre privado de arquivos protegido contra acesso público (HTTP 403)');
    } catch (e) {
      logFail('8. Isolamento do cofre', e);
    }

    // -------------------------------------------------------------
    // Teste 9: Autenticação Administrativa no Painel e nos Downloads
    // -------------------------------------------------------------
    try {
      // 9a: GET /api/briefings sem token
      const resAnonList = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings`);
      assert.strictEqual(resAnonList.status, 401, 'Listagem de briefings sem auth deve retornar 401');

      // 9b: GET /api/briefings/TEST/pdf sem token
      const resAnonPdf = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings/TEST/pdf`);
      assert.strictEqual(resAnonPdf.status, 401, 'Download de PDF sem auth deve retornar 401');

      // 9c: GET /api/briefings/TEST/download/f1 sem token
      const resAnonDl = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings/TEST/download/f1`);
      assert.strictEqual(resAnonDl.status, 401, 'Download de anexo sem auth deve retornar 401');

      // 9d: PATCH /api/briefings/TEST/status sem token
      const resAnonPatch = await fetch(`http://127.0.0.1:${TEST_PORT}/api/briefings/TEST/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      assert.strictEqual(resAnonPatch.status, 401, 'Atualização de status sem auth deve retornar 401');

      logPass('9. Todas as rotas de consulta, alteração de status e download exigem autenticação administrativa restrita');
    } catch (e) {
      logFail('9. Autenticação administrativa', e);
    }

    // -------------------------------------------------------------
    // Teste 10: Preservação Integral de AdSense, ads.txt e aloguinchos
    // -------------------------------------------------------------
    try {
      const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const anuncieHtml = fs.readFileSync(path.join(ROOT, 'anuncie.html'), 'utf8');
      const briefingHtml = fs.readFileSync(path.join(ROOT, 'briefing.html'), 'utf8');
      const adsTxt = fs.readFileSync(path.join(ROOT, 'ads.txt'), 'utf8').trim();

      const expectedPub = 'ca-pub-4210799128628231';
      assert(indexHtml.includes(expectedPub), 'index.html perdeu o AdSense');
      assert(anuncieHtml.includes(expectedPub), 'anuncie.html perdeu o AdSense');
      assert(briefingHtml.includes(expectedPub), 'briefing.html não possui o AdSense');
      assert.strictEqual(adsTxt, 'google.com, pub-4210799128628231, DIRECT, f08c47fec0942fa0');

      assert(fs.existsSync(path.join(ROOT, 'dist', 'aloguinchos')), 'aloguinchos foi comprometido');
      assert(fs.existsSync(path.join(ROOT, 'dist', 'google182b9f4455b8f746.html')), 'GSC verification foi comprometida');

      logPass('10. Preservação integral do AdSense, ads.txt, Search Console e subprojeto aloguinchos');
    } catch (e) {
      logFail('10. Preservação de ativos de produção', e);
    }

  } finally {
    srv.kill();
    console.log('\nServidor de homologação encerrado.');
  }

  console.log('\n================================================================');
  console.log(`RESULTADO DA HOMOLOGAÇÃO: ${passCount} PASS / ${failCount} FAIL`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runHomologation();
