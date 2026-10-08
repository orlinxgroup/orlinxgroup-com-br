/**
 * ORLINX GROUP & ORLINX ADS - Servidor Backend & Gateway de API
 * Autenticação Segura, Sessões Criptografadas, Validação Rigorosa de Uploads e Integração com Banco Centralizado
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// Configurações do Servidor
// Segredo HMAC do servidor para emissão de sessões seguras (persistente na execução)
const SERVER_SESSION_SECRET = process.env.ORLINX_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Credenciais Administrativas do Servidor (Protegidas no ambiente, nunca no cliente)
const ADMIN_EMAIL = process.env.ORLINX_ADMIN_EMAIL || 'admin@orlinxgroup.com.br';
// Hash PBKDF2 da senha de governança (senha administrativa configurável via variável de ambiente)
// Padrão de desenvolvimento local: definida com salt seguro
const ADMIN_SALT = process.env.ORLINX_ADMIN_SALT || 'orlinx_secure_salt_2026';
const ADMIN_PASS_HASH = crypto.pbkdf2Sync(
  process.env.ORLINX_ADMIN_PASSWORD || 'OrlinxGov@2026#Secure',
  ADMIN_SALT,
  100000,
  64,
  'sha512'
).toString('hex');

// Banco de dados centralizado / persistente em sandbox (espelho local do schema Supabase)
const DB_FILE = path.join(ROOT, 'data', 'ads_database.json');
function initDatabase() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      campaigns: [
        {
          id: 'orx-slot-topo',
          campaign_code: 'CAMP-001',
          client_name: 'Espaço Disponível • ORLINX ADS',
          title: 'Posicione sua Empresa no Topo do Portal ORLINX GROUP',
          slot: 'top-leaderboard',
          banner_url: '',
          target_url: 'https://orlinxgroup.com.br/anuncie.html',
          cta_text: 'Anuncie Conosco',
          status: 'active',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          impressions: 0,
          clicks: 0
        },
        {
          id: 'orx-slot-feed',
          campaign_code: 'CAMP-002',
          client_name: 'ORLINX GROUP Institucional',
          title: 'Infraestrutura Corporativa, Consultoria Estratégica e Tecnologia Orbital',
          slot: 'feed-billboard',
          banner_url: '',
          target_url: 'https://orlinxgroup.com.br/anuncie.html',
          cta_text: 'Conhecer a Rede',
          status: 'active',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          impressions: 0,
          clicks: 0
        },
        {
          id: 'orx-slot-lateral',
          campaign_code: 'CAMP-003',
          client_name: 'Vitrine de Anunciantes • ORLINX ADS',
          title: 'Destaque seus Serviços B2B para Empresas e Decisores',
          slot: 'sidebar-box',
          banner_url: '',
          target_url: 'https://orlinxgroup.com.br/anuncie.html',
          cta_text: 'Ver Formatos',
          status: 'active',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          impressions: 0,
          clicks: 0
        }
      ],
      orders: [],
      telemetry: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}
initDatabase();

function readDatabase() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { campaigns: [], orders: [], telemetry: [] };
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[DB Write Error]', e);
  }
}

// Funções de Autenticação Segura
function generateSessionToken(email) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: email,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h de validade
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', SERVER_SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SERVER_SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expirado
    }
    return data;
  } catch (e) {
    return null;
  }
}

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

// Manipulador de Requisições HTTP
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

  // Coleta do Body JSON
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) { // Limite de 5MB
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload muito grande.' }));
      req.destroy();
    }
  });

  req.on('end', () => {
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

    // --- 1. Autenticação: Login ---
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const email = (jsonBody.email || '').trim().toLowerCase();
      const password = (jsonBody.password || '').trim();

      if (!email || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'E-mail e senha são obrigatórios.' }));
        return;
      }

      // Validação criptográfica de credenciais
      const allowedEmails = [ADMIN_EMAIL.toLowerCase(), 'ejr@orlinxgroup.com'];
      const testHash = crypto.pbkdf2Sync(password, ADMIN_SALT, 100000, 64, 'sha512').toString('hex');
      const isValid = (allowedEmails.includes(email) && crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(ADMIN_PASS_HASH)));

      if (!isValid) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas ou acesso não autorizado.' }));
        return;
      }

      const token = generateSessionToken(email);
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        token,
        user: { email, role: 'admin' }
      }));
      return;
    }

    // --- 2. Autenticação: Validação de Sessão Atual (/api/auth/me) ---
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const session = verifySessionToken(token);

      if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ authenticated: false, error: 'Sessão inválida ou expirada.' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ authenticated: true, user: { email: session.sub, role: session.role } }));
      return;
    }

    // --- 3. Campanhas: Leitura Pública (/api/campaigns) ---
    if (pathname === '/api/campaigns' && req.method === 'GET') {
      const db = readDatabase();
      const activeOnly = parsedUrl.searchParams.get('all') !== 'true';

      const campaigns = activeOnly 
        ? db.campaigns.filter(c => c.status === 'active')
        : db.campaigns;

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, campaigns }));
      return;
    }

    // --- 4. Campanhas: Gestão Administrativa (/api/campaigns/toggle) ---
    if (pathname === '/api/campaigns/toggle' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const session = verifySessionToken(authHeader.replace(/^Bearer\s+/i, ''));
      if (!session) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Acesso restrito ao administrador.' }));
        return;
      }

      const campId = jsonBody.id;
      const db = readDatabase();
      const camp = db.campaigns.find(c => c.id === campId);
      if (!camp) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Campanha não encontrada.' }));
        return;
      }

      camp.status = camp.status === 'active' ? 'paused' : 'active';
      writeDatabase(db);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, campaign: camp }));
      return;
    }

    // --- 5. Pedidos: Cadastro de Anunciante (/api/orders) ---
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
        master: { name: 'Plano Master', price: 790.00, slot: 'top-leaderboard' }
      };

      if (!validPlans[planKey]) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Plano selecionado inválido.' }));
        return;
      }

      // Validação de upload de imagem em Base64
      let safeBannerUrl = '';
      if (bannerData) {
        const matches = bannerData.match(/^data:(image\/(png|jpeg|webp|gif));base64,/);
        if (!matches) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Formato de banner inválido. Apenas PNG, JPEG ou WebP são permitidos.' }));
          return;
        }
        // Validação de tamanho (máximo 2.5MB em base64)
        if (bannerData.length > 3.5 * 1024 * 1024) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Arquivo excede o limite de 2MB.' }));
          return;
        }
        safeBannerUrl = bannerData;
      }

      const orderCode = 'ORX-' + crypto.randomInt(100000, 999999);
      const plan = validPlans[planKey];

      const newOrder = {
        orderId: orderCode,
        companyName,
        documentNumber,
        email,
        phone,
        planKey,
        planName: plan.name,
        amount: plan.price,
        slot: plan.slot,
        targetUrl,
        bannerUrl: safeBannerUrl,
        status: 'pending_review', // Em análise comercial formal
        createdAt: new Date().toISOString()
      };

      const db = readDatabase();
      db.orders.unshift(newOrder);
      writeDatabase(db);

      // Resposta segura: Checkout automatizado desativado até fornecimento de dados fiscais/bancários oficiais
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        orderId: orderCode,
        status: 'pending_review',
        message: 'Solicitação registrada com sucesso no banco de dados. Os dados comerciais e faturamento serão processados após homologação oficial da campanha.'
      }));
      return;
    }

    // --- 6. Pedidos: Listagem e Gestão Administrativa (/api/orders) ---
    if (pathname === '/api/orders' && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const session = verifySessionToken(authHeader.replace(/^Bearer\s+/i, ''));
      if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Acesso restrito ao administrador. Autenticação necessária.' }));
        return;
      }

      const db = readDatabase();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, orders: db.orders }));
      return;
    }

    // --- 7. Pedidos: Aprovação pelo Gestor (/api/orders/approve) ---
    if (pathname === '/api/orders/approve' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      const session = verifySessionToken(authHeader.replace(/^Bearer\s+/i, ''));
      if (!session) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Acesso restrito ao administrador. Autenticação necessária.' }));
        return;
      }

      const orderId = jsonBody.orderId;
      const db = readDatabase();
      const order = db.orders.find(o => o.orderId === orderId);
      if (!order) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Pedido não encontrado.' }));
        return;
      }

      order.status = 'active';

      // Cria a campanha correspondente ativa
      const newCampaign = {
        id: 'camp-' + order.orderId,
        campaign_code: 'CAMP-' + order.orderId,
        client_name: order.companyName,
        title: `${order.companyName} • Anúncio Corporativo`,
        slot: order.slot,
        banner_url: order.bannerUrl,
        target_url: order.targetUrl,
        cta_text: 'Acessar Empresa',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        impressions: 0,
        clicks: 0
      };

      db.campaigns.unshift(newCampaign);
      writeDatabase(db);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, campaign: newCampaign }));
      return;
    }

    // --- 8. Telemetria: Registro Real de Impressões e Cliques (/api/telemetry) ---
    if (pathname === '/api/telemetry' && req.method === 'POST') {
      const { campaignId, type } = jsonBody; // 'impression' ou 'click'
      if (!campaignId || !['impression', 'click'].includes(type)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Parâmetros de telemetria inválidos.' }));
        return;
      }

      const db = readDatabase();
      const camp = db.campaigns.find(c => c.id === campaignId);
      if (camp) {
        if (type === 'impression') {
          camp.impressions = (camp.impressions || 0) + 1;
        } else if (type === 'click') {
          camp.clicks = (camp.clicks || 0) + 1;
        }
        writeDatabase(db);
      }

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
  console.log(`ORLINX ADS Backend & Preview Server ativo em http://127.0.0.1:${PORT}`);
});
