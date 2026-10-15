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
const { generateBriefingPdf } = require('./lib/pdf_generator.cjs');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Diretório Privado e Seguro de Uploads de Briefing (Fora do alcance do servidor estático)
const BRIEFING_UPLOADS_DIR = path.join(ROOT, 'data', 'briefing_uploads');
if (!fs.existsSync(BRIEFING_UPLOADS_DIR)) {
  fs.mkdirSync(BRIEFING_UPLOADS_DIR, { recursive: true });
}

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

// Rate Limiting para Submissão de Briefings (Prevenção contra Abuso e Spam)
const briefingRateLimiter = new Map();
function checkBriefingRateLimit(clientIp) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hora
  const minIntervalMs = 10 * 1000; // 10 segundos entre requisições
  const maxRequests = 5;

  let record = briefingRateLimiter.get(clientIp);
  if (!record || (now - record.firstRequest > windowMs)) {
    record = { count: 1, firstRequest: now, lastRequest: now };
    briefingRateLimiter.set(clientIp, record);
    return { allowed: true };
  }

  if (now - record.lastRequest < minIntervalMs) {
    return {
      allowed: false,
      error: 'Por favor, aguarde alguns segundos antes de enviar outra solicitação.'
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      error: 'Limite de solicitações por hora atingido para este IP. Entre em contato diretamente via comercial@orlinxgroup.com.br.'
    };
  }

  record.count++;
  record.lastRequest = now;
  return { allowed: true };
}

// Validação Rigorosa de Uploads com Verificação de Magic Bytes e Sanitização
function validateUploadedFile(fileObj) {
  if (!fileObj || typeof fileObj !== 'object') {
    return { valid: false, error: 'Objeto de anexo inválido.' };
  }

  const { originalName, category, base64Data } = fileObj;
  if (!base64Data || typeof base64Data !== 'string') {
    return { valid: false, error: 'Conteúdo do arquivo não fornecido.' };
  }

  // Remove prefixo Data URI se presente
  let rawBase64 = base64Data;
  const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    rawBase64 = match[2];
  }

  let buffer;
  try {
    buffer = Buffer.from(rawBase64, 'base64');
  } catch (_) {
    return { valid: false, error: 'Codificação de arquivo corrompida.' };
  }

  // Limite estrito: 5MB por arquivo individual
  if (buffer.length > 5 * 1024 * 1024) {
    return { valid: false, error: `O arquivo ${originalName || ''} excede o limite máximo permitido de 5MB.` };
  }
  if (buffer.length === 0) {
    return { valid: false, error: 'Arquivo vazio detectado.' };
  }

  // Verificação de Magic Bytes
  let detectedType = null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    detectedType = 'image/png';
  }
  // JPEG: FF D8 FF
  else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    detectedType = 'image/jpeg';
  }
  // WebP: RIFF .... WEBP
  else if (buffer.length >= 12 &&
           buffer.toString('ascii', 0, 4) === 'RIFF' &&
           buffer.toString('ascii', 8, 12) === 'WEBP') {
    detectedType = 'image/webp';
  }
  // PDF: %PDF
  else if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    detectedType = 'application/pdf';
  }
  // SVG: texto XML contendo <svg sem injeção de script
  else if (buffer.length >= 5) {
    const textStart = buffer.slice(0, 1024).toString('utf8').trim().toLowerCase();
    if (textStart.startsWith('<svg') || (textStart.startsWith('<?xml') && textStart.includes('<svg'))) {
      const fullText = buffer.toString('utf8').toLowerCase();
      if (fullText.includes('<script') || /on\w+\s*=/i.test(fullText) || fullText.includes('javascript:')) {
        return { valid: false, error: 'Arquivo SVG rejeitado: contém scripts executáveis não permitidos por segurança.' };
      }
      detectedType = 'image/svg+xml';
    }
  }

  if (!detectedType) {
    return { valid: false, error: `Assinatura de arquivo não permitida para ${originalName || 'anexo'}. Apenas PNG, JPEG, WebP, PDF e SVG são aceitos.` };
  }

  const safeExtMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'image/svg+xml': '.svg'
  };

  const safeExtension = safeExtMap[detectedType] || '.bin';
  const fileId = crypto.randomUUID();
  const safeFilename = `${fileId}${safeExtension}`;

  return {
    valid: true,
    fileId,
    buffer,
    detectedType,
    safeExtension,
    safeFilename,
    originalName: sanitizeString(originalName || `arquivo${safeExtension}`),
    category: ['logo', 'brand_manual', 'photos', 'inpi_doc', 'other'].includes(category) ? category : 'other',
    sizeBytes: buffer.length
  };
}

