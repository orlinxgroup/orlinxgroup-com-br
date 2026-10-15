const path = require('path');
const { uploadFile } = require('./upload_file.cjs');

const UPLOAD_URL = 'https://srv1938-files.hstgr.io/rest/93dc1d0a4f6dc07c/api/tus/public_html';
const AUTH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJsb2NhbGUiOiJlbl9VUyIsInZpZXdNb2RlIjoibGlzdCIsInNpbmdsZUNsaWNrIjpmYWxzZSwicmVkaXJlY3RBZnRlckNvcHlNb3ZlIjpmYWxzZSwicGVybSI6eyJhZG1pbiI6ZmFsc2UsImV4ZWN1dGUiOmZhbHNlLCJjcmVhdGUiOnRydWUsInJlbmFtZSI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJkZWxldGUiOnRydWUsInNoYXJlIjpmYWxzZSwiZG93bmxvYWQiOnRydWV9LCJjb21tYW5kcyI6W10sImxvY2tQYXNzd29yZCI6dHJ1ZSwiaGlkZURvdGZpbGVzIjpmYWxzZSwiZGF0ZUZvcm1hdCI6ZmFsc2UsInVzZXJuYW1lIjoidTIyMzgxMzUxMCIsImFjZUVkaXRvclRoZW1lIjoiIn0sImlzcyI6IkZpbGUgQnJvd3NlciIsImV4cCI6MTc5MjEwODYwMSwiaWF0IjoxNzkyMDg3MDAxfQ.daNVl9LzRz4aqFxg55AQzxp63a8_34nkFuhafJ5t6aE';
const REST_AUTH_KEY = 'c85ace2a36878c92dbfb81ee2da6b5651aca81ae44e0bb3460375b7376ce8dce-93dc1d0a4f6dc07c';

const scratchFile = 'C:\\Users\\Junior_Pir4tta2\\.gemini\\antigravity\\brain\\e2e2164d-a415-476a-a9f5-344bcbf69468\\scratch\\test_inbox_delivery.php';

async function main() {
  await uploadFile(
    UPLOAD_URL,
    AUTH_KEY,
    REST_AUTH_KEY,
    'api/test_inbox.php',
    scratchFile
  );
  console.log('[Deploy] api/test_inbox.php enviado com sucesso!');
}

main().catch(err => {
  console.error('[Erro Deploy]:', err);
  process.exit(1);
});
