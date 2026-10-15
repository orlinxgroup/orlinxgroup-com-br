const https = require('https');

const SUPABASE_URL = 'https://ulajrvkaqqedwuaiaksp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5OvenPLd8XALBaYN5YF25g_6VAx_MAk';
const NOTIFY_URL = 'https://www.orlinxgroup.com.br/api/notify-briefing.php';

async function main() {
  const protocolCode = `BRF-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  console.log(`\n=== INICIANDO TESTE E2E BRIEFING DIGITAL COM NOTIFICAÇÃO REAL ===`);
  console.log(`Protocolo gerado: ${protocolCode}`);

  const testPayload = {
    protocol_code: protocolCode,
    company_name: 'ORLINX Validação Produção Ltda',
    trading_name: 'ORLINX E2E Test',
    document_number: '98.765.432/0001-10',
    contact_name: 'Marcos Silva',
    email: 'marcos.silva@techcorp.com.br',
    phone: '(11) 98765-4321',
    city_state: 'São Paulo/SP',
    business_segment: 'Tecnologia Corporativa',
    project_type: 'institucional',
    primary_goal: 'gerar_leads',
    target_audience: 'Executivos B2B e Diretores de Marketing',
    project_summary: 'Teste real de homologação do Briefing Digital ORLINX ADS com gravação no Supabase e entrega de notificação por e-mail.',
    required_pages: ['Home', 'Quem Somos', 'Serviços', 'Briefing Digital', 'Contato'],
    custom_features: ['Validação Serverless', 'Entrega Hostinger PHP Mail'],
    special_requirements: 'Nenhuma restrição externa.',
    brand_status: 'possui_marca_pronta',
    design_style: 'moderno_corporativo',
    color_palette: {
      primary: '#080E1E',
      secondary: '#2E1F1A',
      accent: '#D4AF37',
      avoid: '#FF0055'
    },
    uploaded_files: [
      { originalName: 'briefing_validacao_final.pdf', category: 'Documento Técnico' }
    ],
    benchmark_urls: [{ url: 'https://orlinxgroup.com.br', notes: 'Design limpo e alta conversão' }],
    disliked_elements: 'Nenhum',
    content_source: 'cliente_fornece_pronto',
    media_source: 'fotos_proprias',
    languages: ['pt-BR'],
    domain_status: 'ja_registrado',
    domain_name: 'orlinxgroup.com.br',
    hosting_preference: 'hospedagem_orlinx',
    corporate_emails_needed: 3,
    ads_opt_in: true,
    ads_format: 'feed-billboard',
    ads_target_url: 'https://www.orlinxgroup.com.br',
    ads_period_days: 30,
    ads_budget_range: 'R$ 1.500 a R$ 3.000',
    target_launch_date: '2026-11-15',
    investment_bracket: 'R$ 6.000 a R$ 12.000 (Institucional Completo)',
    privacy_policy_accepted: true,
    privacy_accepted_at: new Date().toISOString(),
    portfolio_showcase_authorized: true,
    portfolio_authorized_at: new Date().toISOString(),
    status: 'submitted'
  };

  // 1. Gravação no Supabase PostgREST
  console.log(`\n[Etapa 1] Enviando POST para Supabase PostgREST (${SUPABASE_URL}/rest/v1/orx_briefings)...`);
  const sbPostData = JSON.stringify(testPayload);
  
  const sbResult = await new Promise((resolve, reject) => {
    const parsed = new URL(`${SUPABASE_URL}/rest/v1/orx_briefings`);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(sbPostData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.write(sbPostData);
    req.end();
  });

  console.log(`[Supabase PostgREST] Status HTTP: ${sbResult.status}`);
  if (sbResult.status === 201 || (sbResult.status >= 200 && sbResult.status < 300)) {
    console.log(`✓ Gravação no Supabase confirmada com sucesso (HTTP ${sbResult.status})!`);
  } else {
    console.error(`✗ Falha na gravação Supabase:`, sbResult.status, sbResult.body);
    process.exit(1);
  }

  // 2. Disparo da Notificação de E-mail via /api/notify-briefing.php
  console.log(`\n[Etapa 2] Enviando notificação via Hostinger (${NOTIFY_URL})...`);
  const notifyPostData = JSON.stringify(testPayload);

  const notifyResult = await new Promise((resolve, reject) => {
    const parsed = new URL(NOTIFY_URL);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Origin': 'https://www.orlinxgroup.com.br',
        'Content-Length': Buffer.byteLength(notifyPostData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(notifyPostData);
    req.end();
  });

  console.log(`[Hostinger Notify] Status HTTP: ${notifyResult.status}`);
  console.log(`[Hostinger Notify] Resposta: ${notifyResult.body}`);

  let parsedNotify;
  try {
    parsedNotify = JSON.parse(notifyResult.body);
  } catch (e) {
    console.error(`✗ Erro ao parsear resposta do despachante:`, e);
  }

  if (notifyResult.status === 200 && parsedNotify && parsedNotify.success) {
    console.log(`✓ Notificação por e-mail despachada com sucesso para ${parsedNotify.recipient}!`);
  } else {
    console.error(`✗ Falha no despacho de notificação.`);
    process.exit(1);
  }

  console.log(`\n=== TESTE E2E CONCLUÍDO COM SUCESSO ABSOLUTO ===`);
  console.log(`Protocolo: ${protocolCode}`);
  console.log(`Supabase DB: HTTP ${sbResult.status} (Gravado)`);
  console.log(`Hostinger Email: HTTP ${notifyResult.status} (Despachado para comercial@orlinxgroup.com.br)`);
}

main().catch(err => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
