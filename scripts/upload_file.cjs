const fs = require('fs');
const https = require('https');
const url = require('url');

async function uploadFile(uploadBaseUrl, authKey, restAuthKey, relativePath, localFilePath) {
  const fileContent = fs.readFileSync(localFilePath);
  const fileSize = fileContent.length;

  const targetUrl = `${uploadBaseUrl}/${encodeURI(relativePath)}?override=true`;
  const parsed = new url.URL(targetUrl);

  console.log(`[Upload] Iniciando: ${relativePath} (${fileSize} bytes) -> ${targetUrl}`);

  // Step 1: POST to create upload
  await new Promise((resolve, reject) => {
    const postReq = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'X-Auth': authKey,
        'X-Auth-Rest': restAuthKey,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': fileSize.toString(),
        'Upload-Offset': '0'
      }
    }, (res) => {
      console.log(`[Upload POST] Status: ${res.statusCode} ${res.statusMessage}`);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Falha no POST (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    postReq.on('error', reject);
    postReq.end();
  });

  // Step 2: PATCH with binary data
  await new Promise((resolve, reject) => {
    const patchReq = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'PATCH',
      headers: {
        'X-Auth': authKey,
        'X-Auth-Rest': restAuthKey,
        'Tus-Resumable': '1.0.0',
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0',
        'Content-Length': fileSize.toString()
      }
    }, (res) => {
      console.log(`[Upload PATCH] Status: ${res.statusCode} ${res.statusMessage}`);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Upload Sucesso] ${relativePath} publicado com sucesso!`);
          resolve();
        } else {
          reject(new Error(`Falha no PATCH (HTTP ${res.statusCode}): ${body}`));
        }
      });
    });

    patchReq.on('error', reject);
    patchReq.write(fileContent);
    patchReq.end();
  });
}

module.exports = { uploadFile };
