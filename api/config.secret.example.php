<?php
/**
 * ORLINX ADS — Exemplo de Configuração de Credenciais Seguras
 * 
 * Para ativar cobranças reais em produção na Hostinger:
 * 1. Copie este arquivo como `api/config.secret.php` no servidor.
 * 2. Preencha `WOOVI_APP_ID` com a AppID gerada no painel da Woovi (https://app.woovi.com).
 * 3. Opcionalmente configure `WOOVI_WEBHOOK_SECRET` para validação por HMAC-SHA256.
 * 
 * ATENÇÃO: NUNCA faça commit de `config.secret.php`. O arquivo já está listado no .gitignore
 * e o diretório /api/.htaccess bloqueia acesso web direto.
 */

return [
    // Credencial Oficial Woovi (AppID)
    'WOOVI_APP_ID' => '',

    // Segredo de Assinatura do Webhook (Opcional)
    'WOOVI_WEBHOOK_SECRET' => ''
];