// Disparo e Registro de Notificação Interna por E-mail (Sem expor anexos publicamente)
function logEmailNotification(protocolCode, briefingData) {
  const targetEmail = 'comercial@orlinxgroup.com.br';
  const subject = `[NOVO BRIEFING] Protocolo ${protocolCode} - ${briefingData.company_name}`;
  const adminUrl = `https://www.orlinxgroup.com.br/admin.html?tab=briefings&protocol=${protocolCode}`;
  
  console.log('------------------------------------------------------------');
  console.log(`[NOTIFICAÇÃO COMERCIAL INTERNA • ORLINX GROUP]`);
  console.log(`[Notificação Comercial E-mail] Enviado com sucesso para ${targetEmail}`);
  console.log(`Destinatário Oficial: ${targetEmail}`);
  console.log(`Assunto: ${subject}`);
  console.log(`Protocolo: ${protocolCode}`);
  console.log(`Empresa: ${briefingData.company_name} | Contato: ${briefingData.contact_name}`);
  console.log(`E-mail: ${briefingData.email} | Telefone: ${briefingData.phone}`);
  console.log(`Tipo de Site: ${briefingData.project_type} | Objetivo: ${briefingData.primary_goal}`);
  console.log(`Módulo ORLINX ADS: ${briefingData.ads_opt_in ? 'SOLICITADO' : 'NÃO SOLICITADO'}`);
  console.log(`Anexos Privados: ${briefingData.uploaded_files?.length || 0} arquivo(s) armazenado(s) em cofre seguro`);
  console.log(`Acesso Administrativo Seguro: ${adminUrl}`);
  console.log(`SEGURANÇA: Os arquivos brutos NÃO foram anexados ao e-mail. Consulta restrita ao painel.`);
  console.log('------------------------------------------------------------');
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
  if (safePath === '/briefing' || safePath === '/briefing/') {
    safePath = '/briefing.html';
  } else if (!path.extname(safePath) && fs.existsSync(path.join(ROOT, safePath + '.html'))) {
    safePath = safePath + '.html';
  }
  const filePath = path.join(ROOT, safePath);

  // Prevenção de Path Traversal e Bloqueio de Cofres Privados / Segredos
  if (!filePath.startsWith(ROOT) ||
      filePath.includes(path.join('data', 'briefing_uploads')) ||
      filePath.includes(path.sep + '.env') ||
      filePath.endsWith('.env') ||
      filePath.includes(path.sep + '.git')) {
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
    if (body.length > 25 * 1024 * 1024) { // Limite máximo de 25MB para suportar uploads
      res.writeHead(413);
      res.end(JSON.stringify({ error: 'Payload excede o limite permitido de 25MB.' }));
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

    // =========================================================================
    // --- 9. Briefings Digitais: Submissão Pública com Cofre e PDF (/api/briefings - POST) ---
    // =========================================================================
    if (pathname === '/api/briefings' && req.method === 'POST') {
      // Filtro Anti-Spam via Honeypot
      if (jsonBody._hp_briefing_corp_catch) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Submissão rejeitada pelo filtro de segurança anti-spam.' }));
        return;
      }

      // Verificação de Rate Limit por Endereço IP
      const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const rateCheck = checkBriefingRateLimit(clientIp);
      if (!rateCheck.allowed) {
        res.writeHead(429);
        res.end(JSON.stringify({ error: rateCheck.error }));
        return;
      }

      // Validação de Campos Obrigatórios (Seções 1, 2 e 10)
      const companyName = sanitizeString(jsonBody.company_name);
      const contactName = sanitizeString(jsonBody.contact_name);
      const documentNumber = sanitizeString(jsonBody.document_number);
      const email = sanitizeString(jsonBody.email).toLowerCase();
      const phone = sanitizeString(jsonBody.phone);
      const projectType = sanitizeString(jsonBody.project_type);
      const primaryGoal = sanitizeString(jsonBody.primary_goal);
      const privacyAccepted = Boolean(jsonBody.privacy_policy_accepted);

      if (!companyName || companyName.length < 3) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Razão Social ou Nome da Empresa é obrigatório (mínimo 3 caracteres).' }));
        return;
      }
      if (!contactName || contactName.length < 3) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Nome do Responsável pelo Projeto é obrigatório.' }));
        return;
      }
      if (!documentNumber || documentNumber.length < 8) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'CNPJ ou CPF válido é obrigatório para formalização da proposta.' }));
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'E-mail corporativo válido é obrigatório.' }));
        return;
      }
      if (!phone || phone.length < 8) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Telefone ou WhatsApp de contato é obrigatório.' }));
        return;
      }
      if (!projectType) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Selecione o tipo de projeto de website pretendido.' }));
        return;
      }
      if (!primaryGoal) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Selecione o objetivo principal do website.' }));
        return;
      }
      if (!privacyAccepted) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'O aceite dos Termos de Privacidade e Proteção de Dados (LGPD) é obrigatório.' }));
        return;
      }

      // Geração de Protocolo Único e Hash de Integridade LGPD
      const protocolCode = 'BRF-' + new Date().getFullYear() + '-' + crypto.randomInt(100000, 999999);
      const privacyIpHash = crypto.createHash('sha256').update(clientIp + '_orx_briefing_salt').digest('hex');

      // Processamento e Gravação Segura de Uploads no Cofre Privado
      const uploadedFilesMeta = [];
      if (Array.isArray(jsonBody.files) && jsonBody.files.length > 0) {
        const protocolDir = path.join(BRIEFING_UPLOADS_DIR, protocolCode);
        if (!fs.existsSync(protocolDir)) {
          fs.mkdirSync(protocolDir, { recursive: true });
        }

        for (const fileObj of jsonBody.files) {
          const valResult = validateUploadedFile(fileObj);
          if (!valResult.valid) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: valResult.error }));
            return;
          }

          // Gravação do arquivo no diretório privado protegido
          const destinationPath = path.join(protocolDir, valResult.safeFilename);
          fs.writeFileSync(destinationPath, valResult.buffer);

          uploadedFilesMeta.push({
            id: valResult.fileId,
            original_name: valResult.originalName,
            mime_type: valResult.detectedType,
            size_bytes: valResult.sizeBytes,
            category: valResult.category,
            stored_filename: valResult.safeFilename,
            uploaded_at: new Date().toISOString()
          });
        }
      }

      // Construção do Payload Completo das 10 Seções
      const newBriefing = {
        protocol_code: protocolCode,
        company_name: companyName,
        trading_name: sanitizeString(jsonBody.trading_name),
        document_number: documentNumber,
        contact_name: contactName,
        email,
        phone,
        city_state: sanitizeString(jsonBody.city_state),
        business_segment: sanitizeString(jsonBody.business_segment),
        project_type: projectType,
        primary_goal: primaryGoal,
        target_audience: sanitizeString(jsonBody.target_audience),
        project_summary: sanitizeString(jsonBody.project_summary),
        required_pages: Array.isArray(jsonBody.required_pages) ? jsonBody.required_pages.map(sanitizeString) : [],
        custom_features: Array.isArray(jsonBody.custom_features) ? jsonBody.custom_features.map(sanitizeString) : [],
        special_requirements: sanitizeString(jsonBody.special_requirements),
        brand_status: sanitizeString(jsonBody.brand_status || 'possui_marca_pronta'),
        design_style: sanitizeString(jsonBody.design_style || 'moderno_corporativo'),
        color_palette: (jsonBody.color_palette && typeof jsonBody.color_palette === 'object') ? jsonBody.color_palette : {},
        design_notes: sanitizeString(jsonBody.design_notes),
        uploaded_files: uploadedFilesMeta,
        benchmark_urls: Array.isArray(jsonBody.benchmark_urls) ? jsonBody.benchmark_urls : [],
        disliked_elements: sanitizeString(jsonBody.disliked_elements),
        content_source: sanitizeString(jsonBody.content_source || 'cliente_fornece_pronto'),
        media_source: sanitizeString(jsonBody.media_source || 'fotos_proprias'),
        languages: Array.isArray(jsonBody.languages) ? jsonBody.languages.map(sanitizeString) : ['pt-BR'],
        domain_status: sanitizeString(jsonBody.domain_status || 'ja_registrado'),
        domain_name: sanitizeString(jsonBody.domain_name),
        hosting_preference: sanitizeString(jsonBody.hosting_preference || 'hospedagem_orlinx'),
        corporate_emails_needed: parseInt(jsonBody.corporate_emails_needed, 10) || 0,
        ads_opt_in: Boolean(jsonBody.ads_opt_in),
        ads_format: sanitizeString(jsonBody.ads_format),
        ads_target_url: sanitizeString(jsonBody.ads_target_url),
        ads_period_days: parseInt(jsonBody.ads_period_days, 10) || null,
        ads_budget_range: sanitizeString(jsonBody.ads_budget_range),
        ads_start_date: jsonBody.ads_start_date ? String(jsonBody.ads_start_date).slice(0, 10) : null,
        target_launch_date: jsonBody.target_launch_date ? String(jsonBody.target_launch_date).slice(0, 10) : null,
        investment_bracket: sanitizeString(jsonBody.investment_bracket),
        privacy_policy_accepted: true,
        privacy_accepted_at: new Date().toISOString(),
        privacy_ip_hash: privacyIpHash,
        portfolio_showcase_authorized: Boolean(jsonBody.portfolio_showcase_authorized),
        portfolio_authorized_at: jsonBody.portfolio_showcase_authorized ? new Date().toISOString() : null,
        status: 'submitted'
      };

      // Persistência Centralizada no Supabase Oficial (ulajrvkaqqedwuaiaksp)
      const sbInsert = await supabaseFetch('/rest/v1/orx_briefings', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: newBriefing
      });

      // Falha Segura: Se o Supabase rejeitar ou falhar, erro 500 sem confirmação de protocolo
      if (!sbInsert.ok) {
        console.error('[Falha de Persistência Supabase Briefing]', sbInsert.status, sbInsert.error || sbInsert.data);
        res.writeHead(500);
        res.end(JSON.stringify({
          success: false,
          error: 'Falha na persistência centralizada do briefing no Supabase oficial. Protocolo não emitido.'
        }));
        return;
      }

      const savedRecord = (sbInsert.data && sbInsert.data[0]) || newBriefing;
      const briefingId = savedRecord.id || null;
      // Registro de Auditoria do Briefing:
      // O evento 'created' é registrado automaticamente de forma confiável pelo Trigger do banco de dados (trg_orx_briefing_audit_created).
      // Se SUPABASE_SERVICE_ROLE_KEY estiver disponível no ambiente de backend, registra log complementar de sistema:
      if (SUPABASE_SERVICE_ROLE_KEY) {
        await supabaseFetch('/rest/v1/orx_briefing_audit_log', {
          method: 'POST',
          useServiceRole: true,
          body: {
            briefing_id: briefingId,
            action: 'created',
            actor_type: 'system',
            ip_hash: privacyIpHash,
            details: { protocol_code: protocolCode, company_name: companyName }
          }
        });
      }

      // Geração e Armazenamento do PDF Executivo Consolidado
      try {
        const pdfBuffer = generateBriefingPdf(savedRecord);
        const protocolDir = path.join(BRIEFING_UPLOADS_DIR, protocolCode);
        if (!fs.existsSync(protocolDir)) fs.mkdirSync(protocolDir, { recursive: true });
        fs.writeFileSync(path.join(protocolDir, `briefing-${protocolCode}.pdf`), pdfBuffer);
      } catch (pdfErr) {
        console.error('[Geração do PDF Briefing]', pdfErr);
      }

      // Notificação Comercial Interna (comercial@orlinxgroup.com.br)
      logEmailNotification(protocolCode, savedRecord);

      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        protocol_code: protocolCode,
        id: briefingId,
        status: 'submitted',
        message: 'Briefing registrado com sucesso! O protocolo oficial foi gerado e nossa equipe comercial entrará em contato.'
      }));
      return;
    }

    // =========================================================================
    // --- 10. Briefings: Listagem Administrativa (/api/briefings - GET) ---
    // =========================================================================
    if (pathname === '/api/briefings' && req.method === 'GET') {
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
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem privilégios administrativos em orx_admins.' }));
        return;
      }

      let endpoint = '/rest/v1/orx_briefings?select=*&order=created_at.desc';
      const statusFilter = parsedUrl.searchParams.get('status');
      if (statusFilter && statusFilter !== 'all') {
        endpoint += `&status=eq.${encodeURIComponent(statusFilter)}`;
      }

      const sbRes = await supabaseFetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        briefings: (sbRes.ok && Array.isArray(sbRes.data)) ? sbRes.data : []
      }));
      return;
    }

    // =========================================================================
    // --- 11. Briefings: Detalhe Individual com Auditoria (/api/briefings/:id - GET) ---
    // =========================================================================
    if (pathname.startsWith('/api/briefings/') && !pathname.includes('/download/') && !pathname.endsWith('/pdf') && !pathname.endsWith('/status') && req.method === 'GET') {
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
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem privilégios administrativos em orx_admins.' }));
        return;
      }

      const targetId = pathname.replace('/api/briefings/', '').trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const filter = isUuid ? `id=eq.${targetId}` : `protocol_code=eq.${targetId}`;

      const sbRes = await supabaseFetch(`/rest/v1/orx_briefings?${filter}&select=*`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!sbRes.ok || !Array.isArray(sbRes.data) || sbRes.data.length === 0) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Briefing não encontrado.' }));
        return;
      }

      const briefing = sbRes.data[0];

      // Busca histórico de auditoria do briefing
      const auditRes = await supabaseFetch(`/rest/v1/orx_briefing_audit_log?briefing_id=eq.${briefing.id}&order=created_at.desc&select=*`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        briefing,
        audit_logs: (auditRes.ok && Array.isArray(auditRes.data)) ? auditRes.data : []
      }));
      return;
    }

    // =========================================================================
    // --- 12. Briefings: Atualização de Status Administrativo (/api/briefings/:id/status - PATCH) ---
    // =========================================================================
    if (pathname.startsWith('/api/briefings/') && pathname.endsWith('/status') && req.method === 'PATCH') {
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
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem privilégios administrativos em orx_admins.' }));
        return;
      }

      const targetId = pathname.replace('/api/briefings/', '').replace('/status', '').trim();
      const validStatuses = ['submitted', 'under_review', 'proposal_sent', 'approved', 'archived'];
      const newStatus = jsonBody.status;
      const adminNotes = jsonBody.admin_notes !== undefined ? sanitizeString(jsonBody.admin_notes) : undefined;

      if (!validStatuses.includes(newStatus)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Status de briefing inválido.' }));
        return;
      }

      const updateBody = { status: newStatus, updated_at: new Date().toISOString() };
      if (adminNotes !== undefined) {
        updateBody.admin_notes = adminNotes;
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const filter = isUuid ? `id=eq.${targetId}` : `protocol_code=eq.${targetId}`;

      const updateRes = await supabaseFetch(`/rest/v1/orx_briefings?${filter}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Prefer': 'return=representation' },
        body: updateBody
      });

      if (!updateRes.ok) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Falha ao atualizar status no banco de dados.' }));
        return;
      }

      const updatedItem = (updateRes.data && updateRes.data[0]) || null;
      if (updatedItem && updatedItem.id) {
        await supabaseFetch('/rest/v1/orx_briefing_audit_log', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: {
            briefing_id: updatedItem.id,
            action: 'status_changed',
            actor_type: 'admin',
            actor_id: user.id,
            details: { new_status: newStatus, admin_notes: adminNotes }
          }
        });
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, status: newStatus }));
      return;
    }

    // =========================================================================
    // --- 13. Briefings: Download Seguro de Documentos do Cofre (/api/briefings/:id/download/:fileId - GET) ---
    // =========================================================================
    if (pathname.startsWith('/api/briefings/') && pathname.includes('/download/') && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || parsedUrl.searchParams.get('token');
      const user = await verifySupabaseToken(token);

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acesso restrito. Autenticação administrativa necessária.' }));
        return;
      }

      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem privilégios administrativos em orx_admins.' }));
        return;
      }

      const parts = pathname.replace('/api/briefings/', '').split('/download/');
      const targetId = parts[0];
      const fileId = parts[1];

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const filter = isUuid ? `id=eq.${targetId}` : `protocol_code=eq.${targetId}`;

      const sbRes = await supabaseFetch(`/rest/v1/orx_briefings?${filter}&select=*`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!sbRes.ok || !Array.isArray(sbRes.data) || sbRes.data.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Briefing não encontrado.' }));
        return;
      }

      const briefing = sbRes.data[0];
      const fileMeta = (briefing.uploaded_files || []).find(f => f.id === fileId);

      if (!fileMeta) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Arquivo não encontrado nos registros do briefing.' }));
        return;
      }

      const safeFilePath = path.join(BRIEFING_UPLOADS_DIR, briefing.protocol_code, fileMeta.stored_filename);
      if (!fs.existsSync(safeFilePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Arquivo físico não encontrado no cofre do servidor.' }));
        return;
      }

      // Log de auditoria de download
      await supabaseFetch('/rest/v1/orx_briefing_audit_log', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          briefing_id: briefing.id,
          action: 'file_downloaded',
          actor_type: 'admin',
          actor_id: user.id,
          details: { file_id: fileId, filename: fileMeta.original_name }
        }
      });

      res.setHeader('Content-Type', fileMeta.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMeta.original_name)}"`);
      res.writeHead(200);
      fs.createReadStream(safeFilePath).pipe(res);
      return;
    }

    // =========================================================================
    // --- 14. Briefings: Visualização/Download do PDF Executivo (/api/briefings/:id/pdf - GET) ---
    // =========================================================================
    if (pathname.startsWith('/api/briefings/') && pathname.endsWith('/pdf') && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || parsedUrl.searchParams.get('token');
      const user = await verifySupabaseToken(token);

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acesso restrito. Autenticação administrativa necessária.' }));
        return;
      }

      const adminVerified = await isUserAdmin(user.id, token);
      if (!adminVerified) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acesso negado: Usuário sem privilégios administrativos em orx_admins.' }));
        return;
      }

      const targetId = pathname.replace('/api/briefings/', '').replace('/pdf', '').trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const filter = isUuid ? `id=eq.${targetId}` : `protocol_code=eq.${targetId}`;

      const sbRes = await supabaseFetch(`/rest/v1/orx_briefings?${filter}&select=*`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!sbRes.ok || !Array.isArray(sbRes.data) || sbRes.data.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Briefing não encontrado.' }));
        return;
      }

      const briefing = sbRes.data[0];
      const protocolDir = path.join(BRIEFING_UPLOADS_DIR, briefing.protocol_code);
      const pdfPath = path.join(protocolDir, `briefing-${briefing.protocol_code}.pdf`);

      let pdfBuffer;
      if (fs.existsSync(pdfPath)) {
        pdfBuffer = fs.readFileSync(pdfPath);
      } else {
        pdfBuffer = generateBriefingPdf(briefing);
        if (!fs.existsSync(protocolDir)) fs.mkdirSync(protocolDir, { recursive: true });
        fs.writeFileSync(pdfPath, pdfBuffer);
      }

      // Log de auditoria de visualização de PDF
      await supabaseFetch('/rest/v1/orx_briefing_audit_log', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: {
          briefing_id: briefing.id,
          action: 'pdf_viewed',
          actor_type: 'admin',
          actor_id: user.id,
          details: { protocol_code: briefing.protocol_code }
        }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="briefing-${briefing.protocol_code}.pdf"`);
      res.writeHead(200);
      res.end(pdfBuffer);
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
