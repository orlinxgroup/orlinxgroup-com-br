<?php
/**
 * ORLINX GROUP & ORLINX ADS — Despachante Seguro de Notificações de Briefing
 * Endpoint: /api/notify-briefing.php
 * 
 * Responsabilidade:
 * 1. Validar e sanitizar a submissão do formulário de Briefing Digital.
 * 2. Bloquear spam via honeypot e validação estrita de formato de protocolo.
 * 3. Prevenir disparos duplicados para o mesmo protocolo.
 * 4. Despachar notificação executiva multipart (Plain-Text + HTML) para comercial@orlinxgroup.com.br.
 * 5. Responder com confirmação estruturada em JSON (sem expor credenciais sensíveis).
 */

// Headers de segurança e resposta JSON
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-cache, no-store, must-revalidate');

// Tratamento de CORS seguro
$allowedOrigins = [
    'https://www.orlinxgroup.com.br',
    'https://orlinxgroup.com.br',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

// Resposta para pre-flight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Aceita exclusivamente POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Metodo nao permitido. Utilize POST.'
    ]);
    exit;
}

// Leitura do payload JSON
$rawPayload = file_get_contents('php://input');
$data = json_decode($rawPayload, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Payload JSON invalido ou malformatado.'
    ]);
    exit;
}

// 1. Filtro Anti-Spam (Honeypot)
if (!empty($data['_hp_briefing_corp_catch'])) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'error' => 'Submissao bloqueada por politicas de seguranca antispam.'
    ]);
    exit;
}

// 2. Validação do Código de Protocolo
$protocol = isset($data['protocol_code']) ? trim($data['protocol_code']) : '';
if (!preg_match('/^BRF-\d{4}-\d{5,8}$/', $protocol)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Formato de protocolo invalido.'
    ]);
    exit;
}

// 3. Validação dos Campos Obrigatórios
$companyName = isset($data['company_name']) ? trim($data['company_name']) : '';
$contactName = isset($data['contact_name']) ? trim($data['contact_name']) : '';
$email       = isset($data['email']) ? trim($data['email']) : '';
$phone       = isset($data['phone']) ? trim($data['phone']) : '';

if (mb_strlen($companyName) < 2 || mb_strlen($contactName) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Campos obrigatorios invalidos (empresa, responsavel ou e-mail corporativo).'
    ]);
    exit;
}

// 4. Mecanismo Anti-Duplicação (Lock de protocolo)
$lockDir = sys_get_temp_dir() . '/orx_briefings';
if (!is_dir($lockDir)) {
    @mkdir($lockDir, 0700, true);
}
$lockFile = $lockDir . '/lock_' . md5($protocol) . '.json';

if (file_exists($lockFile)) {
    $existing = json_decode(@file_get_contents($lockFile), true);
    if (is_array($existing) && !empty($existing['dispatched_at'])) {
        // Já despachado com sucesso recentemente
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'protocol' => $protocol,
            'duplicate' => true,
            'message' => 'Notificacao ja enviada com sucesso anteriormente para este protocolo.'
        ]);
        exit;
    }
}

// 5. Sanitização de Valores para Composição do E-mail
function sanitizeText($val, $default = 'Não informado') {
    if (is_array($val)) {
        return htmlspecialchars(implode(', ', array_map('trim', $val)), ENT_QUOTES, 'UTF-8');
    }
    $trimmed = trim((string)$val);
    return $trimmed !== '' ? htmlspecialchars($trimmed, ENT_QUOTES, 'UTF-8') : $default;
}

$safeCompany        = sanitizeText($companyName);
$safeTrading        = sanitizeText($data['trading_name'] ?? '');
$safeDoc            = sanitizeText($data['document_number'] ?? '');
$safeContact        = sanitizeText($contactName);
$safeEmail          = sanitizeText($email);
$safePhone          = sanitizeText($phone);
$safeCityState      = sanitizeText($data['city_state'] ?? '');
$safeSegment        = sanitizeText($data['business_segment'] ?? '');
$safeProjectType    = sanitizeText($data['project_type'] ?? 'institucional');
$safePrimaryGoal    = sanitizeText($data['primary_goal'] ?? '');
$safeAudience       = sanitizeText($data['target_audience'] ?? '');
$safeSummaryRaw     = trim((string)($data['project_summary'] ?? ''));
$safeSummary        = nl2br(sanitizeText($safeSummaryRaw));
$safeReqRaw         = trim((string)($data['special_requirements'] ?? ''));
$safeRequirements   = nl2br(sanitizeText($safeReqRaw));
$safeBrandStatus    = sanitizeText($data['brand_status'] ?? '');
$safeDesignStyle    = sanitizeText($data['design_style'] ?? '');
$safeDislikedRaw    = trim((string)($data['disliked_elements'] ?? ''));
$safeDisliked       = nl2br(sanitizeText($safeDislikedRaw));
$safeDomainStatus   = sanitizeText($data['domain_status'] ?? '');
$safeDomainName     = sanitizeText($data['domain_name'] ?? '');
$safeHosting        = sanitizeText($data['hosting_preference'] ?? '');
$safeCorporateMails = (int)($data['corporate_emails_needed'] ?? 0);
$safeInvestment     = sanitizeText($data['investment_bracket'] ?? 'A definir');
$safeLaunchDate     = sanitizeText($data['target_launch_date'] ?? 'A definir');

