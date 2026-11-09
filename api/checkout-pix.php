<?php
/**
 * ORLINX ADS — Gateway Oficial de Cobrança Pix via Woovi
 * Endpoint: /api/checkout-pix.php (ou /api/checkout-pix)
 * 
 * Políticas de Segurança e Conformidade:
 * 1. Valores fixados no servidor em centavos (não aceita valor do cliente).
 * 2. Autenticação via WOOVI_APP_ID / OPENPIX_APP_ID em variável de ambiente.
 * 3. Rate limiting estrito por IP.
 * 4. Prevenção de duplicidade e duplo clique (idempotência).
 * 5. Sanitização estrita de entradas (LGPD/OWASP).
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-cache, no-store, must-revalidate');

// Validação de Origens Autorizadas (CORS)
$allowedDomains = [
    'www.orlinxgroup.com.br',
    'orlinxgroup.com.br'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isLocalDev = (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false);
$isAuthorizedOrigin = false;

if ($isLocalDev) {
    $isAuthorizedOrigin = true;
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    foreach ($allowedDomains as $domain) {
        if ($origin === "https://{$domain}") {
            $isAuthorizedOrigin = true;
            header("Access-Control-Allow-Origin: https://{$domain}");
            break;
        }
    }
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Utilize POST.']);
    exit;
}

// Catálogo Oficial com valores fixados exclusivamente no servidor (em centavos)
$PLAN_CATALOG = [
    'starter' => [
        'name' => 'Plano Starter',
        'amount_cents' => 6990,
        'slot' => 'sidebar-box',
        'duration_days' => 30,
        'description' => 'Banner na lateral do portal ORLINX por 30 dias'
    ],
    'business' => [
        'name' => 'Plano Business',
        'amount_cents' => 14990,
        'slot' => 'feed-billboard',
        'duration_days' => 30,
        'description' => 'Banner central em destaque no feed por 30 dias'
    ],
    'master' => [
        'name' => 'Plano Master',
        'amount_cents' => 29990,
        'slot' => 'top-leaderboard',
        'duration_days' => 30,
        'description' => 'Banner no topo do portal com destaque premium por 30 dias'
    ]
];

// Diretório de dados e cofre protegido
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0750, true);
}
$dataHtaccess = $dataDir . '/.htaccess';
if (!file_exists($dataHtaccess)) {
    @file_put_contents($dataHtaccess, "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Deny from all\n</IfModule>\n");
}
$dbFile = $dataDir . '/orders_database.json';

// Rate Limiting por IP (Máximo 10 requisições a cada 10 minutos por IP)
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
if (strpos($clientIp, ',') !== false) {
    $clientIp = trim(explode(',', $clientIp)[0]);
}

$lockDir = sys_get_temp_dir() . '/orx_checkout_locks';
if (!is_dir($lockDir)) {
    @mkdir($lockDir, 0700, true);
}

$rateFile = $lockDir . '/rate_' . md5($clientIp) . '.json';
$now = time();
$hits = file_exists($rateFile) ? (json_decode(@file_get_contents($rateFile), true) ?: []) : [];
$hits = array_filter($hits, function ($ts) use ($now) { return ($now - $ts) < 600; });
if (count($hits) >= 10) {
    http_response_code(429);
    echo json_encode([
        'success' => false,
        'error' => 'Limite de requisições excedido. Por favor, aguarde alguns minutos antes de gerar uma nova cobrança.'
    ]);
    exit;
}
$hits[] = $now;
@file_put_contents($rateFile, json_encode($hits));

// Leitura do Payload
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Payload JSON inválido.']);
    exit;
}

// Honeypot antispam
if (!empty($input['_hp_fax'])) {
    http_response_code(200);
    echo json_encode(['success' => false, 'error' => 'Requisição bloqueada por filtro antispam.']);
    exit;
}

// Sanitização e Validação dos Dados Cadastrais
$planKey = strtolower(trim((string)($input['plan'] ?? ($input['plan_key'] ?? ''))));
if (!isset($PLAN_CATALOG[$planKey])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Plano comercial inválido. Escolha entre Starter, Business ou Master.']);
    exit;
}
$plan = $PLAN_CATALOG[$planKey];

$companyName = trim((string)($input['company_name'] ?? ($input['name'] ?? '')));
if (mb_strlen($companyName) < 3) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Por favor, informe a Razão Social ou Nome com no mínimo 3 caracteres.']);
    exit;
}

$email = strtolower(trim((string)($input['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Por favor, informe um endereço de e-mail corporativo válido.']);
    exit;
}

$phone = trim((string)($input['phone'] ?? ''));
$cleanPhone = preg_replace('/\D/', '', $phone);
if (strlen($cleanPhone) < 10 || strlen($cleanPhone) > 13) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Por favor, informe um telefone/WhatsApp válido com DDD (mínimo 10 dígitos).']);
    exit;
}

$document = trim((string)($input['document'] ?? ($input['taxID'] ?? '')));
$cleanDoc = preg_replace('/\D/', '', $document);

// Prevenção de Duplo Clique / Idempotência (10 segundos)
$idemKey = md5($companyName . '|' . $email . '|' . $planKey);
$idemFile = $lockDir . '/idem_' . $idemKey . '.json';
if (file_exists($idemFile)) {
    $existing = json_decode(@file_get_contents($idemFile), true);
    if (is_array($existing) && ($now - ($existing['timestamp'] ?? 0)) < 10) {
        http_response_code(200);
        echo json_encode($existing['response']);
        exit;
    }
}

// Obtenção da Credencial da Woovi (OpenPix)
$appId = getenv('WOOVI_APP_ID') ?: getenv('OPENPIX_APP_ID');
$secretConfigFile = __DIR__ . '/config.secret.php';
if (empty($appId) && file_exists($secretConfigFile)) {
    $secretCfg = @include $secretConfigFile;
    if (is_array($secretCfg) && !empty($secretCfg['WOOVI_APP_ID'])) {
        $appId = $secretCfg['WOOVI_APP_ID'];
    }
}

// Bloqueio de Segurança Obrigatório: Se credencial ausente, interrompe e informa pendência sem vazar dados
if (empty($appId)) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'code' => 'WOOVI_CREDENTIALS_MISSING',
        'error' => 'A integração de cobrança Pix direta está temporariamente indisponível no servidor.',
        'detail' => 'Configuração pendente: Variável de ambiente WOOVI_APP_ID não configurada no servidor.',
        'commercial_action' => 'Por favor, solicite a contratação através do atendimento comercial ou aguarde a homologação da chave.',
        'commercial_email' => 'comercial@orlinxgroup.com.br'
    ]);
    exit;
}

// Geração de Identificador Único do Pedido e CorrelationID
$orderCode = 'ORX-' . mt_rand(100000, 999999);
$correlationID = 'ORX_PIX_' . $orderCode . '_' . bin2hex(random_bytes(4));

// Montagem do Payload para a API da Woovi
// O VALOR É DEFINIDO EXCLUSIVAMENTE NO SERVIDOR EM CENTAVOS
$wooviPayload = [
    'correlationID' => $correlationID,
    'value' => (int)$plan['amount_cents'],
    'comment' => 'ORLINX ADS - ' . $plan['name'] . ' [' . $orderCode . ']',
    'customer' => [
        'name' => $companyName,
        'email' => $email,
        'phone' => $cleanPhone
    ]
];

if (!empty($cleanDoc) && (strlen($cleanDoc) === 11 || strlen($cleanDoc) === 14)) {
    $wooviPayload['customer']['taxID'] = $cleanDoc;
}

// Chamada à API Oficial da Woovi (OpenPix)
$wooviEndpoint = 'https://api.woovi.com/api/v1/charge';
$ch = curl_init($wooviEndpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($wooviPayload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json; charset=UTF-8',
    'Authorization: ' . $appId,
    'User-Agent: ORLINX-ADS-Gateway/1.0'
]);

$responseBody = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($responseBody === false || !empty($curlError)) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => 'Falha de comunicação segura com a instituição financeira processadora do Pix.',
        'detail' => $curlError ?: 'Tempo limite de resposta excedido'
    ]);
    exit;
}

$wooviResponse = json_decode($responseBody, true);

if ($httpStatus < 200 || $httpStatus >= 300 || !is_array($wooviResponse)) {
    http_response_code(502);
    $errorMessage = $wooviResponse['error'] ?? ($wooviResponse['message'] ?? 'Erro desconhecido retornado pela API Pix.');
    echo json_encode([
        'success' => false,
        'error' => 'A instituição financeira não autorizou a criação da cobrança Pix.',
        'detail' => $errorMessage
    ]);
    exit;
}

$chargeData = $wooviResponse['charge'] ?? $wooviResponse;
$brCode = $chargeData['brCode'] ?? ($wooviResponse['brCode'] ?? '');
$qrCodeImage = $chargeData['qrCodeImage'] ?? ($wooviResponse['qrCodeImage'] ?? '');
$pixChargeId = $chargeData['identifier'] ?? ($chargeData['correlationID'] ?? $correlationID);
$expiresAt = gmdate('Y-m-d\TH:i:s\Z', time() + 86400); // 24h

// Registro Persistente do Pedido no Cofre Local
$createdAt = gmdate('Y-m-d\TH:i:s\Z');
$newOrder = [
    'order_code' => $orderCode,
    'orderId' => $orderCode,
    'correlationID' => $correlationID,
    'pix_charge_id' => $pixChargeId,
    'company_name' => htmlspecialchars($companyName, ENT_QUOTES, 'UTF-8'),
    'email' => htmlspecialchars($email, ENT_QUOTES, 'UTF-8'),
    'phone' => htmlspecialchars($phone, ENT_QUOTES, 'UTF-8'),
    'document' => htmlspecialchars($document, ENT_QUOTES, 'UTF-8'),
    'plan_key' => $planKey,
    'plan_name' => $plan['name'],
    'amount_cents' => (int)$plan['amount_cents'],
    'amount' => round($plan['amount_cents'] / 100, 2),
    'slot' => $plan['slot'],
    'status' => 'PENDING_PAYMENT',
    'payment_method' => 'PIX_WOOVI',
    'br_code' => $brCode,
    'qr_code_image' => $qrCodeImage,
    'expires_at' => $expiresAt,
    'created_at' => $createdAt,
    'paid_at' => null
];

// Gravação segura no arquivo de pedidos
$fp = @fopen($dbFile, 'c+');
if ($fp) {
    if (flock($fp, LOCK_EX)) {
        $content = '';
        $fsize = filesize($dbFile);
        if ($fsize > 0) {
            $content = fread($fp, $fsize);
        }
        $orders = is_array(json_decode($content, true)) ? json_decode($content, true) : [];
        $orders[] = $newOrder;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

// Resposta Oficial ao Cliente (Sem expor segredos nem URLs privadas)
$clientResponse = [
    'success' => true,
    'order_code' => $orderCode,
    'correlationID' => $correlationID,
    'plan_name' => $plan['name'],
    'amount_cents' => (int)$plan['amount_cents'],
    'amount' => round($plan['amount_cents'] / 100, 2),
    'amount_formatted' => 'R$ ' . number_format($plan['amount_cents'] / 100, 2, ',', '.'),
    'brCode' => $brCode,
    'qrCodeImage' => $qrCodeImage,
    'status' => 'PENDING_PAYMENT',
    'expires_at' => $expiresAt
];

// Salva lock de idempotência
@file_put_contents($idemFile, json_encode([
    'timestamp' => $now,
    'response' => $clientResponse
]));

http_response_code(201);
echo json_encode($clientResponse);
exit;
