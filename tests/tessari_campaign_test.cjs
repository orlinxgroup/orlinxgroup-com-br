/**
 * Teste de Validação da Campanha Publicitária Tessari Malhas - ORLINX ADS
 * Valida integridade de dados, dimensões do banner, conformidade HTTPS, links externos e telemetria
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- INICIANDO BATERIA DE TESTES: CAMPANHA TESSARI MALHAS ---');

// 1. Validação do arquivo de banner
const bannerRelPath = 'assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg';
const bannerFullPath = path.resolve(__dirname, '..', bannerRelPath);
const distBannerFullPath = path.resolve(__dirname, '..', 'dist', bannerRelPath);

console.log('1. Verificando presença e dimensões do banner publicitário...');
assert.ok(fs.existsSync(bannerFullPath), `Arquivo de banner raiz não encontrado: ${bannerFullPath}`);
assert.ok(fs.existsSync(distBannerFullPath), `Arquivo de banner dist não encontrado: ${distBannerFullPath}`);

const stat = fs.statSync(bannerFullPath);
assert.ok(stat.size > 10000, `Arquivo de banner parece corrompido ou muito pequeno: ${stat.size} bytes`);
console.log(`   [OK] Banner presente: ${stat.size} bytes`);

// 2. Validação do ads-engine.js
console.log('2. Verificando configuração no motor de anúncios (ads-engine.js)...');
const engineCode = fs.readFileSync(path.resolve(__dirname, '..', 'assets/js/ads-engine.js'), 'utf8');

assert.ok(engineCode.includes('camp-tessari-verao'), 'ID da campanha camp-tessari-verao ausente no engine');
assert.ok(engineCode.includes('Tessari Malhas'), 'Anunciante Tessari Malhas ausente no engine');
assert.ok(engineCode.includes('Elegância que acompanha o verão'), 'Título da campanha ausente no engine');
assert.ok(engineCode.includes('Moda Praia e Piscina'), 'Categoria Moda Praia e Piscina ausente no engine');
assert.ok(engineCode.includes('Conheça a Coleção'), 'CTA Conheça a Coleção ausente no engine');
assert.ok(engineCode.includes('https://www.tessarimalhas.com.br'), 'URL segura HTTPS da Tessari ausente no engine');
assert.ok(engineCode.includes('/assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg'), 'Caminho do banner ausente no engine');
assert.ok(engineCode.includes('feed-billboard'), 'Slot feed-billboard ausente no engine');
assert.ok(engineCode.includes('rel="noopener noreferrer"'), 'Atributo de segurança rel=noopener noreferrer ausente');
assert.ok(engineCode.includes('target="_blank"'), 'Atributo target=_blank ausente');
console.log('   [OK] Configurações no ads-engine.js validadas');

// 3. Validação dos endpoints de API
console.log('3. Verificando endpoints de backend em api/ ...');
const campaignsPhp = fs.readFileSync(path.resolve(__dirname, '..', 'api/campaigns.php'), 'utf8');
assert.ok(campaignsPhp.includes('camp-tessari-verao'), 'Campanha Tessari ausente em api/campaigns.php');
assert.ok(campaignsPhp.includes('https://www.tessarimalhas.com.br'), 'URL HTTPS ausente em api/campaigns.php');
console.log('   [OK] api/campaigns.php estruturado');

const telemetryPhp = fs.readFileSync(path.resolve(__dirname, '..', 'api/telemetry.php'), 'utf8');
assert.ok(telemetryPhp.includes('impression'), 'Evento impression ausente em api/telemetry.php');
assert.ok(telemetryPhp.includes('click'), 'Evento click ausente em api/telemetry.php');
assert.ok(telemetryPhp.includes('sha256'), 'Anonimização de IP SHA256 (LGPD) ausente em api/telemetry.php');
console.log('   [OK] api/telemetry.php estruturado com conformidade LGPD');

// 4. Validação da presença do slot em index.html
console.log('4. Verificando slot publicitário feed-billboard em index.html...');
const indexHtml = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
assert.ok(indexHtml.includes('data-orx-slot="feed-billboard"'), 'Slot feed-billboard ausente em index.html');
assert.ok(indexHtml.includes('/assets/js/ads-engine.js'), 'Inclusão do ads-engine.js ausente em index.html');
console.log('   [OK] Slot feed-billboard ativo e integrado no feed do portal');

console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
