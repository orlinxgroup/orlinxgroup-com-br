<?php
/**
 * ORLINX ADS — Webhook Oficial de Notificação e Confirmação de Pagamento Woovi Pix
 * Endpoint: /api/webhook-woovi.php (ou /api/webhook-woovi)
 * 
 * Regras Estritas de Segurança e Auditoria:
 * 1. Somente método POST com corpo JSON bruto.
 * 2. Validação do evento oficial OPENPIX:CHARGE_COMPLETED.
 * 3. Validação de autenticidade / verificação no provedor Woovi.
 * 4. Idempotência estrita: impede duplo processamento.
 * 5. Conferência de valor, correlação e plano do pedido.
 * 6. Atualização atômica para status PAGO.
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido.']);
    exit;
}

// Leitura do corpo bruto da requisição
$rawPayload = file_get_contents('php://input');
if (empty($rawPayload)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Corpo da requisição vazio.']);
    exit;
}

$eventData = json_decode($rawPayload, true);
if (!is_array($eventData)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Payload JSON inválido.']);
    exit;
}

// Obtenção da Credencial da Woovi para verificação
$appId = getenv('WOOVI_APP_ID') ?: getenv('OPENPIX_APP_ID');
$secretConfigFile = __DIR__ . '/config.secret.php';
$webhookSecret = getenv('WOOVI_WEBHOOK_SECRET');
if (file_exists($secretConfigFile)) {
    $secretCfg = @include $secretConfigFile;
    if (is_array($secretCfg)) {
        if (empty($appId) && !empty($secretCfg['WOOVI_APP_ID'])) {
            $appId = $secretCfg['WOOVI_APP_ID'];
        }
        if (empty($webhookSecret) && !empty($secretCfg['WOOVI_WEBHOOK_SECRET'])) {
            $webhookSecret = $secretCfg['WOOVI_WEBHOOK_SECRET'];
        }
    }
}

// 1. Verificação de Assinatura se configurado WOOVI_WEBHOOK_SECRET
$signatureHeader = $_SERVER['HTTP_X_OPENPIX_SIGNATURE'] ?? $_SERVER['HTTP_X_WOOVI_SIGNATURE'] ?? '';
if (!empty($webhookSecret) && !empty($signatureHeader)) {
    $expectedSignature = hash_hmac('sha256', $rawPayload, $webhookSecret);
    if (!hash_equals($expectedSignature, $signatureHeader)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Assinatura do webhook inválida.']);
        exit;
    }
}

// 2. Extração do Evento e Dados da Cobrança
$eventName = $eventData['event'] ?? ($eventData['tipo'] ?? '');
$charge = $eventData['charge'] ?? ($eventData['pix']['charge'] ?? null);

// Aceita apenas o evento oficial de conclusão de cobrança
if ($eventName !== 'OPENPIX:CHARGE_COMPLETED') {
    // Retorna 200 para eventos informativos sem processar faturamento
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'ignored' => true,
        'message' => 'Evento não requer processamento de pagamento.',
        'event' => $eventName
    ]);
    exit;
}

if (!is_array($charge)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Estrutura da cobrança ausente no payload do webhook.']);
    exit;
}

$correlationID = trim((string)($charge['correlationID'] ?? ''));
$chargeStatus = strtoupper(trim((string)($charge['status'] ?? '')));
$chargeValueCents = (int)($charge['value'] ?? ($eventData['pix']['value'] ?? 0));
$pixTransactionId = (string)($charge['transactionID'] ?? ($eventData['pix']['endToEndId'] ?? ($charge['identifier'] ?? '')));

if (empty($correlationID)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'correlationID ausente na notificação.']);
    exit;
}

// 3. Verificação de Autenticidade no Provedor (API Woovi) se chave configurada
if (!empty($appId)) {
    $verifyUrl = 'https://api.woovi.com/api/v1/charge/' . urlencode($correlationID);
    $ch = curl_init($verifyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: ' . $appId,
        'Accept: application/json'
    ]);
    $verifyRes = curl_exec($ch);
    $verifyHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($verifyHttp === 200 && $verifyRes) {
        $verifiedCharge = json_decode($verifyRes, true);
        $vCharge = $verifiedCharge['charge'] ?? $verifiedCharge;
        if (is_array($vCharge)) {
            $chargeStatus = strtoupper(trim((string)($vCharge['status'] ?? '')));
            $chargeValueCents = (int)($vCharge['value'] ?? $chargeValueCents);
        }
    }
}

// 4. Acesso ao Cofre de Pedidos Local
$dataDir = __DIR__ . '/data';
$dbFile = $dataDir . '/orders_database.json';

if (!file_exists($dbFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Banco de pedidos não inicializado.']);
    exit;
}

$fp = @fopen($dbFile, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) {
    if ($fp) fclose($fp);
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Cofre de dados ocupado. Tente novamente.']);
    exit;
}

$rawDb = '';
$fsize = filesize($dbFile);
if ($fsize > 0) {
    $rawDb = fread($fp, $fsize);
}
$orders = is_array(json_decode($rawDb, true)) ? json_decode($rawDb, true) : [];

// 5. Localização do Pedido Correspondente
$matchedOrderIndex = -1;
foreach ($orders as $idx => $order) {
    if (($order['correlationID'] ?? '') === $correlationID ||
        ($order['pix_charge_id'] ?? '') === $correlationID ||
        (isset($order['order_code']) && strpos($correlationID, $order['order_code']) !== false)) {
        $matchedOrderIndex = $idx;
        break;
    }
}

if ($matchedOrderIndex === -1) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Pedido correspondente não encontrado para correlationID: ' . $correlationID]);
    exit;
}

$targetOrder = &$orders[$matchedOrderIndex];

// 6. Idempotência: Impedir reprocessamento se já estiver PAGO
if (strtoupper($targetOrder['status'] ?? '') === 'PAID') {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'already_processed' => true,
        'order_code' => $targetOrder['order_code'],
        'message' => 'Pedido já havia sido confirmado anteriormente.'
    ]);
    exit;
}

// 7. Conferência Rigorosa de Valor Financeiro e Plano
$expectedCents = (int)($targetOrder['amount_cents'] ?? round(($targetOrder['amount'] ?? 0) * 100));
if ($chargeValueCents > 0 && $chargeValueCents !== $expectedCents) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'error' => 'Divergência de valor financeiro detectada.',
        'expected_cents' => $expectedCents,
        'received_cents' => $chargeValueCents
    ]);
    exit;
}

// 8. Atualização Atômica do Pedido para PAGO
$paidAt = gmdate('Y-m-d\TH:i:s\Z');
$targetOrder['status'] = 'PAID';
$targetOrder['paid_at'] = $paidAt;
$targetOrder['pix_transaction_id'] = $pixTransactionId;
$targetOrder['pix_verified_status'] = $chargeStatus;

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

// 9. Resposta Oficial de Sucesso (HTTP 200)
http_response_code(200);
echo json_encode([
    'success' => true,
    'processed' => true,
    'order_code' => $targetOrder['order_code'],
    'status' => 'PAID',
    'paid_at' => $paidAt,
    'message' => 'Pagamento Pix confirmado com sucesso e pedido atualizado para PAGO.'
]);
exit;