// Páginas e Funcionalidades
$safePages = is_array($data['required_pages'] ?? null) 
    ? implode(', ', array_map('htmlspecialchars', $data['required_pages'])) 
    : 'Padrão institucional';

$safeFeatures = is_array($data['custom_features'] ?? null) 
    ? implode(', ', array_map('htmlspecialchars', $data['custom_features'])) 
    : 'Nenhum recurso extra solicitado';

$safeLanguages = is_array($data['languages'] ?? null)
    ? implode(', ', array_map('htmlspecialchars', $data['languages']))
    : 'pt-BR';

// Módulo ORLINX ADS
$adsOptIn = !empty($data['ads_opt_in']) && ($data['ads_opt_in'] === true || $data['ads_opt_in'] === 'true');
$safeAdsFormat = sanitizeText($data['ads_format'] ?? 'N/A');
$safeAdsPeriod = sanitizeText($data['ads_period_days'] ?? 'N/A');
$safeAdsBudget = sanitizeText($data['ads_budget_range'] ?? 'N/A');
$safeAdsUrl    = sanitizeText($data['ads_target_url'] ?? 'N/A');

// Paleta de Cores
$colorPalette = $data['color_palette'] ?? [];
$safeColorPrimary = sanitizeText($colorPalette['primary'] ?? '#080E1E');
$safeColorSecondary = sanitizeText($colorPalette['secondary'] ?? '#2E1F1A');
$safeColorAccent = sanitizeText($colorPalette['accent'] ?? '#D4AF37');
$safeColorAvoid = sanitizeText($colorPalette['avoid'] ?? 'Nenhum');

// Arquivos Anexados
$uploadedFiles = $data['uploaded_files'] ?? ($data['files'] ?? []);
$filesHtmlList = '';
$filesTextList = '';
if (is_array($uploadedFiles) && count($uploadedFiles) > 0) {
    $filesHtmlList .= '<ul style="margin: 0; padding-left: 20px; color: #D3CBC3;">';
    foreach ($uploadedFiles as $f) {
        $name = htmlspecialchars($f['originalName'] ?? $f['name'] ?? 'Arquivo', ENT_QUOTES, 'UTF-8');
        $cat  = htmlspecialchars($f['category'] ?? 'Geral', ENT_QUOTES, 'UTF-8');
        $filesHtmlList .= "<li style='margin-bottom: 4px;'><strong style='color: #FDFBF7;'>{$name}</strong> — Categoria: {$cat} (Cofre Privado Supabase)</li>";
        $filesTextList .= " - {$name} (Categoria: {$cat})\n";
    }
    $filesHtmlList .= '</ul>';
} else {
    $filesHtmlList = '<p style="margin: 0; color: #A6A099; font-style: italic;">Nenhum arquivo anexado pelo cliente nesta etapa.</p>';
    $filesTextList = "Nenhum arquivo anexado nesta etapa.\n";
}

$submissionDate = gmdate('d/m/Y \à\s H:i:s') . ' UTC';
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'Desconhecido';

// 6. Template Plain-Text (Garante que filtros antispam não penalizem MIME_HTML_ONLY)
$plainText = <<<TXT
================================================================================
ORLINX GROUP & ORLINX ADS — NOVO BRIEFING EXECUTIVO PROTOCOLADO
================================================================================

Protocolo Oficial: {$protocol}
Data do Registro:  {$submissionDate}
IP de Origem:      {$clientIp}

1. IDENTIFICAÇÃO CORPORATIVA & CONTATO
--------------------------------------------------------------------------------
Razão Social:         {$safeCompany}
Nome Fantasia:        {$safeTrading}
CNPJ / CPF:           {$safeDoc}
Responsável:          {$safeContact}
E-mail:               {$safeEmail}
Telefone / WhatsApp:  {$safePhone}
Cidade / Estado:      {$safeCityState}
Segmento de Mercado:  {$safeSegment}

