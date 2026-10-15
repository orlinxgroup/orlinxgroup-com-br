const https = require('https');

const payload = {
  protocol_code: 'BRF-2026-882194',
  company_name: 'ORLINX Homologação Comercial',
  trading_name: 'ORLINX Ads Hub',
  document_number: '12.345.678/0001-90',
  contact_name: 'Diretoria Executiva',
  email: 'comercial@orlinxgroup.com.br',
  phone: '(11) 98888-7777',
  city_state: 'São Paulo/SP',
  business_segment: 'Tecnologia & Publicidade Digital',
  project_type: 'Portal Corporativo',
  primary_goal: 'Geração de Leads Qualificados e Mídia ORLINX ADS',
  project_summary: 'Desenvolvimento do portal com integração completa ao Supabase e módulo de anúncios.',
  required_pages: ['Home', 'Quem Somos', 'Serviços', 'Briefing Digital', 'Contato'],
  custom_features: ['Integração com Supabase', 'Upload Seguro no Storage Vault', 'Notificação Instantânea'],
  brand_status: 'possui_marca_pronta',
  design_style: 'moderno_corporativo',
  color_palette: {
    primary: '#080E1E',
    secondary: '#2E1F1A',
    accent: '#D4AF37',
    avoid: '#FF0055'
  },
  domain_status: 'ja_registrado',
  domain_name: 'orlinxgroup.com.br',
  hosting_preference: 'hospedagem_orlinx',
  corporate_emails_needed: 5,
  ads_opt_in: true,
  ads_format: 'Topo Leaderboard (728 x 90 px)',
  ads_period_days: 60,
  ads_budget_range: 'R$ 3.000 a R$ 6.000',
  ads_target_url: 'https://www.orlinxgroup.com.br/anuncie',
  investment_bracket: 'R$ 6.000 a R$ 12.000',
  target_launch_date: '30 dias',
  uploaded_files: [
    { originalName: 'manual_identidade_visual_orlinx.pdf', category: 'Manual de Marca' }
  ],
  privacy_policy_accepted: true
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'www.orlinxgroup.com.br',
  port: 443,
  path: '/api/notify-briefing.php',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Origin': 'https://www.orlinxgroup.com.br'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status HTTP: ${res.statusCode} ${res.statusMessage}`);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Resposta Body:', body);
  });
});

req.on('error', (err) => {
  console.error('Erro de requisição:', err);
});

req.write(data);
req.end();
