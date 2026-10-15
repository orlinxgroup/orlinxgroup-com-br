const path = require('path');
const { uploadFile } = require('./upload_file.cjs');

const UPLOAD_URL = 'https://srv1938-files.hstgr.io/rest/6343eef44e15d4a8/api/tus/public_html';
const AUTH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJsb2NhbGUiOiJlbl9VUyIsInZpZXdNb2RlIjoibGlzdCIsInNpbmdsZUNsaWNrIjpmYWxzZSwicmVkaXJlY3RBZnRlckNvcHlNb3ZlIjpmYWxzZSwicGVybSI6eyJhZG1pbiI6ZmFsc2UsImV4ZWN1dGUiOmZhbHNlLCJjcmVhdGUiOnRydWUsInJlbmFtZSI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJkZWxldGUiOnRydWUsInNoYXJlIjpmYWxzZSwiZG93bmxvYWQiOnRydWV9LCJjb21tYW5kcyI6W10sImxvY2tQYXNzd29yZCI6dHJ1ZSwiaGlkZURvdGZpbGVzIjpmYWxzZSwiZGF0ZUZvcm1hdCI6ZmFsc2UsInVzZXJuYW1lIjoidTIyMzgxMzUxMCIsImFjZUVkaXRvclRoZW1lIjoiIn0sImlzcyI6IkZpbGUgQnJvd3NlciIsImV4cCI6MTc5MjEyNjE3MiwiaWF0IjoxNzkyMTA0NTcyfQ.TGqDJNi-3bcjyHmiT5LF2y2gzgk3AMYGD-1tKZd-eCU';
const REST_AUTH_KEY = '1ca762434465bee139b6f3b7bdf6b45c6b58ad7a1dddf54f3570a892e6f6d556-6343eef44e15d4a8';

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('--- INICIANDO DEPLOY DA CAMPANHA TESSARI MALHAS NA HOSTINGER ---');

  const filesToDeploy = [
    {
      remote: 'api/campaigns.php',
      local: path.join(ROOT, 'dist', 'api', 'campaigns.php')
    },
    {
      remote: 'api/telemetry.php',
      local: path.join(ROOT, 'dist', 'api', 'telemetry.php')
    },
    {
      remote: '.htaccess',
      local: path.join(ROOT, 'dist', '.htaccess')
    },
    {
      remote: 'assets/js/ads-engine.js',
      local: path.join(ROOT, 'dist', 'assets', 'js', 'ads-engine.js')
    },
    {
      remote: 'assets/js/admin.js',
      local: path.join(ROOT, 'dist', 'assets', 'js', 'admin.js')
    },
    {
      remote: 'assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg',
      local: path.join(ROOT, 'dist', 'assets', 'ads', 'tessari', 'tessari_orlinx_ads_banner_1600x720.jpg')
    },
    {
      remote: 'index.html',
      local: path.join(ROOT, 'dist', 'index.html')
    }
  ];

  for (const item of filesToDeploy) {
    console.log(`[Deploy] Enviando: ${item.remote}...`);
    await uploadFile(
      UPLOAD_URL,
      AUTH_KEY,
      REST_AUTH_KEY,
      item.remote,
      item.local
    );
  }

  console.log('\n[Deploy Sucesso] Todos os arquivos da campanha Tessari Malhas foram publicados com sucesso na Hostinger!');
}

main().catch(err => {
  console.error('[Erro Deploy]:', err.message || err);
  process.exit(1);
});