2. ESCOPO DO PROJETO & OBJETIVOS
--------------------------------------------------------------------------------
Tipo de Website:      {$safeProjectType}
Objetivo Principal:   {$safePrimaryGoal}
Público-Alvo:         {$safeAudience}
Resumo do Projeto:    {$safeSummaryRaw}

3. PÁGINAS & RECURSOS TÉCNICOS
--------------------------------------------------------------------------------
Páginas Requeridas:   {$safePages}
Recursos Especiais:   {$safeFeatures}
Idiomas:              {$safeLanguages}
Sistemas / APIs:      {$safeReqRaw}
O que NÃO quer:       {$safeDislikedRaw}

4. IDENTIDADE VISUAL & DESIGN
--------------------------------------------------------------------------------
Situação da Marca:    {$safeBrandStatus}
Estilo Visual:        {$safeDesignStyle}
Paleta de Cores:      Primária: {$safeColorPrimary} | Secundária: {$safeColorSecondary} | Destaque: {$safeColorAccent}

5. INFRAESTRUTURA & HOSPEDAGEM
--------------------------------------------------------------------------------
Status do Domínio:    {$safeDomainStatus}
Endereço Pretendido:  {$safeDomainName}
Hospedagem:           {$safeHosting}
Caixas Postais:       {$safeCorporateMails} conta(s) de e-mail

6. MÓDULO ORLINX ADS (PUBLICIDADE)
--------------------------------------------------------------------------------
TXT;

if ($adsOptIn) {
    $plainText .= <<<TXT

Opção Ativada:        SIM (Campanha Publicitária Inclusa)
Formato Desejado:     {$safeAdsFormat}
Período de Veiculação:{$safeAdsPeriod} dias
Orçamento de Mídia:   {$safeAdsBudget}
URL de Destino:       {$safeAdsUrl}
TXT;
} else {
    $plainText .= <<<TXT

Opção Ativada:        NÃO (Apenas Desenvolvimento Web)
TXT;
}

$plainText .= <<<TXT


7. INVESTIMENTO & PRAZOS
--------------------------------------------------------------------------------
Faixa de Investimento:{$safeInvestment}
Previsão Lançamento:  {$safeLaunchDate}

8. ARQUIVOS ANEXADOS NO COFRE SEGURO
--------------------------------------------------------------------------------
{$filesTextList}
================================================================================
Briefing registrado e persistido com sucesso no Supabase (ulajrvkaqqedwuaiaksp).
ORLINX ADS & Web Platform — https://www.orlinxgroup.com.br
TXT;

