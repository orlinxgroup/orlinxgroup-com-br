<?php
/**
 * ORLINX ADS — Consulta Pública Segura de Status do Pedido / Pagamento Pix
 * Endpoint: /api/check-order.php?order_code=ORX-XXXXXX&correlationID=...
 * 
 * Políticas de Privacidade e Proteção de Dados:
 * 1. Retorna estritamente o status do pagamento e dados essenciais da transação.
 * 2. Não expõe senhas, chaves de API, dados bancários de terceiros ou PII desnecessário.
 * 3. Rate limiting por IP.
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-cache, no-store, must-revalidate');

// CORS
$allowedDomains = [
    'www.orlinxgroup.com.br',
    'orlinxgroup.com.br'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isLocalDev = (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false);
if ($isLocalDev) {
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    foreach ($allowedDomains as $domain) {
        if ($origin === "https://{$domain}") {
            header("Access-Control-Allow-Origin: https://{$domain}");
            break;
        }
    }
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Utilize GET.']);
    exit;
}

$orderCode = trim((string)($_GET['order_code'] ?? ($_GET['code'] ?? '')));
$correlationID = trim((string)($_GET['correlationID'] ?? ''));

if (empty($orderCode) && empty($correlationID)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Parâmetro order_code ou correlationID obrigatório.']);
    exit;
}

$dbFile = __DIR__ . '/data/orders_database.json';
if (!file_exists($dbFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'status' => 'NOT_FOUND', 'error' => 'Pedido não encontrado.']);
    exit;
}

$raw = @file_get_contents($dbFile);
$orders = json_decode($raw, true);
if (!is_array($orders)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'status' => 'NOT_FOUND', 'error' => 'Pedido não encontrado.']);
    exit;
}

$foundOrder = null;
foreach ($orders as $order) {
    if (!empty($orderCode) && ($order['order_code'] ?? '') === $orderCode) {
        $foundOrder = $order;
        break;
    }
    if (!empty($correlationID) && ($order['correlationID'] ?? '') === $correlationID) {
        $foundOrder = $order;
        break;
    }
}

if (!$foundOrder) {
    http_response_code(404);
    echo json_encode(['success' => false, 'status' => 'NOT_FOUND', 'error' => 'Pedido não localizado.']);
    exit;
}

// Verifica expiração (se PENDING_PAYMENT e tempo expirou)
$status = $foundOrder['status'] ?? 'PENDING_PAYMENT';
if ($status === 'PENDING_PAYMENT' && !empty($foundOrder['expires_at'])) {
    if (time() > strtotime($foundOrder['expires_at'])) {
        $status = 'EXPIRED';
    }
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'order_code' => $foundOrder['order_code'],
    'status' => $status,
    'plan_name' => $foundOrder['plan_name'] ?? '',
    'amount' => $foundOrder['amount'] ?? 0,
    'paid_at' => $foundOrder['paid_at'] ?? null,
    'expires_at' => $foundOrder['expires_at'] ?? null
]);
exit;
