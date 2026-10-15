const path = require('path');
const { uploadFile } = require('./upload_file.cjs');

const UPLOAD_URL = 'https://srv1938-files.hstgr.io/rest/da121d4fa10fdcb5/api/tus/public_html';
const AUTH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJsb2NhbGUiOiJlbl9VUyIsInZpZXdNb2RlIjoibGlzdCIsInNpbmdsZUNsaWNrIjpmYWxzZSwicmVkaXJlY3RBZnRlckNvcHlNb3ZlIjpmYWxzZSwicGVybSI6eyJhZG1pbiI6ZmFsc2UsImV4ZWN1dGUiOmZhbHNlLCJjcmVhdGUiOnRydWUsInJlbmFtZSI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJkZWxldGUiOnRydWUsInNoYXJlIjpmYWxzZSwiZG93bmxvYWQiOnRydWV9LCJjb21tYW5kcyI6W10sImxvY2tQYXNzd29yZCI6dHJ1ZSwiaGlkZURvdGZpbGVzIjpmYWxzZSwiZGF0ZUZvcm1hdCI6ZmFsc2UsInVzZXJuYW1lIjoidTIyMzgxMzUxMCIsImFjZUVkaXRvclRoZW1lIjoiIn0sImlzcyI6IkZpbGUgQnJvd3NlciIsImV4cCI6MTc5MjA5OTQ4MCwiaWF0IjoxNzkyMDc3ODgwfQ.0NTorwJ_pMTVP7iADSQc12pvh0AsjAISBAWXBxE51q0';
const REST_AUTH_KEY = '0b6bb178ca6a74bdd4091f05580d943ba7fe05daed16c968ab61f3e06048a86f-da121d4fa10fdcb5';

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('[Deploy] Iniciando upload de api/notify-briefing.php...');
  await uploadFile(
    UPLOAD_URL,
    AUTH_KEY,
    REST_AUTH_KEY,
    'api/notify-briefing.php',
    path.join(ROOT, 'dist', 'api', 'notify-briefing.php')
  );

  console.log('[Deploy] Iniciando upload de briefing.html...');
  await uploadFile(
    UPLOAD_URL,
    AUTH_KEY,
    REST_AUTH_KEY,
    'briefing.html',
    path.join(ROOT, 'dist', 'briefing.html')
  );

  console.log('[Deploy] Iniciando upload de assets/js/briefing.js...');
  await uploadFile(
    UPLOAD_URL,
    AUTH_KEY,
    REST_AUTH_KEY,
    'assets/js/briefing.js',
    path.join(ROOT, 'dist', 'assets', 'js', 'briefing.js')
  );

  console.log('[Deploy Sucesso] Todos os arquivos foram publicados com sucesso na Hostinger!');
}

main().catch(err => {
  console.error('[Erro Deploy]:', err);
  process.exit(1);
});
