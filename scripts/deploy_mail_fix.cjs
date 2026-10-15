const path = require('path');
const { uploadFile } = require('./upload_file.cjs');

const UPLOAD_URL = 'https://srv1938-files.hstgr.io/rest/93dc1d0a4f6dc07c/api/tus/public_html';
const AUTH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJsb2NhbGUiOiJlbl9VUyIsInZpZXdNb2RlIjoibGlzdCIsInNpbmdsZUNsaWNrIjpmYWxzZSwicmVkaXJlY3RBZnRlckNvcHlNb3ZlIjpmYWxzZSwicGVybSI6eyJhZG1pbiI6ZmFsc2UsImV4ZWN1dGUiOmZhbHNlLCJjcmVhdGUiOnRydWUsInJlbmFtZSI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJkZWxldGUiOnRydWUsInNoYXJlIjpmYWxzZSwiZG93bmxvYWQiOnRydWV9LCJjb21tYW5kcyI6W10sImxvY2tQYXNzd29yZCI6dHJ1ZSwiaGlkZURvdGZpbGVzIjpmYWxzZSwiZGF0ZUZvcm1hdCI6ZmFsc2UsInVzZXJuYW1lIjoidTIyMzgxMzUxMCIsImFjZUVkaXRvclRoZW1lIjoiIn0sImlzcyI6IkZpbGUgQnJvd3NlciIsImV4cCI6MTc5MjEwODYwMSwiaWF0IjoxNzkyMDg3MDAxfQ.daNVl9LzRz4aqFxg55AQzxp63a8_34nkFuhafJ5t6aE';
const REST_AUTH_KEY = 'c85ace2a36878c92dbfb81ee2da6b5651aca81ae44e0bb3460375b7376ce8dce-93dc1d0a4f6dc07c';

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