// 7. Template HTML Executivo (Identidade Visual Dark & Gold ORLINX GROUP)
$emailHtml = <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Novo Briefing Protocolado — {$protocol}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #050914; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FDFBF7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; margin: 0 auto; background-color: #0E1830; border-radius: 16px; border: 1px solid #1E3158; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
    
    <!-- Top Header -->
    <tr>
      <td style="padding: 28px 32px; background: linear-gradient(135deg, #142244 0%, #080E1E 100%); border-bottom: 2px solid #D4AF37;">
        <table role="presentation" width="100%">
          <tr>
            <td>
              <span style="font-size: 11px; font-weight: 700; color: #D4AF37; letter-spacing: 2px; text-transform: uppercase; display: block; margin-bottom: 4px;">ORLINX ADS & WEB PLATFORM</span>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FDFBF7;">Novo Briefing Protocolado</h1>
            </td>
            <td align="right">
              <div style="background-color: #080E1E; border: 1px solid #D4AF37; padding: 8px 14px; border-radius: 8px; text-align: center;">
                <span style="font-size: 9px; color: #D3CBC3; display: block; text-transform: uppercase;">Protocolo</span>
                <span style="font-size: 14px; font-family: monospace; font-weight: bold; color: #D4AF37;">{$protocol}</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 32px;">

        <!-- Alerta de Entrada Comercial -->
        <div style="background-color: #142244; border-left: 4px solid #D4AF37; padding: 14px 18px; border-radius: 6px; margin-bottom: 26px;">
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #D3CBC3;">
            <strong style="color: #FDFBF7;">Aviso Comercial:</strong> Um novo projeto foi submetido e gravado no banco de dados centralizado do Supabase. Analise as especificações abaixo para contato comercial em até 24h.
          </p>
        </div>

        <!-- Seção 1: Dados da Empresa e Contato -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">1. Identificação Corporativa & Contato</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
          <tr>
            <td width="30%" style="color: #A6A099;">Razão Social:</td>
            <td style="color: #FDFBF7; font-weight: 600;">{$safeCompany}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Nome Fantasia:</td>
            <td style="color: #FDFBF7;">{$safeTrading}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">CNPJ / CPF:</td>
            <td style="color: #FDFBF7; font-family: monospace;">{$safeDoc}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Responsável:</td>
            <td style="color: #FDFBF7; font-weight: 600;">{$safeContact}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">E-mail:</td>
            <td><a href="mailto:{$safeEmail}" style="color: #D4AF37; text-decoration: none;">{$safeEmail}</a></td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Telefone / WhatsApp:</td>
            <td style="color: #FDFBF7;">{$safePhone}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Cidade / Estado:</td>
            <td style="color: #FDFBF7;">{$safeCityState}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Segmento de Mercado:</td>
            <td style="color: #FDFBF7;">{$safeSegment}</td>
          </tr>
        </table>

        <!-- Seção 2: Escopo e Objetivos -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">2. Escopo do Projeto & Objetivos</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
          <tr>
            <td width="30%" style="color: #A6A099;">Tipo de Website:</td>
            <td style="color: #FDFBF7; font-weight: 600;">{$safeProjectType}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Objetivo Principal:</td>
            <td style="color: #FDFBF7;">{$safePrimaryGoal}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Público-Alvo:</td>
            <td style="color: #FDFBF7;">{$safeAudience}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Resumo do Projeto:</td>
            <td style="color: #D3CBC3; line-height: 1.5;">{$safeSummary}</td>
          </tr>
        </table>

        <!-- Seção 3: Requisitos e Funcionalidades -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">3. Páginas & Funcionalidades</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
          <tr>
            <td width="30%" style="color: #A6A099;">Páginas Necessárias:</td>
            <td style="color: #FDFBF7;">{$safePages}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Recursos Especiais:</td>
            <td style="color: #FDFBF7;">{$safeFeatures}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Idiomas:</td>
            <td style="color: #FDFBF7;">{$safeLanguages}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Sistemas Externos/APIs:</td>
            <td style="color: #D3CBC3; line-height: 1.5;">{$safeRequirements}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">O que NÃO quer:</td>
            <td style="color: #D3CBC3; line-height: 1.5;">{$safeDisliked}</td>
          </tr>
        </table>

        <!-- Seção 4: Identidade Visual e Cores -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">4. Identidade Visual & Design</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
          <tr>
            <td width="30%" style="color: #A6A099;">Situação da Marca:</td>
            <td style="color: #FDFBF7;">{$safeBrandStatus}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Estilo Visual:</td>
            <td style="color: #FDFBF7;">{$safeDesignStyle}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Cores de Preferência:</td>
            <td style="color: #FDFBF7;">
              Primária: <span style="display:inline-block; width:12px; height:12px; background:{$safeColorPrimary}; border:1px solid #fff; vertical-align:middle;"></span> {$safeColorPrimary} |
              Secundária: <span style="display:inline-block; width:12px; height:12px; background:{$safeColorSecondary}; border:1px solid #fff; vertical-align:middle;"></span> {$safeColorSecondary} |
              Destaque: <span style="display:inline-block; width:12px; height:12px; background:{$safeColorAccent}; border:1px solid #fff; vertical-align:middle;"></span> {$safeColorAccent}
            </td>
          </tr>
        </table>

        <!-- Seção 5: Infraestrutura e Domínio -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">5. Infraestrutura & Hospedagem</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
          <tr>
            <td width="30%" style="color: #A6A099;">Status do Domínio:</td>
            <td style="color: #FDFBF7;">{$safeDomainStatus}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Endereço Pretendido:</td>
            <td style="color: #FDFBF7; font-family: monospace;">{$safeDomainName}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Preferência Hospedagem:</td>
            <td style="color: #FDFBF7;">{$safeHosting}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Caixas Postais:</td>
            <td style="color: #FDFBF7;">{$safeCorporateMails} conta(s) de e-mail</td>
          </tr>
        </table>

        <!-- Seção 6: Módulo ORLINX ADS -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">6. Campanha Publicitária ORLINX ADS</h2>
        <div style="background-color: #080E1E; padding: 14px; border-radius: 8px; border: 1px solid #1E3158; margin-bottom: 24px;">
HTML;

