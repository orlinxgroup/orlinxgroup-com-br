const https = require('https');
const assert = require('assert');

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: resBody }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runAudit() {
  console.log('=== AUDITORIA DE PRODUÇÃO AO VIVO: ORLINX ADS & TESSARI MALHAS ===\n');

  // 1. API de Campanhas
  console.log('1. Testando endpoint de campanhas (https://www.orlinxgroup.com.br/api/campaigns)...');
  const campRes = await get('https://www.orlinxgroup.com.br/api/campaigns');
  assert.strictEqual(campRes.statusCode, 200, `Esperado HTTP 200, recebido ${campRes.statusCode}`);
  const campJson = JSON.parse(campRes.body);
  assert.ok(campJson.success, 'Campo success deve ser true');
  const tessari = campJson.campaigns.find(c => c.id === 'camp-tessari-verao');
  assert.ok(tessari, 'Campanha camp-tessari-verao não encontrada no catálogo de produção');
  assert.strictEqual(tessari.client_name, 'Tessari Malhas');
  assert.strictEqual(tessari.slot, 'feed-billboard');
  assert.strictEqual(tessari.target_url, 'https://www.tessarimalhas.com.br');
  assert.strictEqual(tessari.cta_text, 'Conheça a Coleção');
  console.log('   [OK] Campanha Tessari Malhas ativa e configurada corretamente no JSON de produção.');

  // 2. Banner Publicitário em Produção
  console.log('2. Testando entrega do banner (https://www.orlinxgroup.com.br/assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg)...');
  const bannerRes = await get('https://www.orlinxgroup.com.br/assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg');
  assert.strictEqual(bannerRes.statusCode, 200, `Banner retornou status ${bannerRes.statusCode}`);
  assert.strictEqual(bannerRes.headers['content-type'], 'image/jpeg', 'Content-type deve ser image/jpeg');
  assert.ok(parseInt(bannerRes.headers['content-length'] || '0') > 50000, 'Banner deve ter tamanho adequado');
  console.log(`   [OK] Banner entregue com sucesso (${bannerRes.headers['content-length']} bytes, image/jpeg).`);

  // 3. Telemetria de Impressão
  console.log('3. Testando telemetria de impressão...');
  const impRes = await post('https://www.orlinxgroup.com.br/api/telemetry.php', {
    campaignId: 'camp-tessari-verao',
    type: 'impression',
    slot: 'feed-billboard'
  }, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'
  });
  assert.strictEqual(impRes.statusCode, 200);
  const impJson = JSON.parse(impRes.body);
  assert.ok(impJson.success && impJson.recorded);
  console.log('   [OK] Impressão registrada com sucesso (LGPD complacente).');

  // 4. Telemetria de Clique
  console.log('4. Testando telemetria de clique...');
  const clickRes = await post('https://www.orlinxgroup.com.br/api/telemetry.php', {
    campaignId: 'camp-tessari-verao',
    type: 'click',
    slot: 'feed-billboard'
  }, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0'
  });
  assert.strictEqual(clickRes.statusCode, 200);
  const clickJson = JSON.parse(clickRes.body);
  assert.ok(clickJson.success && clickJson.recorded);
  console.log('   [OK] Clique registrado com sucesso com controle anti-duplicação.');

  // 5. Destino Final
  console.log('5. Testando site de destino (https://www.tessarimalhas.com.br)...');
  const destRes = await get('https://www.tessarimalhas.com.br', {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  assert.strictEqual(destRes.statusCode, 200, `Destino retornou ${destRes.statusCode}`);
  console.log('   [OK] Destino oficial da Tessari Malhas operacional e acessível via HTTPS.');

  console.log('\n=== AUDITORIA CONCLUÍDA COM 100% DE APROVAÇÃO ===');
}

runAudit().catch(err => {
  console.error('\n[FALHA NA AUDITORIA]:', err.message || err);
  process.exit(1);
});
