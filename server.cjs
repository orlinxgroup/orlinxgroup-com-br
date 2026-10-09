/**
 * ORLINX GROUP & ORLINX ADS - Servidor Backend & Gateway de API
 * Integração Oficial Exclusiva com Supabase: ulajrvkaqqedwuaiaksp
 * (https://ulajrvkaqqedwuaiaksp.supabase.co)
 * Zero Senhas Padrão | Zero JSON Local (data/ads_database.json)
 * Autenticação Real com Supabase Auth e Verificação na Tabela orx_admins
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Configurações do Projeto Supabase Oficial
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ulajrvkaqqedwuaiaksp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Fallback institucional oficial em memória (utilizado apenas se o banco ainda não tiver migração executada)
const DEFAULT_INSTITUTIONAL_CAMPAIGNS = [
  {
    id: 'orx-slot-topo',
    campaign_code: 'CAMP-001',
    client_name: 'Espaço Disponível • ORLINX ADS',
    title: 'Posicione sua Empresa no Topo do Portal ORLINX GROUP',
    slot: 'top-leaderboard',
    banner_url: '',
    target_url: '/anuncie.html',
    cta_text: 'Anuncie Conosco',
    status: 'active'
  },
  {
    id: 'orx-slot-feed',
    campaign_code: 'CAMP-002',
    client_name: 'ORLINX GROUP Institucional',
    title: 'Infraestrutura Corporativa, Consultoria Estratégica e Tecnologia Orbital',
    slot: 'feed-billboard',
    banner_url: '',
    target_url: '/anuncie.html',
    cta_text: 'Conhecer a Rede',
    status: 'active'
  },
  {
    id: 'orx-slot-lateral',
    campaign_code: 'CAMP-003',
    client_name: 'Vitrine de Anunciantes • ORLINX ADS',
    title: 'Destaque seus Serviços B2B para Empresas e Decisores',
    slot: 'sidebar-box',
    banner_url: '',
    target_url: '/anuncie.html',
    cta_text: 'Ver Formatos',
    status: 'active'
  }
];

// Sanitização contra XSS e Validações
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[<>'"&]/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      case '&': return '&amp;';
      default: return char;
    }
  }).trim();
}

function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Helpers de Comunicação com a API REST do Supabase Oficial
async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}${endpoint}`;

  // Se a operação for privilegiada, exige estritamente SUPABASE_SERVICE_ROLE_KEY (sem fallback para anon key)
  if (options.useServiceRole) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Segurança Safe-Fail] Operação privilegiada abortada: SUPABASE_SERVICE_ROLE_KEY ausente.');
      return {
        status: 500,
        ok: false,
        error: 'Configuração obrigatória ausente: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
      };
    }
  }

  const apiKey = options.useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;

  // Falha de forma segura se nenhuma credencial estiver disponível e não houver header Authorization
  if (!apiKey && !options.headers?.Authorization) {
    return {
      status: 500,
      ok: false,
      error: 'Configuração obrigatória ausente: Nenhuma credencial do Supabase configurada.'
    };
  }

  const headers = {
    'apikey': apiKey || SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (!headers['Authorization'] && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text;
    }

    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 500, ok: false, error: err.message };
  }
}

// Validação de Sessão com Supabase Auth
async function verifySupabaseToken(token) {
  if (!token) return null;
  const res = await supabaseFetch('/auth/v1/user', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (res.ok && res.data && res.data.id) {
    return res.data;
  }
  return null;
}

// Verificação de Perfil de Administrador em orx_admins
async function isUserAdmin(userId, userToken) {
  if (!userId) return false;

  // 1. Se a chave privilegiada de serviço estiver configurada, valida via service_role
  if (SUPABASE_SERVICE_ROLE_KEY) {
    const res = await supabaseFetch(`/rest/v1/orx_admins?user_id=eq.${userId}&role=eq.admin&is_active=eq.true`, {
      useServiceRole: true
    });
    return res.ok && Array.isArray(res.data) && res.data.length > 0;
  }

  // 2. Se a chave de serviço não estiver no servidor local, mas houver token autenticado do usuário:
  // Consulta a tabela orx_admins com o token do próprio usuário, respeitando a política RLS
  // (a política RLS invoca public.is_admin(), que verifica se auth.uid() é admin ativo).
  if (userToken && SUPABASE_ANON_KEY) {
    const res = await supabaseFetch(`/rest/v1/orx_admins?user_id=eq.${userId}&role=eq.admin&is_active=eq.true`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    return res.ok && Array.isArray(res.data) && res.data.length > 0;
  }

  // 3. Falha segura se nenhuma credencial estiver disponível
  return false;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// Servidor HTTP
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Headers de Segurança Base (OWASP)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Roteamento de API
  if (pathname.startsWith('/api/')) {
    handleApiRoute(req, res, pathname, parsedUrl);
    return;
  }

  // Roteamento de Arquivos Estáticos
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, safePath);

  // Prevenção de Path Traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Página Não Encontrada</h1><p><a href="/">&larr; Retornar à Home</a></p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function handleApiRoute(req, res, pathname, parsedUrl) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) { // Limite máximo de 5MB
      res.writeHead(413);
      res.end(JSON.stringify({ error: 'Payload excede o limite permitido.' }));
      req.destroy();
    }
  });

  req.on('end', async () => {
    let jsonBody = {};
    if (body) {
      try {
        jsonBody = JSON.parse(body);
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Formato JSON inválido.' }));
        return;
      }
    }

    // --- 1. Configuração Pública do Supabase (/api/config) ---
    // Retorna exclusivamente a URL e a Anon Key pública para inicialização no navegador
    // Chave service_role NUNCA é enviada ao cliente
    if (pathname === '/api/config' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY
      }));
      return;
    }

    // --- 2. Autenticação Segura via Supabase Auth (/api/auth/login) ---
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const email = (jsonBody.email || '').trim().toLowerCase();
      const password = (jsonBody.password || '').trim();

      if (!email || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'E-mail e senha são obrigatórios.' }));
        return;
      }

      // 1. Chama Supabase GoTrue Auth no projeto ulajrvkaqqedwuaiaksp
      const authRes = await supabaseFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email, password }
      });

      if (!authRes.ok || !authRes.data || !authRes.data.access_token) {
        res.writeHead(401);
        res.end(JSON.stringify({
          success: false,
          error: (authRes.data && authRes.data.error_description) || 'Credenciais inválidas no Supabase Auth.'
        }));
        return;
      }

      const user = authRes.data.user;
      const token = authRes.data.access_token;

      // 2. Validação rigorosa na tabela orx_admins (Sem conceder acesso a qualquer usuário autenticado)
      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403);
        res.end(JSON.stringify({
          success: false,
          error: 'Acesso negado: Usuário autenticado, mas não cadastrado como administrador em orx_admins.'
        }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        token,
        user: { id: user.id, email: user.email, role: 'admin' }
      }));
      return;
    }

    // --- 3. Verificação de Sessão Atual (/api/auth/me) ---
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = await verifySupabaseToken(token);

      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ authenticated: false, error: 'Sessão inválida ou expirada no Supabase Auth.' }));
        return;
      }

      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403);
        res.end(JSON.stringify({ authenticated: false, error: 'Usuário sem privilégios administrativos em orx_admins.' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        authenticated: true,
        user: { id: user.id, email: user.email, role: 'admin' }
      }));
      return;
    }

    // --- 4. Campanhas Públicas e Administrativas (/api/campaigns) ---
    if (pathname === '/api/campaigns' && req.method === 'GET') {
      const isAllRequested = parsedUrl.searchParams.get('all') === 'true';

      // Se for solicitada a listagem de todas as campanhas (gestão), exige autenticação administrativa
      if (isAllRequested) {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = await verifySupabaseToken(token);

        if (!user) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Acesso restrito ao administrador. Autenticação Supabase necessária para listar todas as campanhas.' }));
          return;
        }

        const adminVerified = await isUserAdmin(user.id, token);
        if (!adminVerified) {
          res.writeHead(403);
          res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem privilégios administrativos em orx_admins.' }));
          return;
        }

        const sbRes = await supabaseFetch('/rest/v1/orx_ads_campaigns?select=*', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const campaigns = (sbRes.ok && Array.isArray(sbRes.data)) ? sbRes.data : DEFAULT_INSTITUTIONAL_CAMPAIGNS;
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, campaigns }));
        return;
      }

      // Consulta pública: somente campanhas ativas no Supabase oficial
      const sbRes = await supabaseFetch('/rest/v1/orx_ads_campaigns?status=eq.active&select=*');
      let campaigns = [];

      if (sbRes.ok && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
        campaigns = sbRes.data;
      } else {
        // Preserva os espaços institucionais oficiais se a tabela ainda estiver vazia
        campaigns = DEFAULT_INSTITUTIONAL_CAMPAIGNS;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, campaigns }));
      return;
    }

    // --- 5. Pedidos: Cadastro de Anunciante (/api/orders - POST) ---
    if (pathname === '/api/orders' && req.method === 'POST') {
      const companyName = sanitizeString(jsonBody.company_name);
      const documentNumber = sanitizeString(jsonBody.document);
      const email = sanitizeString(jsonBody.email).toLowerCase();
      const phone = sanitizeString(jsonBody.phone);
      const targetUrl = (jsonBody.target_url || '').trim();
      const planKey = (jsonBody.plan || '').toLowerCase();
      const bannerData = jsonBody.banner || '';

      // Validações rigorosas no servidor
      if (!companyName || companyName.length < 3) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Razão social/Nome da empresa inválido.' }));
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'E-mail corporativo inválido.' }));
        return;
      }

      if (!isValidHttpUrl(targetUrl)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'A URL de destino deve começar estritamente com http:// ou https:// e ser válida.' }));
        return;
      }

      const validPlans = {
        starter: { name: 'Plano Starter', price: 199.00, slot: 'sidebar-box' },
        business: { name: 'Plano Business', price: 389.00, slot: 'feed-billboard' },
        master: { name: 'Plano Master', price: 790.00, slot: 'top-leaderboard' },
        custom: { name: 'Pacote Corporativo Sob Medida', price: 0.00, slot: 'custom-package' }
      };

      if (!validPlans[planKey]) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Plano selecionado inválido.' }));
        return;
      }

      // Validação de upload de banner em Base64
      let safeBannerUrl = '';
      if (bannerData) {
        const matches = bannerData.match(/^data:(image\/(png|jpeg|webp));base64,/);
        if (!matches) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Formato de banner inválido. Apenas PNG, JPEG ou WebP são permitidos.' }));
          return;
        }
        // Limite estrito de 2MB em Base64 (~2.8MB texto)
        if (bannerData.length > 2.8 * 1024 * 1024) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Arquivo excede o limite máximo permitido de 2MB.' }));
          return;
        }
        safeBannerUrl = bannerData;
      }

      const orderCode = 'ORX-' + crypto.randomInt(100000, 999999);
      const plan = validPlans[planKey];

      const newOrderPayload = {
        order_code: orderCode,
        company_name: companyName,
        document_number: documentNumber,
        email,
        phone,
        plan_key: planKey,
        plan_name: plan.name,
        amount: plan.price,
        slot: plan.slot,
        target_url: targetUrl,
        banner_url: safeBannerUrl,
        status: 'pending_review'
      };

      // Persistência direta no Supabase oficial (orx_ads_orders)
      const sbInsert = await supabaseFetch('/rest/v1/orx_ads_orders', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: newOrderPayload
      });

      // Falha Segura: Se o Supabase não persistir os dados, responde com erro 5xx e NÃO emite confirmação de pedido
      if (!sbInsert.ok) {
        console.error('[Falha de Persistência Supabase]', sbInsert.status, sbInsert.error || sbInsert.data);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: 'Falha na persistência centralizada do pedido no Supabase. O pedido não foi protocolado.'
        }));
        return;
      }

      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        orderId: orderCode,
        order_code: orderCode,
        status: 'pending_review',
        persisted: true,
        message: 'Solicitação protocolada com sucesso. Os dados comerciais e faturamento serão processados após homologação oficial da campanha.'
      }));
      return;
    }

    // --- 6. Pedidos: Listagem Administrativa (/api/orders - GET) ---
    if (pathname === '/api/orders' && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = await verifySupabaseToken(token);

      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Acesso restrito ao administrador. Autenticação Supabase necessária.' }));
        return;
      }

      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem permissões em orx_admins.' }));
        return;
      }

      // Consulta pedidos no Supabase oficial usando o token do usuário (RLS ativo)
      const sbOrders = await supabaseFetch('/rest/v1/orx_ads_orders?order=created_at.desc&select=*', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        orders: Array.isArray(sbOrders.data) ? sbOrders.data : []
      }));
      return;
    }

    // --- 7. Pedidos: Aprovação de Campanha (/api/orders/approve - POST) ---
    if (pathname === '/api/orders/approve' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = await verifySupabaseToken(token);

      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Acesso restrito ao administrador. Autenticação Supabase necessária.' }));
        return;
      }

      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem permissões em orx_admins.' }));
        return;
      }

      const orderCode = jsonBody.orderId || jsonBody.order_code;
      // Atualiza status do pedido no Supabase
      const updateRes = await supabaseFetch(`/rest/v1/orx_ads_orders?order_code=eq.${orderCode}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: { status: 'active' }
      });

      // Cria campanha correspondente no Supabase
      const newCampaign = {
        campaign_code: 'CAMP-' + orderCode,
        client_name: jsonBody.companyName || 'Anunciante Aprovado',
        title: `${jsonBody.companyName || 'Anunciante'} • Anúncio Corporativo`,
        slot: jsonBody.slot || 'feed-billboard',
        target_url: jsonBody.targetUrl || '/anuncie.html',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        impressions: 0,
        clicks: 0
      };

      const campRes = await supabaseFetch('/rest/v1/orx_ads_campaigns', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: newCampaign
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        campaign: (campRes.data && campRes.data[0]) || newCampaign
      }));
      return;
    }

    // --- 7b. Campanhas: Alternar Status Ativo/Pausado (/api/campaigns/toggle - POST) ---
    if (pathname === '/api/campaigns/toggle' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = await verifySupabaseToken(token);

      if (!user) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Acesso restrito ao administrador. Autenticação Supabase necessária.' }));
        return;
      }

      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem permissões em orx_admins.' }));
        return;
      }

      const campId = jsonBody.id;
      if (!campId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Identificador da campanha obrigatório.' }));
        return;
      }

      // Consulta status atual
      const curRes = await supabaseFetch(`/rest/v1/orx_ads_campaigns?id=eq.${campId}&select=status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const curStatus = (curRes.ok && curRes.data?.[0]?.status) || 'active';
      const newStatus = curStatus === 'active' ? 'paused' : 'active';

      await supabaseFetch(`/rest/v1/orx_ads_campaigns?id=eq.${campId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: { status: newStatus }
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, status: newStatus }));
      return;
    }

    // --- 8. Telemetria: Registro de Métricas (/api/telemetry) ---
    if (pathname === '/api/telemetry' && req.method === 'POST') {
      const { campaignId, type, slot } = jsonBody;
      if (!campaignId || !['impression', 'click'].includes(type)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Parâmetros de telemetria inválidos.' }));
        return;
      }

      // Persiste evento no Supabase oficial (orx_ads_telemetry)
      await supabaseFetch('/rest/v1/orx_ads_telemetry', {
        method: 'POST',
        body: {
          campaign_id: campaignId,
          event_type: type,
          slot: slot || 'unknown'
        }
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Rota Não Encontrada
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint não encontrado.' }));
  });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ORLINX ADS Backend ativo em http://127.0.0.1:${PORT}`);
  console.log(`Supabase Oficial: ${SUPABASE_URL}`);
});
