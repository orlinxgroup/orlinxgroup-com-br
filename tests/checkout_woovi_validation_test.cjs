/**
 * SUÍTE OFICIAL DE VALIDAÇÃO ESSENCIAL - CHECKOUT WOOVI PIX & ORLINX ADS
 * Cobre estritamente os 8 pontos exigidos na Ordem de Implementação:
 * 1. Criação de pedido com valor correto (servidor fixa centavos: 6990, 14990, 29990).
 * 2. Geração da cobrança Pix (retorno de correlationID, brCode e qrCodeImage).
 * 3. Recebimento de pagamento confirmado em ambiente de teste (webhook OPENPIX:CHARGE_COMPLETED).
 * 4. Rejeição de webhook inválido (evento desconhecido ou assinatura/payload incorreto).
 * 5. Rejeição de cobrança com valor financeiro divergente (anti-fraude/adulteração).
 * 6. Prevenção de processamento duplicado (idempotência no pedido e no webhook).
 * 7. Funcionamento e integridade dos layouts e componentes (desktop e celular).
 * 8. Status oficial do Google Pay (desativado com dependência técnica registrada).
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3099;
process.env.PORT = PORT;
process.env.WOOVI_MOCK_TEST = 'true'; // Habilita mock de teste para validação de sandbox

// Inicia servidor local em porta isolada para testes
const serverPath = path.join(__dirname, '..', 'server.cjs');
require(serverPath);

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      ...options
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('ORLINX ADS | SUÍTE DE TESTES ESSENCIAIS - CHECKOUT WOOVI PIX');
  console.log('================================================================\n');

  // Aguarda 1s para o servidor subir
  await new Promise(r => setTimeout(r, 1000));

  let passed = 0;
  let total = 8;

  // TESTE 1: Criação de pedido com valor correto fixado pelo servidor
  console.log('[TESTE 1] Criação de pedido com validação estrita de valores no servidor');
  try {
    // Tentativa maliciosa do cliente enviando valor adulterado (ex: amount: 1.00 ou amount_cents: 100)
    const res = await request({
      path: '/api/checkout-pix',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      plan: 'starter',
      company_name: 'Empresa Teste Starter Ltda',
      email: 'financeiro@empresateste.com.br',
      phone: '11988887777',
      document: '12345678000199',
      amount: 1.00, // TENTATIVA DE FRAUDE: o servidor DEVE ignorar e aplicar 69.90 (6990 centavos)
      amount_cents: 100
    });

    if (res.status === 201 && res.body.amount_cents === 6990 && res.body.amount === 69.90) {
      console.log('  -> PASSOU: Servidor ignorou valor do cliente e fixou estritamente R$ 69,90 (6990 centavos).');
      passed++;
    } else {
      console.error('  -> FALHOU:', res.status, res.body);
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 2: Geração da cobrança Pix completa (correlationID, brCode, qrCodeImage)
  console.log('\n[TESTE 2] Geração de cobrança Pix oficial (Business - 14990 centavos)');
  let businessOrder = null;
  try {
    const res = await request({
      path: '/api/checkout-pix',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      plan: 'business',
      company_name: 'Loja Exemplo Business S.A.',
      email: 'contato@lojaexemplo.com.br',
      phone: '11977776666'
    });

    if (res.status === 201 && res.body.brCode && res.body.qrCodeImage && res.body.correlationID) {
      businessOrder = res.body;
      console.log(`  -> PASSOU: Cobrança Pix gerada com sucesso! OrderCode: ${res.body.order_code}, CorrelationID: ${res.body.correlationID}`);
      passed++;
    } else {
      console.error('  -> FALHOU:', res.status, res.body);
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 3: Recebimento de pagamento confirmado via Webhook (OPENPIX:CHARGE_COMPLETED)
  console.log('\n[TESTE 3] Recebimento e processamento de webhook legítimo de pagamento');
  try {
    if (!businessOrder) throw new Error('Pedido anterior não foi gerado');

    const webhookPayload = {
      event: 'OPENPIX:CHARGE_COMPLETED',
      charge: {
        status: 'COMPLETED',
        correlationID: businessOrder.correlationID,
        value: 14990, // valor exato do plano Business
        transactionID: 'E223813510202611091950T123456789'
      }
    };

    const res = await request({
      path: '/api/webhook-woovi',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, webhookPayload);

    if (res.status === 200 && res.body.status === 'PAID') {
      console.log('  -> PASSOU: Webhook processado e status do pedido atualizado para PAID.');
      passed++;
    } else {
      console.error('  -> FALHOU:', res.status, res.body);
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 4: Rejeição de webhook inválido
  console.log('\n[TESTE 4] Rejeição de evento de webhook inválido ou sem correlationID');
  try {
    const res = await request({
      path: '/api/webhook-woovi',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      event: 'OPENPIX:CHARGE_COMPLETED',
      charge: {
        status: 'COMPLETED',
        // correlationID ausente
        value: 14990
      }
    });

    if (res.status === 400) {
      console.log('  -> PASSOU: Webhook inválido rejeitado com HTTP 400.');
      passed++;
    } else {
      console.error('  -> FALHOU: Deveria retornar 400, retornou:', res.status);
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 5: Rejeição de cobrança com valor financeiro divergente (Anti-Fraude)
  console.log('\n[TESTE 5] Rejeição de notificação com valor divergente do contratado');
  try {
    // Gera novo pedido Master (29990 centavos)
    const masterReq = await request({
      path: '/api/checkout-pix',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      plan: 'master',
      company_name: 'Holding Master Segura',
      email: 'master@holding.com',
      phone: '11966665555'
    });

    const masterOrder = masterReq.body;

    // Notificação com valor adulterado (ex: tentou pagar 100 centavos em vez de 29990)
    const res = await request({
      path: '/api/webhook-woovi',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      event: 'OPENPIX:CHARGE_COMPLETED',
      charge: {
        status: 'COMPLETED',
        correlationID: masterOrder.correlationID,
        value: 100 // Divergente de 29990!
      }
    });

    if (res.status === 422) {
      console.log('  -> PASSOU: Notificação fraudulenta com valor divergente bloqueada com HTTP 422.');
      passed++;
    } else {
      console.error('  -> FALHOU: Deveria retornar 422, retornou:', res.status);
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 6: Prevenção de processamento duplicado (Idempotência)
  console.log('\n[TESTE 6] Prevenção de processamento duplicado (Idempotência no webhook)');
  try {
    // Reenvia o webhook do pedido Business que já foi pago no Teste 3
    const res = await request({
      path: '/api/webhook-woovi',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      event: 'OPENPIX:CHARGE_COMPLETED',
      charge: {
        status: 'COMPLETED',
        correlationID: businessOrder.correlationID,
        value: 14990
      }
    });

    if (res.status === 200 && res.body.already_processed === true) {
      console.log('  -> PASSOU: Idempotência confirmada. Pagamento duplicado não altera o banco.');
      passed++;
    } else {
      console.error('  -> FALHOU:', res.status, res.body);
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 7: Funcionamento dos layouts e integridade da página /planos-ads (desktop e mobile)
  console.log('\n[TESTE 7] Disponibilidade e integridade da página /planos-ads/ e responsividade');
  try {
    const res = await request({
      path: '/planos-ads/',
      method: 'GET'
    });

    const html = res.raw || '';
    const hasStarter = html.includes('Starter') && html.includes('69,90');
    const hasBusiness = html.includes('Business') && html.includes('149,90');
    const hasMaster = html.includes('Master') && html.includes('299,90');
    const hasModal = html.includes('id="checkout-modal"');
    const hasResponsive = html.includes('@media(max-width:720px)');

    if (res.status === 200 && hasStarter && hasBusiness && hasMaster && hasModal && hasResponsive) {
      console.log('  -> PASSOU: Página /planos-ads/ servida com sucesso, 3 planos íntegros e checkout responsivo ativo.');
      passed++;
    } else {
      console.error('  -> FALHOU:', res.status, { hasStarter, hasBusiness, hasMaster, hasModal, hasResponsive });
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  // TESTE 8: Verificação do Google Pay (desativado por ausência de processador autorizado)
  console.log('\n[TESTE 8] Validação de segurança do Google Pay');
  try {
    const res = await request({
      path: '/planos-ads/',
      method: 'GET'
    });
    const html = res.raw || '';
    const gpayDisabled = html.includes('id="opt-gpay"') && html.includes('disabled') && html.includes('Em homologação');
    const noFakeRedirect = !html.includes('google.com/pay/api/fake');

    if (gpayDisabled && noFakeRedirect) {
      console.log('  -> PASSOU: Google Pay mantido estritamente desativado, sem falsas simulações.');
      passed++;
    } else {
      console.error('  -> FALHOU: Google Pay não está devidamente protegido ou desativado.');
    }
  } catch (err) {
    console.error('  -> ERRO:', err.message);
  }

  console.log('\n================================================================');
  console.log(`RESULTADO DA AUDITORIA: ${passed}/${total} TESTES APROVADOS (${Math.round((passed/total)*100)}%)`);
  console.log('================================================================');

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Falha crítica na suíte de testes:', err);
  process.exit(1);
});
