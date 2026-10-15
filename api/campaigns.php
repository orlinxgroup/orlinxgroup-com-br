<?php
/**
 * ORLINX ADS - API Pública de Campanhas
 * Retorna as campanhas ativas em rotação oficial
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=60');

// CORS para domínios autorizados da rede ORLINX GROUP
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://www.orlinxgroup.com.br',
    'https://orlinxgroup.com.br',
    'http://localhost:3000'
];

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

// Catálogo de Campanhas Oficiais em Rotação
$campaigns = [
    [
        'id' => 'camp-tessari-verao',
        'campaign_code' => 'CAMP-TESSARI-01',
        'client_name' => 'Tessari Malhas',
        'title' => 'Elegância que acompanha o verão',
        'category' => 'Moda Praia e Piscina',
        'description' => 'Descubra saias, shorts, vestidos e calças em tricô para momentos de sol com sofisticação e estilo.',
        'slot' => 'feed-billboard',
        'banner_url' => '/assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg',
        'target_url' => 'https://www.tessarimalhas.com.br',
        'cta_text' => 'Conheça a Coleção',
        'status' => 'active',
        'start_date' => '2026-10-15',
        'end_date' => '2027-10-15',
        'impressions' => 0,
        'clicks' => 0
    ],
    [
        'id' => 'orx-slot-topo',
        'campaign_code' => 'CAMP-INST-01',
        'client_name' => 'Espaço Disponível • ORLINX ADS',
        'title' => 'Posicione sua Empresa no Topo do Portal ORLINX GROUP',
        'category' => 'Mídia B2B',
        'slot' => 'top-leaderboard',
        'banner_url' => '',
        'target_url' => '/anuncie.html',
        'cta_text' => 'Anuncie Conosco',
        'status' => 'active',
        'start_date' => '2026-10-01',
        'end_date' => '2027-12-31',
        'impressions' => 0,
        'clicks' => 0
    ],
    [
        'id' => 'orx-slot-lateral',
        'campaign_code' => 'CAMP-INST-02',
        'client_name' => 'Vitrine de Anunciantes • ORLINX ADS',
        'title' => 'Destaque seus Serviços Corporativos para Líderes e Empresas',
        'category' => 'Vitrine Corporativa',
        'slot' => 'sidebar-box',
        'banner_url' => '',
        'target_url' => '/anuncie.html',
        'cta_text' => 'Ver Formatos',
        'status' => 'active',
        'start_date' => '2026-10-01',
        'end_date' => '2027-12-31',
        'impressions' => 0,
        'clicks' => 0
    ],
    [
        'id' => 'orx-slot-feed',
        'campaign_code' => 'CAMP-INST-03',
        'client_name' => 'ORLINX GROUP Institucional',
        'title' => 'Soluções Empresariais, Infraestrutura e Consultoria Estratégica',
        'category' => 'Institucional',
        'slot' => 'feed-billboard',
        'banner_url' => '',
        'target_url' => '/anuncie.html',
        'cta_text' => 'Conhecer a Rede',
        'status' => 'active',
        'start_date' => '2026-10-01',
        'end_date' => '2027-12-31',
        'impressions' => 0,
        'clicks' => 0
    ]
];

// Suporte a filtro por slot se requisitado: ?slot=feed-billboard
$slotFilter = trim($_GET['slot'] ?? '');
if (!empty($slotFilter)) {
    $campaigns = array_values(array_filter($campaigns, function ($c) use ($slotFilter) {
        return $c['slot'] === $slotFilter;
    }));
}

echo json_encode([
    'success' => true,
    'total' => count($campaigns),
    'campaigns' => $campaigns
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
