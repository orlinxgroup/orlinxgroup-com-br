const path = require('path');
const { uploadFile } = require('./upload_file.cjs');

const UPLOAD_URL = 'https://srv1938-files.hstgr.io/rest/da121d4fa10fdcb5/api/tus/public_html';
const AUTH_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJsb2NhbGUiOiJlbl9VUyIsInZpZXdNb2RlIjoibGlzdCIsInNpbmdsZUNsaWNrIjpmYWxzZSwicmVkaXJlY3RBZnRlckNvcHlNb3ZlIjpmYWxzZSwicGVybSI6eyJhZG1pbiI6ZmFsc2UsImV4ZWN1dGUiOmZhbHNlLCJjcmVhdGUiOnRydWUsInJlbmFtZSI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJkZWxldGUiOnRydWUsInNoYXJlIjpmYWxzZSwiZG93bmxvYWQiOnRydWV9LCJjb21tYW5kcyI6W10sImxvY2tQYXNzd29yZCI6dHJ1ZSwiaGlkZURvdGZpbGVzIjpmYWxzZSwiZGF0ZUZvcm1hdCI6ZmFsc2UsInVzZXJuYW1lIjoidTIyMzgxMzUxMCIsImFjZUVkaXRvclRoZW1lIjoiIn0sImlzcyI6IkZpbGUgQnJvd3NlciIsImV4cCI6MTc5MjA5OTQ4MCwiaWF0IjoxNzkyMDc3ODgwfQ.0NTorwJ_pMTVP7iADSQc12pvh0AsjAISBAWXBxE51q0';
const REST_AUTH_KEY = '0b6bb178ca6a74bdd4091f05580d943ba7fe05daed16c968ab61f3e06048a86f-da121d4fa10fdcb5';

const scratchFile = 'C:\\Users\\Junior_Pir4tta2\\.gemini\\antigravity\\brain\\e2e2164d-a415-476a-a9f5-344bcbf69468\\scratch\\test_mail.php';

async function main() {
  await uploadFile(
    UPLOAD_URL,
    AUTH_KEY,
    REST_AUTH_KEY,
    'api/test_mail.php',
    scratchFile
  );
  console.log('[Deploy] api/test_mail.php enviado com sucesso!');
}

main().catch(err => {
  console.error('[Erro Deploy]:', err);
  process.exit(1);
});
