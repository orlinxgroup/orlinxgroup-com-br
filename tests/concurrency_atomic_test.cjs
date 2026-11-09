/**
 * TESTE DE CONCORRÊNCIA E GRAVAÇÃO ATÔMICA
 * Valida a integridade do cofre de pedidos (orders_database.json) sob 10 acessos simultâneos em paralelo.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3110;
process.env.PORT = PORT;
process.env.WOOVI_MOCK_TEST = 'true';

const serverPath = path.join(__dirname, '..', 'server.cjs');
require(serverPath);

function createOrder(index) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      plan: index % 2 === 0 ? 'starter' : 'business',
      company_name: `Empresa Concorrente ${index} Ltda`,
      email: `empresa${index}@concorrencia.com.br`,
      phone: `1198888${String(index).padStart(4, '0')}`
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/checkout-pix',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ index, status: res.statusCode, data: JSON.parse(body) });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runConcurrencyTest() {
  console.log('================================================================');
  console.log('TESTE DE ESTRESSE: 10 REQUISIÇÕES CONCORRENTES SIMULTÂNEAS');
  console.log('================================================================\n');

  await new Promise(r => setTimeout(r, 1000));

  // Dispara 10 requisições rigorosamente em paralelo
  const promises = [];
  for (let i = 1; i <= 10; i++) {
    promises.push(createOrder(i));
  }

  const results = await Promise.all(promises);

  let successCount = 0;
  results.forEach(r => {
    if (r.status === 201 && r.data.success) {
      successCount++;
    } else {
      console.error(`Falha na requisição ${r.index}:`, r.status, r.data);
    }
  });

  // Confere a integridade do arquivo JSON de banco de dados
  const dbPath = path.join(__dirname, '..', 'api', 'data', 'orders_database.json');
  const raw = fs.readFileSync(dbPath, 'utf8');
  let parsedDb = null;
  let isJsonValid = false;
  try {
    parsedDb = JSON.parse(raw);
    isJsonValid = Array.isArray(parsedDb);
  } catch (err) {
    console.error('JSON Corrompido:', err.message);
  }

  console.log(`Requisições com sucesso: ${successCount}/10`);
  console.log(`Integridade do JSON do banco: ${isJsonValid ? 'VÁLIDO E ÍNTEGRO (Array)' : 'CORROMPIDO'}`);
  console.log(`Total de registros no banco: ${parsedDb ? parsedDb.length : 0}`);

  if (successCount === 10 && isJsonValid && parsedDb.length >= 10) {
    console.log('\n[PASSOU] Gravação atômica sob concorrência comprovada com 100% de integridade!');
    process.exit(0);
  } else {
    console.error('\n[FALHOU] Problema na gravação concorrente.');
    process.exit(1);
  }
}

runConcurrencyTest();