if ($adsOptIn) {
    $emailHtml .= <<<HTML
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #10B981; font-weight: bold;">
            &#10003; O cliente OPTOU por incluir uma campanha publicitária na rede ORLINX ADS.
          </p>
          <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px;">
            <tr><td width="30%" style="color: #A6A099;">Formato Desejado:</td><td style="color: #FDFBF7;">{$safeAdsFormat}</td></tr>
            <tr><td style="color: #A6A099;">Período Inicial:</td><td style="color: #FDFBF7;">{$safeAdsPeriod} dias</td></tr>
            <tr><td style="color: #A6A099;">Orçamento Mídia:</td><td style="color: #FDFBF7;">{$safeAdsBudget}</td></tr>
            <tr><td style="color: #A6A099;">URL de Destino:</td><td style="color: #D4AF37;">{$safeAdsUrl}</td></tr>
          </table>
HTML;
} else {
    $emailHtml .= <<<HTML
          <p style="margin: 0; font-size: 13px; color: #A6A099; font-style: italic;">
            Cliente optou apenas pelo desenvolvimento web no momento (sem módulo de veiculação ORLINX ADS).
          </p>
HTML;
}

$emailHtml .= <<<HTML
        </div>

        <!-- Seção 7: Investimento e Prazos -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">7. Orçamento & Prazos</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 24px;">
          <tr>
            <td width="30%" style="color: #A6A099;">Faixa de Investimento:</td>
            <td style="color: #FDFBF7; font-weight: bold;">{$safeInvestment}</td>
          </tr>
          <tr>
            <td style="color: #A6A099;">Previsão de Lançamento:</td>
            <td style="color: #FDFBF7;">{$safeLaunchDate}</td>
          </tr>
        </table>

        <!-- Seção 8: Documentos e Arquivos Anexados -->
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; margin: 0 0 12px 0; border-bottom: 1px solid #1E3158; padding-bottom: 6px;">8. Arquivos & Ativos Anexados</h2>
        <div style="background-color: #080E1E; padding: 14px; border-radius: 8px; border: 1px solid #1E3158; font-size: 13px; margin-bottom: 24px;">
          {$filesHtmlList}
        </div>

        <!-- Footer / Auditoria -->
        <div style="border-top: 1px solid #1E3158; padding-top: 16px; font-size: 11px; color: #6D7081; line-height: 1.5;">
          Submissão registrada em: {$submissionDate} | IP de Origem: {$clientIp}<br>
          Termos da Política de Privacidade (LGPD) aceitos integralmente pelo cliente.<br>
          Ambiente de Custódia: Supabase Oficial (ulajrvkaqqedwuaiaksp) & Hostinger Brasil.
        </div>

      </td>
    </tr>
  </table>
</body>
</html>
HTML;

// 8. Construção da Mensagem MIME Multipart/Alternative
$boundary = "----=_Part_" . md5(uniqid((string)microtime(true), true));

$to = 'comercial@orlinxgroup.com.br';
$fromEmail = 'contato@orlinxgroup.com.br';
$fromName = 'ORLINX ADS';
$replyToEmail = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : $fromEmail;
$replyToName = preg_replace('/[\r\n]+/', '', $contactName);

$subject = "Novo Briefing Digital: {$protocol} - {$companyName}";
$subjectEncoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$fromEncoded = '=?UTF-8?B?' . base64_encode($fromName) . "?= <{$fromEmail}>";
$replyToEncoded = '=?UTF-8?B?' . base64_encode($replyToName) . "?= <{$replyToEmail}>";

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    'From: ' . $fromEncoded,
    'Reply-To: ' . $replyToEncoded,
    'X-Mailer: PHP/' . phpversion()
];

$messageBody = "--" . $boundary . "\r\n" .
               "Content-Type: text/plain; charset=UTF-8\r\n" .
               "Content-Transfer-Encoding: 8bit\r\n\r\n" .
               $plainText . "\r\n\r\n" .
               "--" . $boundary . "\r\n" .
               "Content-Type: text/html; charset=UTF-8\r\n" .
               "Content-Transfer-Encoding: 8bit\r\n\r\n" .
               $emailHtml . "\r\n\r\n" .
               "--" . $boundary . "--\r\n";

$headersStr = implode("\r\n", $headers);
$additionalParams = "-f {$fromEmail}";

$sent = @mail($to, $subjectEncoded, $messageBody, $headersStr, $additionalParams);

if ($sent) {
    // Registra lock de despacho para prevenir duplicidades
    @file_put_contents($lockFile, json_encode([
        'protocol' => $protocol,
        'company' => $companyName,
        'dispatched_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'recipient' => $to
    ]));

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'protocol' => $protocol,
        'recipient' => $to,
        'dispatched_at' => gmdate('Y-m-d\TH:i:s\Z')
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'protocol' => $protocol,
        'error' => 'Falha interna no servico de correio ao despachar a notificacao.'
    ]);
}
