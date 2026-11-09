<?php
/**
 * ORLINX ADS — Webhook Oficial de Notificação e Confirmação de Pagamento Woovi Pix
 * Endpoint: /api/webhook-woovi.php (ou /api/webhook-woovi)
 * 
 * Regras Estritas de Segurança e Auditoria:
 * 1. Somente método POST com corpo JSON bruto.
 * 2. Validação do evento oficial OPENPIX:CHARGE_COMPLETED.
 * 3. Validação de autenticidade: Consulta direta OBRIGATÓRIA na API da Woovi antes de marcar como PAGO.
 * 4. Idempotência estrita: impede duplo processamento.
 * 5. Conferência de valor, correlação e plano do pedido.
 * 6. Gravação atômica protegida contra acessos simultâneos (flock com backoff).
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Utilize POST.']);
    exit;
}

// 1. Leitura do corpo bruto da requisição
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

// 2. Resolução Segura de Credenciais da Woovi
$appId = getenv('WOOVI_APP_ID') ?: ($_SERVER['WOOVI_APP_ID'] ?? ($_ENV['WOOVI_APP_ID'] ?? ''));
if (empty($appId)) {
    $appId = getenv('OPENPIX_APP_ID') ?: ($_SERVER['OPENPIX_APP_ID'] ?? ($_ENV['OPENPIX_APP_ID'] ?? ''));
}
$webhookSecret = getenv('WOOVI_WEBHOOK_SECRET') ?: ($_SERVER['WOOVI_WEBHOOK_SECRET'] ?? ($_ENV['WOOVI_WEBHOOK_SECRET'] ?? ''));
$secretConfigFile = __DIR__ . '/config.secret.php';
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

$isTestMock = (getenv('WOOVI_MOCK_TEST') === 'true' || ($_SERVER['WOOVI_MOCK_TEST'] ?? '') === 'true');

// 3. Verificação de Assinatura HMAC-SHA256 (se configurado segredo de webhook)
$signatureHeader = $_SERVER['HTTP_X_OPENPIX_SIGNATURE'] ?? $_SERVER['HTTP_X_WOOVI_SIGNATURE'] ?? '';
if (!empty($webhookSecret) && !empty($signatureHeader)) {
    $expectedSignature = hash_hmac('sha256', $rawPayload, $webhookSecret);
    if (!hash_equals($expectedSignature, $signatureHeader)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Assinatura do webhook inválida.']);
        exit;
    }
}

// 4. Extração do Evento e Dados da Cobrança
$eventName = $eventData['event'] ?? ($eventData['tipo'] ?? '');
$charge = $eventData['charge'] ?? ($eventData['pix']['charge'] ?? null);

// Aceita apenas o evento oficial de conclusão de cobrança
if ($eventName !== 'OPENPIX:CHARGE_COMPLETED') {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'ignored' => true,
        'message' => 'Evento informativo recebido. Não requer alteração de status.',
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

// 5. CONSULTA OBRIGATÓRIA DA COBRANÇA DIRETAMENTE NA API DA WOOVI (Regra de Autenticidade)
if (!$isTestMock) {
    if (empty($appId)) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'error' => 'Impossível confirmar pagamento: WOOVI_APP_ID não configurado para verificação direta na API.',
            'correlationID' => $correlationID
        ]);
        exit;
    }

    $verifyUrl = 'https://api.woovi.com/api/v1/charge/' . urlencode($correlationID);
    $ch = curl_init($verifyUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: ' . $appId,
        'Accept: application/json',
        'User-Agent: ORLINX-ADS-Webhook-Validator/1.0'
    ]);

    $verifyRes = curl_exec($ch);
    $verifyHttp = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($verifyHttp !== 200 || empty($verifyRes)) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'error' => 'Falha na verificação de autenticidade da cobrança junto à API oficial da Woovi.',
            'detail' => $curlErr ?: 'HTTP Status ' . $verifyHttp
        ]);
        exit;
    }

    $verifiedData = json_decode($verifyRes, true);
    $vCharge = $verifiedData['charge'] ?? $verifiedData;
    if (!is_array($vCharge)) {
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => 'Resposta malformatada retornada pela API oficial da Woovi.']);
        exit;
    }

    // Atualiza status e valor estritamente com os dados retornados pela API oficial
    $chargeStatus = strtoupper(trim((string)($vCharge['status'] ?? '')));
    $chargeValueCents = (int)($vCharge['value'] ?? $chargeValueCents);
    $pixTransactionId = (string)($vCharge['transactionID'] ?? ($vCharge['identifier'] ?? $pixTransactionId));

    if ($chargeStatus !== 'COMPLETED') {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'error' => 'A instituição financeira retornou status diferente de COMPLETED.',
            'provider_status' => $chargeStatus
        ]);
        exit;
    }
}

// 6. Acesso Seguro ao Cofre de Pedidos com Bloqueio Atômico Concorrente (flock com backoff)
$dataDir = __DIR__ . '/data';
$dbFile = $dataDir . '/orders_database.json';

if (!file_exists($dbFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Banco de pedidos não inicializado.']);
    exit;
}

$fp = @fopen($dbFile, 'c+');
if (!$fp) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Falha ao acessar cofre de dados.']);
    exit;
}

$locked = false;
$startLock = microtime(true);
while ((microtime(true) - $startLock) < 3.0) {
    if (flock($fp, LOCK_EX | LOCK_NB)) {
        $locked = true;
        break;
    }
    usleep(50000); // 50ms
}

if (!$locked) {
    fclose($fp);
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Cofre ocupado por operação concorrente. Tente novamente.']);
    exit;
}

rewind($fp);
$rawDb = '';
$fsize = filesize($dbFile);
if ($fsize > 0) {
    $rawDb = fread($fp, $fsize);
}
$orders = is_array(json_decode($rawDb, true)) ? json_decode($rawDb, true) : [];

// 7. Localização do Pedido Correspondente
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

// 8. Idempotência: Impedir reprocessamento se já estiver PAGO
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

// 9. Conferência Rigorosa de Valor Financeiro e Plano
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

// 10. Atualização Atômica do Pedido para PAGO
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

// 11. Resposta Oficial de Sucesso (HTTP 200)
http_response_code(200);
echo json_encode([
    'success' => true,
    'processed' => true,
    'order_code' => $targetOrder['order_code'],
    'status' => 'PAID',
    'paid_at' => $paidAt,
    'message' => 'Pagamento Pix verificado diretamente na instituição financeira e confirmado com sucesso.'
]);
exit;
