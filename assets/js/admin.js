/**
 * ORLINX ADS & ORLINX GROUP - Painel Administrativo do Gestor
 * Projeto Oficial Exclusivo: ulajrvkaqqedwuaiaksp (https://ulajrvkaqqedwuaiaksp.supabase.co)
 * Autenticação Segura via Supabase Auth com Verificação em orx_admins
 * Gestão de Campanhas, Pedidos de Anúncios e Briefings Digitais de Websites
 * Políticas RLS Rigorosas (Zero Senhas Fixas, Zero LocalStorage)
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'orx_auth_jwt_token';
  const OFFICIAL_SUPABASE_URL = 'https://ulajrvkaqqedwuaiaksp.supabase.co';

  class OrlinxAdsAdmin {
    constructor() {
      this.supabaseUrl = window.ORLINX_SUPABASE_URL || OFFICIAL_SUPABASE_URL;
      this.supabaseAnonKey = window.ORLINX_SUPABASE_ANON_KEY || '';
      this.token = sessionStorage.getItem(TOKEN_KEY) || '';
      this.currentUser = null;
      this.campaigns = [];
      this.orders = [];
      this.briefings = [];
      this.activeTab = 'briefings'; // 'briefings', 'orders', 'campaigns'
      this.briefingFilter = 'all';
      this.briefingSearch = '';
      this.supabaseClient = null;
      this.init();
    }

    async init() {
      await this.loadRemoteConfig();
      this.initSupabaseClient();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.checkAuthAndRender());
      } else {
        await this.checkAuthAndRender();
      }
    }

    async loadRemoteConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.supabaseUrl) this.supabaseUrl = cfg.supabaseUrl;
          if (cfg.supabaseAnonKey) this.supabaseAnonKey = cfg.supabaseAnonKey;
        }
      } catch (e) {
        // Usa configurações do escopo do projeto
      }
    }

    initSupabaseClient() {
      try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient && this.supabaseAnonKey) {
          this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseAnonKey);
        }
      } catch (err) {
        console.warn('[Supabase Client Init]', err.message || err);
      }
    }

    async checkAuthAndRender() {
      // 1. Verificação via Supabase Auth
      if (this.supabaseClient) {
        try {
          const { data: { session } } = await this.supabaseClient.auth.getSession();
          if (session && session.user) {
            // Valida autorização do usuário na tabela de administradores
            const { data: adminRecord } = await this.supabaseClient
              .from('orx_admins')
              .select('role, is_active')
              .eq('user_id', session.user.id)
              .single();

            if (adminRecord && adminRecord.is_active && adminRecord.role === 'admin') {
              this.currentUser = { email: session.user.email, role: 'admin', provider: 'supabase' };
              this.token = session.access_token;
              sessionStorage.setItem(TOKEN_KEY, session.access_token);
              await this.loadDashboardData();
              this.renderDashboard();
              return;
            } else {
              await this.supabaseClient.auth.signOut();
            }
          }
        } catch (e) {
          console.warn('[Supabase Session Check]', e.message || e);
        }
      }

      // 2. Verificação via Sessão Segura da API
      if (this.token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${this.token}` }
          });
          const data = await res.json();

          if (res.ok && data.authenticated) {
            this.currentUser = data.user;
            await this.loadDashboardData();
            this.renderDashboard();
            return;
          }
        } catch (err) {
          console.error('[Auth Check Error]', err);
        }
      }

      this.logout();
    }

    async login(email, password) {
      const trimmedEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!trimmedEmail || !cleanPassword) {
        return { success: false, error: 'Por favor, informe e-mail e senha institucional.' };
      }

      // 1. Autenticação direta no Supabase Auth oficial (projeto ulajrvkaqqedwuaiaksp)
      if (this.supabaseClient) {
        try {
          const { data, error } = await this.supabaseClient.auth.signInWithPassword({
            email: trimmedEmail,
            password: cleanPassword
          });

          if (!error && data && data.session) {
            // Verificação rigorosa contra a tabela orx_admins
            const { data: adminRecord } = await this.supabaseClient
              .from('orx_admins')
              .select('role, is_active')
              .eq('user_id', data.user.id)
              .single();

            if (adminRecord && adminRecord.is_active && adminRecord.role === 'admin') {
              this.token = data.session.access_token;
              sessionStorage.setItem(TOKEN_KEY, this.token);
              this.currentUser = { email: data.user.email, role: 'admin', provider: 'supabase' };
              await this.loadDashboardData();
              this.renderDashboard();
              return { success: true };
            } else {
              await this.supabaseClient.auth.signOut();
              return {
                success: false,
                error: 'Acesso negado: Usuário autenticado, mas não cadastrado como administrador em orx_admins.'
              };
            }
          } else if (error) {
            return { success: false, error: error.message || 'Credenciais inválidas no Supabase Auth.' };
          }
        } catch (sbErr) {
          console.warn('[Supabase Auth attempt]', sbErr.message || sbErr);
        }
      }

      // 2. Gateway Seguro no Servidor
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password: cleanPassword })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          this.token = data.token;
          sessionStorage.setItem(TOKEN_KEY, data.token);
          this.currentUser = data.user;
          await this.loadDashboardData();
          this.renderDashboard();
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Acesso não autorizado. Credenciais inválidas.' };
        }
      } catch (err) {
        return { success: false, error: 'Falha de comunicação com o serviço de autenticação.' };
      }
    }

    async logout() {
      this.token = '';
      this.currentUser = null;
      sessionStorage.removeItem(TOKEN_KEY);

      if (this.supabaseClient) {
        try {
          await this.supabaseClient.auth.signOut();
        } catch (e) {}
      }

      this.renderLoginForm();
    }

    async loadDashboardData() {
      try {
        // Carrega campanhas da API protegida
        let campsData = null;
        try {
          const campsRes = await fetch('/api/campaigns.php?all=true', {
            headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
          });
          if (campsRes.ok) campsData = await campsRes.json();
        } catch (e) {}

        if (!campsData) {
          try {
            const campsRes = await fetch('/api/campaigns?all=true', {
              headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });
            if (campsRes.ok) campsData = await campsRes.json();
          } catch (e) {}
        }

        if (campsData && Array.isArray(campsData.campaigns) && campsData.campaigns.length > 0) {
          this.campaigns = campsData.campaigns;
        } else if (window.OrlinxAds && Array.isArray(window.OrlinxAds.campaigns)) {
          this.campaigns = window.OrlinxAds.campaigns;
        } else {
          this.campaigns = [];
        }

        // Carrega pedidos da API protegida
        const ordersRes = await fetch('/api/orders', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const ordersData = await ordersRes.json();
        this.orders = ordersData.orders || [];

        // Carrega briefings da API protegida
        const brfRes = await fetch('/api/briefings', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const brfData = await brfRes.json();
        this.briefings = brfData.briefings || [];
      } catch (e) {
        console.error('[Data Load Error]', e);
      }
    }

    renderLoginForm() {
      const root = document.getElementById('admin-app-root');
      if (!root) return;

      root.innerHTML = `
        <div class="max-w-md mx-auto my-16 p-8 rounded-3xl border border-[#4A332B] bg-[#1F1511]/95 shadow-2xl backdrop-blur-xl">
          <div class="text-center mb-6">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-[#2E1F1A] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-extrabold text-2xl mb-3 shadow-lg shadow-[#D4AF37]/15 font-space">
              OX
            </div>
            <h2 class="text-2xl font-bold text-[#FDFBF7] font-space">Autenticação do Gestor</h2>
            <p class="text-xs text-[#D3CBC3] mt-1">Supabase Auth &bull; ulajrvkaqqedwuaiaksp &bull; Tabela orx_admins</p>
          </div>

          <form id="admin-login-form" class="space-y-4">
            <div>
              <label for="admin-email" class="block text-xs font-semibold text-[#FDFBF7] mb-1">E-mail Corporativo</label>
              <input type="email" id="admin-email" required placeholder="admin@orlinxgroup.com.br" class="w-full px-4 py-2.5 rounded-xl bg-[#080E1E] border border-[#4A332B] text-[#FDFBF7] placeholder-[#D3CBC3]/40 focus:outline-none focus:border-[#D4AF37] text-sm">
            </div>
            <div>
              <label for="admin-password" class="block text-xs font-semibold text-[#FDFBF7] mb-1">Senha de Acesso</label>
              <input type="password" id="admin-password" required placeholder="Digite sua credencial cadastrada no Supabase" class="w-full px-4 py-2.5 rounded-xl bg-[#080E1E] border border-[#4A332B] text-[#FDFBF7] placeholder-[#D3CBC3]/40 focus:outline-none focus:border-[#D4AF37] text-sm">
            </div>
            <div id="login-error" class="hidden text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2.5 rounded-lg"></div>
            <button type="submit" id="btn-submit-login" class="w-full py-3 px-4 rounded-xl text-sm font-bold btn-gold shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2">
              <span>&#128274;</span> Acessar Painel com Supabase Auth &rarr;
            </button>
          </form>

          <div class="mt-6 pt-6 border-t border-[#4A332B]/60 text-center">
            <a href="/" class="text-xs text-[#D3CBC3] hover:text-[#D4AF37]">&larr; Retornar ao Portal Institucional</a>
          </div>
        </div>
      `;

      document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email')?.value;
        const password = document.getElementById('admin-password')?.value;
        const errEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('btn-submit-login');

        if (submitBtn) submitBtn.disabled = true;
        if (errEl) errEl.classList.add('hidden');

        const result = await this.login(email, password);
        if (!result.success) {
          if (errEl) {
            errEl.textContent = result.error;
            errEl.classList.remove('hidden');
          }
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    renderDashboard() {
      const root = document.getElementById('admin-app-root');
      if (!root) return;

      const totalImpressions = this.campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
      const totalClicks = this.campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0);
      const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
      const activeCount = this.campaigns.filter(c => c.status === 'active').length;
      const pendingOrdersCount = this.orders.filter(o => o.status === 'pending_review').length;
      const totalBriefingsCount = this.briefings.length;

      root.innerHTML = `
        <div class="space-y-8">
          <!-- Cabeçalho -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E3158]">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                  Autenticado &bull; Supabase ulajrvkaqqedwuaiaksp (orx_admins RLS)
                </span>
              </div>
              <h1 class="text-2xl font-bold text-[#FDFBF7] font-space mt-1">Console de Governança &bull; ORLINX GROUP</h1>
              <p class="text-xs text-[#D3CBC3]">Conectado como Administrador: <strong>${this.escapeHtml(this.currentUser?.email || '')}</strong></p>
            </div>
            <div class="flex items-center gap-3">
              <button id="btn-export-csv" class="px-3.5 py-2 rounded-xl text-xs font-semibold btn-coffee flex items-center gap-1.5">
                <span>&#128196;</span> Exportar CSV
              </button>
              <button id="btn-logout" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60">
                Encerrar Sessão
              </button>
            </div>
          </div>

          <!-- Métricas Centrais -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="p-5 rounded-2xl border border-[#D4AF37]/40 bg-[#0E1830]/90 shadow-lg">
              <span class="text-xs text-[#D4AF37] font-bold">Briefings de Sites</span>
              <p class="text-2xl font-bold text-[#FDFBF7] mt-1">${totalBriefingsCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Solicitações Recebidas</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#4A332B] bg-[#1F1511]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Pedidos de Anúncio</span>
              <p class="text-2xl font-bold text-[#D4AF37] mt-1">${pendingOrdersCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Em Análise Comercial</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Campanhas Ativas</span>
              <p class="text-2xl font-bold text-emerald-400 mt-1">${activeCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Em Rotação no Portal</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#4A332B] bg-[#1F1511]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Cliques Auditados</span>
              <p class="text-2xl font-bold text-[#D4AF37] mt-1">${totalClicks.toLocaleString('pt-BR')}</p>
              <span class="text-[11px] text-[#D3CBC3]">Anti-Fraude Ativo</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">CTR Consolidado</span>
              <p class="text-2xl font-bold text-[#FDFBF7] mt-1">${ctr}%</p>
              <span class="text-[11px] text-[#D4AF37]">${totalImpressions.toLocaleString('pt-BR')} views</span>
            </div>
          </div>

          <!-- Abas de Navegação -->
          <div class="flex flex-wrap items-center gap-2 border-b border-[#1E3158] pb-3">
            <button id="tab-btn-briefings" class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${this.activeTab === 'briefings' ? 'btn-gold shadow-md' : 'btn-coffee text-[#D3CBC3]'}">
              &#128196; Briefings de Websites (${this.briefings.length})
            </button>
            <button id="tab-btn-orders" class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${this.activeTab === 'orders' ? 'btn-gold shadow-md' : 'btn-coffee text-[#D3CBC3]'}">
              &#128227; Solicitações de Anúncio (${this.orders.length})
            </button>
            <button id="tab-btn-campaigns" class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${this.activeTab === 'campaigns' ? 'btn-gold shadow-md' : 'btn-coffee text-[#D3CBC3]'}">
              &#128225; Campanhas no Ar (${this.campaigns.length})
            </button>
          </div>

          <!-- Conteúdo da Aba Ativa -->
          <div id="tab-content-area">
            ${this.renderActiveTabContent()}
          </div>
        </div>

        <!-- Container do Modal Detalhado de Briefing -->
        <div id="briefing-modal-container"></div>
      `;

      this.bindDashboardEvents();
    }

    renderActiveTabContent() {
      if (this.activeTab === 'briefings') {
        return this.renderBriefingsTab();
      }
      if (this.activeTab === 'orders') {
        return this.renderOrdersTab();
      }
      if (this.activeTab === 'campaigns') {
        return this.renderCampaignsTab();
      }
      return '';
    }

    // --- ABA 1: BRIEFINGS DIGITAIS ---
    renderBriefingsTab() {
      let filtered = this.briefings;
      if (this.briefingFilter !== 'all') {
        filtered = filtered.filter(b => b.status === this.briefingFilter);
      }
      if (this.briefingSearch) {
        const q = this.briefingSearch.toLowerCase();
        filtered = filtered.filter(b =>
          (b.protocol_code && b.protocol_code.toLowerCase().includes(q)) ||
          (b.company_name && b.company_name.toLowerCase().includes(q)) ||
          (b.contact_name && b.contact_name.toLowerCase().includes(q)) ||
          (b.email && b.email.toLowerCase().includes(q))
        );
      }

      return `
        <div class="p-6 rounded-2xl border border-[#1E3158] bg-[#0E1830]/90 shadow-xl space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-[#FDFBF7] font-space flex items-center gap-2">
                <span class="text-[#D4AF37]">&#128196;</span> Briefings Digitais de Criação de Websites
              </h2>
              <p class="text-xs text-[#D3CBC3]">Gerenciamento de especificações recebidas, arquivos privados e relatórios executivos em PDF.</p>
            </div>

            <!-- Filtros -->
            <div class="flex items-center gap-3">
              <input type="text" id="briefing-search-input" value="${this.escapeHtml(this.briefingSearch)}" placeholder="Buscar por empresa, contato ou protocolo..." class="px-3 py-1.5 rounded-xl bg-[#080E1E] border border-[#1E3158] text-xs text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37] w-64">
              <select id="briefing-status-filter" class="px-3 py-1.5 rounded-xl bg-[#080E1E] border border-[#1E3158] text-xs text-[#D4AF37] focus:outline-none">
                <option value="all" ${this.briefingFilter === 'all' ? 'selected' : ''}>Todos os Status</option>
                <option value="submitted" ${this.briefingFilter === 'submitted' ? 'selected' : ''}>Recebido (submitted)</option>
                <option value="under_review" ${this.briefingFilter === 'under_review' ? 'selected' : ''}>Em Análise (under_review)</option>
                <option value="proposal_sent" ${this.briefingFilter === 'proposal_sent' ? 'selected' : ''}>Proposta Enviada (proposal_sent)</option>
                <option value="approved" ${this.briefingFilter === 'approved' ? 'selected' : ''}>Aprovado (approved)</option>
                <option value="archived" ${this.briefingFilter === 'archived' ? 'selected' : ''}>Arquivado (archived)</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-[#D3CBC3] border-collapse">
              <thead>
                <tr class="border-b border-[#1E3158] text-[#D4AF37] font-semibold">
                  <th class="py-3 px-3">Protocolo</th>
                  <th class="py-3 px-3">Empresa / Contato</th>
                  <th class="py-3 px-3">Tipo de Site</th>
                  <th class="py-3 px-3">ORLINX ADS</th>
                  <th class="py-3 px-3">Anexos</th>
                  <th class="py-3 px-3">Status</th>
                  <th class="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#1E3158]/60">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="7" class="py-8 text-center text-[#D3CBC3]/60">
                      Nenhum briefing encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ` : filtered.map(b => {
                  const filesCount = Array.isArray(b.uploaded_files) ? b.uploaded_files.length : 0;
                  const statusInfo = this.formatStatusBadge(b.status);
                  return `
                    <tr class="hover:bg-[#142244]/50 transition-colors">
                      <td class="py-3 px-3 font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                        ${this.escapeHtml(b.protocol_code)}
                        <span class="block text-[10px] text-[#D3CBC3] font-normal">${new Date(b.created_at).toLocaleDateString('pt-BR')}</span>
                      </td>
                      <td class="py-3 px-3">
                        <strong class="text-[#FDFBF7] block">${this.escapeHtml(b.company_name)}</strong>
                        <span class="text-[11px] text-[#D3CBC3]">${this.escapeHtml(b.contact_name)} &bull; ${this.escapeHtml(b.email)}</span>
                      </td>
                      <td class="py-3 px-3">
                        <span class="text-[#FDFBF7] block font-medium capitalize">${this.escapeHtml(b.project_type || 'institucional')}</span>
                        <span class="text-[10px] text-[#D3CBC3]">${this.escapeHtml(b.primary_goal || '')}</span>
                      </td>
                      <td class="py-3 px-3">
                        ${b.ads_opt_in ? `
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">
                            Sim (${this.escapeHtml(b.ads_format || 'anúncio')})
                          </span>
                        ` : `
                          <span class="text-[10px] text-[#D3CBC3]/60">Não</span>
                        `}
                      </td>
                      <td class="py-3 px-3">
                        <span class="text-xs font-semibold ${filesCount > 0 ? 'text-[#D4AF37]' : 'text-[#D3CBC3]/60'}">
                          ${filesCount} arquivo(s)
                        </span>
                      </td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.className}">
                          ${statusInfo.label}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-2">
                          <button class="btn-view-briefing px-3 py-1.5 rounded-lg text-xs font-bold btn-gold shadow" data-id="${this.escapeHtml(b.id || b.protocol_code)}">
                            Ver Detalhes
                          </button>
                          <a href="/api/briefings/${encodeURIComponent(b.id || b.protocol_code)}/pdf?token=${encodeURIComponent(this.token)}" target="_blank" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold btn-coffee" title="Baixar PDF do Briefing">
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // --- ABA 2: PEDIDOS DE ANÚNCIOS ---
    renderOrdersTab() {
      return `
        <div class="p-6 rounded-2xl border border-[#4A332B] bg-[#1F1511]/90 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-[#FDFBF7] flex items-center gap-2">
              <span class="text-[#D4AF37]">&#9881;</span> Solicitações de Anúncio Recebidas (Multi-Dispositivo)
            </h2>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#2E1F1A] border border-[#4A332B] text-[#D3CBC3] font-semibold">${this.orders.length} cadastros</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-[#D3CBC3] border-collapse">
              <thead>
                <tr class="border-b border-[#4A332B] text-[#D4AF37] font-semibold">
                  <th class="py-3 px-3">Código</th>
                  <th class="py-3 px-3">Empresa / Contato</th>
                  <th class="py-3 px-3">Plano Pretendido</th>
                  <th class="py-3 px-3">Destino do Banner</th>
                  <th class="py-3 px-3">Status</th>
                  <th class="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#4A332B]/60">
                ${this.orders.length === 0 ? `
                  <tr>
                    <td colspan="6" class="py-6 text-center text-[#D3CBC3]/60">Nenhum pedido de anunciante registrado no banco de dados.</td>
                  </tr>
                ` : this.orders.map(o => `
                  <tr class="hover:bg-[#2E1F1A]/50 transition-colors">
                    <td class="py-3 px-3 font-mono font-bold text-[#D4AF37]">${this.escapeHtml(o.orderId || o.order_code)}</td>
                    <td class="py-3 px-3">
                      <strong class="text-[#FDFBF7] block">${this.escapeHtml(o.companyName || o.company_name)}</strong>
                      <span class="text-[11px] text-[#D3CBC3]">${this.escapeHtml(o.email)} &bull; ${this.escapeHtml(o.phone)}</span>
                    </td>
                    <td class="py-3 px-3">
                      <span class="text-[#FDFBF7] block font-semibold">${this.escapeHtml(o.planName || o.plan_name)}</span>
                      <span class="text-[#D4AF37] font-bold">R$ ${(o.amount || 0).toFixed(2).replace('.', ',')}</span>
                    </td>
                    <td class="py-3 px-3 max-w-xs truncate">
                      <a href="${this.escapeHtml(o.targetUrl || o.target_url)}" target="_blank" rel="noopener noreferrer" class="text-[#D4AF37] hover:underline">
                        ${this.escapeHtml(o.targetUrl || o.target_url)}
                      </a>
                    </td>
                    <td class="py-3 px-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${o.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#2E1F1A] text-[#D4AF37] border border-[#D4AF37]/50'}">
                        ${o.status === 'active' ? 'Ativo' : 'Sob Análise'}
                      </span>
                    </td>
                    <td class="py-3 px-3 text-right">
                      ${o.status !== 'active' ? `
                        <button class="btn-approve-order px-3 py-1.5 rounded-lg text-xs font-bold btn-gold shadow" data-order-id="${this.escapeHtml(o.orderId || o.order_code)}">
                          Aprovar Campanha &rarr;
                        </button>
                      ` : `
                        <span class="text-xs text-emerald-400 font-semibold">Campanha Ativada</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // --- ABA 3: CAMPANHAS NO AR ---
    renderCampaignsTab() {
      return `
        <div class="p-6 rounded-2xl border border-[#1E3158] bg-[#0E1830]/90 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-[#FDFBF7] flex items-center gap-2">
              <span class="text-[#D4AF37]">&#128225;</span> Campanhas no Ar (Banco Centralizado)
            </h2>
            <span class="text-xs text-[#D3CBC3]">Total: ${this.campaigns.length} posições</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-[#D3CBC3] border-collapse">
              <thead>
                <tr class="border-b border-[#1E3158] text-[#D4AF37] font-semibold">
                  <th class="py-3 px-3">ID / Cliente</th>
                  <th class="py-3 px-3">Título da Mensagem</th>
                  <th class="py-3 px-3">Posição</th>
                  <th class="py-3 px-3">Impressões</th>
                  <th class="py-3 px-3">Cliques</th>
                  <th class="py-3 px-3">CTR</th>
                  <th class="py-3 px-3">Status</th>
                  <th class="py-3 px-3 text-right">Controle</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#1E3158]/60">
                ${this.campaigns.map(c => {
                  const cCtr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
                  return `
                    <tr class="hover:bg-[#142244]/50 transition-colors">
                      <td class="py-3 px-3">
                        <span class="font-mono text-[#D4AF37] font-bold block">${this.escapeHtml(c.id)}</span>
                        <span class="text-[#FDFBF7]">${this.escapeHtml(c.client_name || c.clientName)}</span>
                      </td>
                      <td class="py-3 px-3 max-w-xs truncate text-[#D3CBC3]">${this.escapeHtml(c.title)}</td>
                      <td class="py-3 px-3 font-mono text-[#D3CBC3]">${this.escapeHtml(c.slot)}</td>
                      <td class="py-3 px-3 font-bold text-[#FDFBF7]">${(c.impressions || 0).toLocaleString('pt-BR')}</td>
                      <td class="py-3 px-3 font-bold text-[#D4AF37]">${(c.clicks || 0).toLocaleString('pt-BR')}</td>
                      <td class="py-3 px-3 font-bold text-[#FDFBF7]">${cCtr}%</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}">
                          ${c.status === 'active' ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right">
                        <button class="btn-toggle-camp px-2.5 py-1 rounded-lg btn-coffee text-[11px]" data-camp-id="${this.escapeHtml(c.id)}">
                          ${c.status === 'active' ? 'Pausar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    bindDashboardEvents() {
      document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
      document.getElementById('btn-export-csv')?.addEventListener('click', () => this.exportCSV());

      // Alternador de Abas
      document.getElementById('tab-btn-briefings')?.addEventListener('click', () => {
        this.activeTab = 'briefings';
        this.renderDashboard();
      });
      document.getElementById('tab-btn-orders')?.addEventListener('click', () => {
        this.activeTab = 'orders';
        this.renderDashboard();
      });
      document.getElementById('tab-btn-campaigns')?.addEventListener('click', () => {
        this.activeTab = 'campaigns';
        this.renderDashboard();
      });

      // Filtros de Briefings
      document.getElementById('briefing-status-filter')?.addEventListener('change', (e) => {
        this.briefingFilter = e.target.value;
        const area = document.getElementById('tab-content-area');
        if (area) area.innerHTML = this.renderActiveTabContent();
        this.bindBriefingTabEvents();
      });

      document.getElementById('briefing-search-input')?.addEventListener('input', (e) => {
        this.briefingSearch = e.target.value;
        const area = document.getElementById('tab-content-area');
        if (area) area.innerHTML = this.renderActiveTabContent();
        this.bindBriefingTabEvents();
      });

      this.bindBriefingTabEvents();

      // Pedidos
      document.querySelectorAll('.btn-approve-order').forEach(btn => {
        btn.addEventListener('click', async () => {
          const orderId = btn.getAttribute('data-order-id');
          await this.approveOrder(orderId);
        });
      });

      // Campanhas
      document.querySelectorAll('.btn-toggle-camp').forEach(btn => {
        btn.addEventListener('click', async () => {
          const campId = btn.getAttribute('data-camp-id');
          await this.toggleCampaign(campId);
        });
      });
    }

    bindBriefingTabEvents() {
      document.querySelectorAll('.btn-view-briefing').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          await this.openBriefingDetail(id);
        });
      });
    }

    async openBriefingDetail(briefingId) {
      try {
        const res = await fetch(`/api/briefings/${encodeURIComponent(briefingId)}`, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();

        if (!res.ok || !data.success || !data.briefing) {
          alert('Não foi possível carregar os detalhes do briefing.');
          return;
        }

        this.renderBriefingModal(data.briefing, data.audit_logs || []);
      } catch (err) {
        console.error('Erro ao abrir briefing:', err);
        alert('Falha na comunicação com o servidor.');
      }
    }

    renderBriefingModal(b, auditLogs) {
      const container = document.getElementById('briefing-modal-container');
      if (!container) return;

      const files = Array.isArray(b.uploaded_files) ? b.uploaded_files : [];
      const statusInfo = this.formatStatusBadge(b.status);
      const cp = b.color_palette || {};

      container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true">
          <div class="bg-[#0E1830] border border-[#D4AF37]/60 rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            
            <!-- Cabeçalho do Modal -->
            <div class="flex items-center justify-between pb-4 border-b border-[#1E3158]">
              <div>
                <span class="text-xs uppercase font-mono tracking-wider text-[#D4AF37] font-bold">Protocolo: ${this.escapeHtml(b.protocol_code)}</span>
                <h2 class="text-xl font-bold text-[#FDFBF7] font-space">${this.escapeHtml(b.company_name)}</h2>
                <span class="text-xs text-[#D3CBC3]">Registrado em: ${new Date(b.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div class="flex items-center gap-3">
                <a href="/api/briefings/${encodeURIComponent(b.id)}/pdf?token=${encodeURIComponent(this.token)}" target="_blank" class="px-3 py-1.5 rounded-xl text-xs font-bold btn-gold shadow flex items-center gap-1.5">
                  <span>&#128196;</span> Baixar PDF Executivo
                </a>
                <button type="button" id="btn-close-briefing-modal" class="text-[#D3CBC3] hover:text-[#FDFBF7] text-xl font-bold px-2 py-1 rounded">
                  &#10005;
                </button>
              </div>
            </div>

            <!-- Badges de Consentimento LGPD -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-3 rounded-xl bg-[#080E1E] border border-emerald-500/40">
                <span class="text-emerald-400 font-bold block">&#10003; Termos e Privacidade (LGPD)</span>
                <span class="text-[#D3CBC3] text-[11px] block mt-0.5">
                  Aceite formalizado em: ${b.privacy_accepted_at ? new Date(b.privacy_accepted_at).toLocaleString('pt-BR') : 'Submissão'}
                </span>
                <span class="text-[10px] text-[#D3CBC3]/60 font-mono block truncate">Hash IP: ${this.escapeHtml(b.privacy_ip_hash || 'N/A')}</span>
              </div>

              <div class="p-3 rounded-xl bg-[#080E1E] border ${b.portfolio_showcase_authorized ? 'border-[#D4AF37]/50' : 'border-[#1E3158]'}">
                <span class="${b.portfolio_showcase_authorized ? 'text-[#D4AF37]' : 'text-[#D3CBC3]'} font-bold block">
                  ${b.portfolio_showcase_authorized ? '&#10003; Portfólio Autorizado' : '&#10007; Sigilo Corporativo (Sem Portfólio)'}
                </span>
                <span class="text-[#D3CBC3] text-[11px] block mt-0.5">
                  ${b.portfolio_showcase_authorized ? 'Cliente autorizou exibição no showcase da ORLINX.' : 'Projeto não deve ser exibido em portfólios públicos.'}
                </span>
              </div>
            </div>

            <!-- Grade das 10 Seções do Briefing -->
            <div class="space-y-4 text-xs">
              <!-- Seção 1: Institucional -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-1.5">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">1. Dados Institucionais & Contato</strong>
                <p><span class="text-[#D3CBC3]">Razão Social:</span> <span class="text-[#FDFBF7] font-semibold">${this.escapeHtml(b.company_name)}</span> ${b.trading_name ? `(${this.escapeHtml(b.trading_name)})` : ''}</p>
                <p><span class="text-[#D3CBC3]">CNPJ/CPF:</span> <span class="text-[#FDFBF7] font-mono">${this.escapeHtml(b.document_number)}</span></p>
                <p><span class="text-[#D3CBC3]">Responsável:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.contact_name)}</span> &bull; ${this.escapeHtml(b.email)} &bull; ${this.escapeHtml(b.phone)}</p>
                <p><span class="text-[#D3CBC3]">Localização / Segmento:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.city_state || 'N/I')} &bull; ${this.escapeHtml(b.business_segment || 'N/I')}</span></p>
              </div>

              <!-- Seção 2: Objetivos -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-1.5">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">2. Visão Geral & Objetivos</strong>
                <p><span class="text-[#D3CBC3]">Tipo de Projeto:</span> <span class="text-[#FDFBF7] font-semibold capitalize">${this.escapeHtml(b.project_type)}</span></p>
                <p><span class="text-[#D3CBC3]">Objetivo Principal:</span> <span class="text-[#FDFBF7] font-semibold">${this.escapeHtml(b.primary_goal)}</span></p>
                ${b.target_audience ? `<p><span class="text-[#D3CBC3]">Público-Alvo:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.target_audience)}</span></p>` : ''}
                ${b.project_summary ? `<p><span class="text-[#D3CBC3]">Resumo / Mensagem:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.project_summary)}</span></p>` : ''}
              </div>

              <!-- Seção 3: Escopo & Páginas -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-1.5">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">3. Escopo, Páginas & Recursos</strong>
                <p><span class="text-[#D3CBC3]">Páginas Previstas:</span> <span class="text-[#FDFBF7]">${Array.isArray(b.required_pages) ? b.required_pages.join(', ') : 'N/I'}</span></p>
                <p><span class="text-[#D3CBC3]">Funcionalidades:</span> <span class="text-[#FDFBF7]">${Array.isArray(b.custom_features) ? b.custom_features.join(', ') : 'Nenhuma'}</span></p>
                ${b.special_requirements ? `<p><span class="text-[#D3CBC3]">Requisitos Especiais:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.special_requirements)}</span></p>` : ''}
              </div>

              <!-- Seção 4: Design & Cores -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-1.5">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">4. Identidade Visual & Estilo</strong>
                <p><span class="text-[#D3CBC3]">Situação da Marca:</span> <span class="text-[#FDFBF7] capitalize">${this.escapeHtml(b.brand_status)}</span></p>
                <p><span class="text-[#D3CBC3]">Estilo Visual:</span> <span class="text-[#FDFBF7] capitalize">${this.escapeHtml(b.design_style)}</span></p>
                <div class="flex items-center gap-3 pt-1">
                  <span class="text-[#D3CBC3]">Paleta:</span>
                  <div class="flex items-center gap-1.5">
                    <span class="w-4 h-4 rounded border border-white/20" style="background-color: ${cp.primary || '#080E1E'}" title="Primária: ${cp.primary || ''}"></span>
                    <span class="w-4 h-4 rounded border border-white/20" style="background-color: ${cp.secondary || '#2E1F1A'}" title="Secundária: ${cp.secondary || ''}"></span>
                    <span class="w-4 h-4 rounded border border-white/20" style="background-color: ${cp.accent || '#D4AF37'}" title="Destaque: ${cp.accent || ''}"></span>
                    <span class="w-4 h-4 rounded border border-white/20" style="background-color: ${cp.avoid || '#FF0055'}" title="Evitar: ${cp.avoid || ''}"></span>
                  </div>
                  <span class="text-[10px] text-[#D3CBC3]">(${cp.primary || ''} / ${cp.secondary || ''} / ${cp.accent || ''})</span>
                </div>
                ${b.design_notes ? `<p><span class="text-[#D3CBC3]">Notas de Design:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.design_notes)}</span></p>` : ''}
              </div>

              <!-- Seção 5: Arquivos do Cofre Privado -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-2">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">5. Arquivos Anexados no Cofre Privado (${files.length})</strong>
                ${files.length === 0 ? `
                  <p class="text-[#D3CBC3]/60 italic">Nenhum documento anexado na submissão.</p>
                ` : `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${files.map(f => {
                      const sizeKb = f.size_bytes ? Math.round(f.size_bytes / 1024) : 0;
                      return `
                        <div class="p-2.5 rounded-lg bg-[#0E1830] border border-[#1E3158] flex items-center justify-between gap-2">
                          <div class="truncate">
                            <span class="font-bold text-[#FDFBF7] block truncate">${this.escapeHtml(f.original_name)}</span>
                            <span class="text-[10px] text-[#D4AF37] block uppercase font-mono">${this.escapeHtml(f.category || 'doc')} &bull; ${sizeKb} KB</span>
                          </div>
                          <a href="/api/briefings/${encodeURIComponent(b.id)}/download/${encodeURIComponent(f.id)}?token=${encodeURIComponent(this.token)}" target="_blank" class="px-2.5 py-1 rounded bg-[#142244] border border-[#1E3158] text-[#D4AF37] hover:bg-[#1E3158] text-[11px] font-bold">
                            Baixar
                          </a>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>

              <!-- Seção 9: Módulo ORLINX ADS -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-1.5">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">9. Publicidade ORLINX ADS</strong>
                <p><span class="text-[#D3CBC3]">Solicitou Campanha:</span> <strong class="${b.ads_opt_in ? 'text-[#D4AF37]' : 'text-[#D3CBC3]'}">${b.ads_opt_in ? 'SIM' : 'NÃO'}</strong></p>
                ${b.ads_opt_in ? `
                  <p><span class="text-[#D3CBC3]">Formato Pretendido:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.ads_format || 'N/I')}</span> &bull; Período: ${b.ads_period_days || 30} dias</p>
                  <p><span class="text-[#D3CBC3]">Orçamento:</span> <span class="text-[#FDFBF7]">${this.escapeHtml(b.ads_budget_range || 'N/I')}</span></p>
                  ${b.ads_target_url ? `<p><span class="text-[#D3CBC3]">URL de Destino:</span> <a href="${this.escapeHtml(b.ads_target_url)}" target="_blank" class="text-[#D4AF37] hover:underline">${this.escapeHtml(b.ads_target_url)}</a></p>` : ''}
                ` : ''}
              </div>

              <!-- Seção 10: Prazos e Faixa Orçamentária -->
              <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-1.5">
                <strong class="text-[#D4AF37] uppercase tracking-wider text-[11px] block">10. Prazos & Investimento</strong>
                <p><span class="text-[#D3CBC3]">Previsão de Lançamento:</span> <span class="text-[#FDFBF7] font-semibold">${b.target_launch_date ? new Date(b.target_launch_date).toLocaleDateString('pt-BR') : 'Flexível'}</span></p>
                <p><span class="text-[#D3CBC3]">Faixa de Investimento:</span> <span class="text-[#FDFBF7] font-semibold">${this.escapeHtml(b.investment_bracket || 'A definir na proposta')}</span></p>
              </div>
            </div>

            <!-- Painel de Alteração de Status Administrativo -->
            <div class="p-4 rounded-xl bg-[#1F1511] border border-[#4A332B] space-y-3">
              <strong class="text-[#D4AF37] uppercase tracking-wider text-xs block">Gestão e Atualização de Status</strong>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="modal-status-select" class="block text-xs font-semibold text-[#FDFBF7] mb-1">Status Atual</label>
                  <select id="modal-status-select" class="w-full px-3 py-2 rounded-xl bg-[#080E1E] border border-[#4A332B] text-xs text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37]">
                    <option value="submitted" ${b.status === 'submitted' ? 'selected' : ''}>Recebido (submitted)</option>
                    <option value="under_review" ${b.status === 'under_review' ? 'selected' : ''}>Em Análise Técnica (under_review)</option>
                    <option value="proposal_sent" ${b.status === 'proposal_sent' ? 'selected' : ''}>Proposta Enviada (proposal_sent)</option>
                    <option value="approved" ${b.status === 'approved' ? 'selected' : ''}>Aprovado / Em Desenvolvimento (approved)</option>
                    <option value="archived" ${b.status === 'archived' ? 'selected' : ''}>Arquivado (archived)</option>
                  </select>
                </div>
                <div>
                  <label for="modal-admin-notes" class="block text-xs font-semibold text-[#D3CBC3] mb-1">Notas Internas do Gestor</label>
                  <textarea id="modal-admin-notes" rows="2" class="w-full px-3 py-1.5 rounded-xl bg-[#080E1E] border border-[#4A332B] text-xs text-[#FDFBF7] focus:outline-none focus:border-[#D4AF37]">${this.escapeHtml(b.admin_notes || '')}</textarea>
                </div>
              </div>
              <div class="flex justify-end">
                <button type="button" id="btn-save-briefing-status" class="px-4 py-2 rounded-xl text-xs font-bold btn-gold shadow" data-id="${this.escapeHtml(b.id)}">
                  Salvar Alterações de Status &rarr;
                </button>
              </div>
            </div>

            <!-- Histórico de Auditoria -->
            <div class="p-4 rounded-xl bg-[#080E1E] border border-[#1E3158] space-y-2">
              <strong class="text-[#D3CBC3] uppercase tracking-wider text-[11px] block">Trilha de Auditoria do Briefing (${auditLogs.length} eventos)</strong>
              <div class="space-y-1.5 max-h-36 overflow-y-auto">
                ${auditLogs.length === 0 ? `
                  <p class="text-[11px] text-[#D3CBC3]/60 italic">Nenhum evento registrado.</p>
                ` : auditLogs.map(l => `
                  <div class="text-[11px] text-[#D3CBC3] flex items-center justify-between border-b border-[#1E3158]/40 py-1">
                    <span>
                      <strong class="text-[#D4AF37]">${this.escapeHtml(l.action)}</strong> 
                      por <span class="capitalize">${this.escapeHtml(l.actor_type)}</span>
                    </span>
                    <span class="text-[10px] text-[#D3CBC3]/60">${new Date(l.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>
        </div>
      `;

      // Eventos do Modal
      document.getElementById('btn-close-briefing-modal')?.addEventListener('click', () => {
        container.innerHTML = '';
      });

      document.getElementById('btn-save-briefing-status')?.addEventListener('click', async () => {
        const newStatus = document.getElementById('modal-status-select').value;
        const notes = document.getElementById('modal-admin-notes').value;
        await this.updateBriefingStatus(b.id, newStatus, notes);
      });
    }

    async updateBriefingStatus(briefingId, newStatus, adminNotes) {
      try {
        const res = await fetch(`/api/briefings/${encodeURIComponent(briefingId)}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({ status: newStatus, admin_notes: adminNotes })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert('Status do briefing atualizado com sucesso!');
          document.getElementById('briefing-modal-container').innerHTML = '';
          await this.loadDashboardData();
          this.renderDashboard();
        } else {
          alert(data.error || 'Erro ao atualizar status.');
        }
      } catch (err) {
        alert('Falha na comunicação com o servidor.');
      }
    }

    formatStatusBadge(status) {
      switch (status) {
        case 'submitted':
          return { label: 'Recebido', className: 'bg-[#2E1F1A] text-[#D4AF37] border-[#D4AF37]/50' };
        case 'under_review':
          return { label: 'Em Análise', className: 'bg-amber-950 text-amber-300 border-amber-800' };
        case 'proposal_sent':
          return { label: 'Proposta Enviada', className: 'bg-blue-950 text-blue-300 border-blue-800' };
        case 'approved':
          return { label: 'Aprovado', className: 'bg-emerald-950 text-emerald-400 border-emerald-800' };
        case 'archived':
          return { label: 'Arquivado', className: 'bg-slate-900 text-slate-400 border-slate-700' };
        default:
          return { label: status || 'Pendente', className: 'bg-slate-800 text-slate-300 border-slate-700' };
      }
    }

    async approveOrder(orderId) {
      if (!confirm(`Confirmar autorização e publicação da campanha para o pedido ${orderId}?`)) return;

      try {
        const res = await fetch('/api/orders/approve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({ orderId })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert(`Campanha ${orderId} autorizada com sucesso no banco de dados!`);
          await this.loadDashboardData();
          this.renderDashboard();
        } else {
          alert(data.error || 'Erro ao aprovar pedido.');
        }
      } catch (err) {
        alert('Falha ao comunicar com o servidor.');
      }
    }

    async toggleCampaign(campId) {
      try {
        const res = await fetch('/api/campaigns/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({ id: campId })
        });

        if (res.ok) {
          await this.loadDashboardData();
          this.renderDashboard();
        }
      } catch (err) {
        alert('Erro ao alterar status da campanha.');
      }
    }

    exportCSV() {
      if (this.activeTab === 'briefings') {
        let csv = 'Protocolo;Empresa;Contato;Email;Telefone;TipoProjeto;Objetivo;AdsOptIn;Status;CriadoEm\n';
        this.briefings.forEach(b => {
          csv += `"${b.protocol_code}";"${b.company_name}";"${b.contact_name}";"${b.email}";"${b.phone}";"${b.project_type}";"${b.primary_goal}";${b.ads_opt_in ? 'SIM' : 'NAO'};"${b.status}";"${b.created_at}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orlinx_briefings_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      let csv = 'ID;Cliente;Slot;Status;Impressoes;Cliques;CTR_Porcento\n';
      this.campaigns.forEach(c => {
        const cCtr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
        csv += `${c.id};"${c.client_name || c.clientName}";${c.slot};${c.status};${c.impressions || 0};${c.clicks || 0};${cCtr}%\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `orlinx_ads_metricas_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    escapeHtml(str) {
      if (!str || typeof str !== 'string') return '';
      return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m]);
    }
  }

  window.OrlinxAdsAdmin = new OrlinxAdsAdmin();
})();
