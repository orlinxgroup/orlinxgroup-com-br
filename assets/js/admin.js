/**
 * ORLINX ADS - Painel Administrativo do Gestor
 * Autenticação Real no Servidor com Sessões Criptografadas
 * Banco de Dados Centralizado (Zero LocalStorage, Zero Senhas Fixas)
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'orx_auth_jwt_token';

  class OrlinxAdsAdmin {
    constructor() {
      this.token = sessionStorage.getItem(TOKEN_KEY) || '';
      this.currentUser = null;
      this.campaigns = [];
      this.orders = [];
      this.init();
    }

    async init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.checkAuthAndRender());
      } else {
        await this.checkAuthAndRender();
      }
    }

    async checkAuthAndRender() {
      if (!this.token) {
        this.renderLoginForm();
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();

        if (res.ok && data.authenticated) {
          this.currentUser = data.user;
          await this.loadDashboardData();
          this.renderDashboard();
        } else {
          this.logout();
        }
      } catch (err) {
        console.error('[Auth Check Error]', err);
        this.logout();
      }
    }

    async login(email, password) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
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
          return { success: false, error: data.error || 'Credenciais inválidas.' };
        }
      } catch (err) {
        return { success: false, error: 'Falha de comunicação com o servidor de autenticação.' };
      }
    }

    logout() {
      this.token = '';
      this.currentUser = null;
      sessionStorage.removeItem(TOKEN_KEY);
      this.renderLoginForm();
    }

    async loadDashboardData() {
      try {
        // Carrega campanhas da API centralizada
        const campsRes = await fetch('/api/campaigns?all=true');
        const campsData = await campsRes.json();
        this.campaigns = campsData.campaigns || [];

        // Carrega pedidos da API protegida
        const ordersRes = await fetch('/api/orders', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const ordersData = await ordersRes.json();
        this.orders = ordersData.orders || [];
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
            <div class="w-14 h-14 mx-auto rounded-2xl bg-[#2E1F1A] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-extrabold text-2xl mb-3 shadow-lg shadow-[#D4AF37]/15">
              OX
            </div>
            <h2 class="text-2xl font-bold text-[#FDFBF7] font-space">Autenticação do Gestor</h2>
            <p class="text-xs text-[#D3CBC3] mt-1">Acesso seguro com validação centralizada no servidor</p>
          </div>

          <form id="admin-login-form" class="space-y-4">
            <div>
              <label for="admin-email" class="block text-xs font-semibold text-[#FDFBF7] mb-1">E-mail Corporativo</label>
              <input type="email" id="admin-email" required placeholder="admin@orlinxgroup.com.br" class="w-full px-4 py-2.5 rounded-xl bg-[#080E1E] border border-[#4A332B] text-[#FDFBF7] placeholder-[#D3CBC3]/40 focus:outline-none focus:border-[#D4AF37] text-sm">
            </div>
            <div>
              <label for="admin-password" class="block text-xs font-semibold text-[#FDFBF7] mb-1">Senha de Acesso</label>
              <input type="password" id="admin-password" required placeholder="Digite sua credencial institucional" class="w-full px-4 py-2.5 rounded-xl bg-[#080E1E] border border-[#4A332B] text-[#FDFBF7] placeholder-[#D3CBC3]/40 focus:outline-none focus:border-[#D4AF37] text-sm">
            </div>
            <div id="login-error" class="hidden text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2.5 rounded-lg"></div>
            <button type="submit" id="btn-submit-login" class="w-full py-3 px-4 rounded-xl text-sm font-bold btn-gold shadow-lg shadow-[#D4AF37]/20 flex items-center justify-center gap-2">
              <span>&#128274;</span> Iniciar Sessão Segura &rarr;
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

      root.innerHTML = `
        <div class="space-y-8">
          <!-- Cabeçalho -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E3158]">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Sessão Autenticada no Servidor</span>
              </div>
              <h1 class="text-2xl font-bold text-[#FDFBF7] font-space mt-1">Console de Governança &bull; ORLINX ADS</h1>
              <p class="text-xs text-[#D3CBC3]">Conectado como: <strong>${this.escapeHtml(this.currentUser?.email || '')}</strong></p>
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
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Impressões Reais</span>
              <p class="text-2xl font-bold text-[#FDFBF7] mt-1">${totalImpressions.toLocaleString('pt-BR')}</p>
              <span class="text-[11px] text-emerald-400">Viewports Verificados</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#4A332B] bg-[#1F1511]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Cliques Consolidados</span>
              <p class="text-2xl font-bold text-[#D4AF37] mt-1">${totalClicks.toLocaleString('pt-BR')}</p>
              <span class="text-[11px] text-[#D3CBC3]">Sem Duplicidade</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">CTR Geral</span>
              <p class="text-2xl font-bold text-[#FDFBF7] mt-1">${ctr}%</p>
              <span class="text-[11px] text-[#D4AF37]">Taxa de Conversão</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#4A332B] bg-[#1F1511]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Campanhas Ativas</span>
              <p class="text-2xl font-bold text-emerald-400 mt-1">${activeCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Em Veiculação</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Análise Comercial</span>
              <p class="text-2xl font-bold text-[#D4AF37] mt-1">${pendingOrdersCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Pedidos Recebidos</span>
            </div>
          </div>

          <!-- Solicitações de Anunciantes (Dados do Banco) -->
          <div class="p-6 rounded-2xl border border-[#4A332B] bg-[#1F1511]/90 shadow-xl space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-[#FDFBF7] flex items-center gap-2">
                <span class="text-[#D4AF37]">&#9881;</span> Solicitações de Anúncio Recebidas
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
                      <td class="py-3 px-3 font-mono font-bold text-[#D4AF37]">${this.escapeHtml(o.orderId)}</td>
                      <td class="py-3 px-3">
                        <strong class="text-[#FDFBF7] block">${this.escapeHtml(o.companyName)}</strong>
                        <span class="text-[11px] text-[#D3CBC3]">${this.escapeHtml(o.email)} &bull; ${this.escapeHtml(o.phone)}</span>
                      </td>
                      <td class="py-3 px-3">
                        <span class="text-[#FDFBF7] block font-semibold">${this.escapeHtml(o.planName)}</span>
                        <span class="text-[#D4AF37] font-bold">R$ ${(o.amount || 0).toFixed(2).replace('.', ',')}</span>
                      </td>
                      <td class="py-3 px-3 max-w-xs truncate">
                        <a href="${this.escapeHtml(o.targetUrl)}" target="_blank" rel="noopener noreferrer" class="text-[#D4AF37] hover:underline">
                          ${this.escapeHtml(o.targetUrl)}
                        </a>
                      </td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${o.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#2E1F1A] text-[#D4AF37] border border-[#D4AF37]/50'}">
                          ${o.status === 'active' ? 'Ativo' : 'Em Análise'}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right">
                        ${o.status !== 'active' ? `
                          <button class="btn-approve-order px-3 py-1.5 rounded-lg text-xs font-bold btn-gold shadow" data-order-id="${this.escapeHtml(o.orderId)}">
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

          <!-- Campanhas em Veiculação -->
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
        </div>
      `;

      this.bindDashboardEvents();
    }

    bindDashboardEvents() {
      document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());

      document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        this.exportCSV();
      });

      document.querySelectorAll('.btn-approve-order').forEach(btn => {
        btn.addEventListener('click', async () => {
          const orderId = btn.getAttribute('data-order-id');
          await this.approveOrder(orderId);
        });
      });

      document.querySelectorAll('.btn-toggle-camp').forEach(btn => {
        btn.addEventListener('click', async () => {
          const campId = btn.getAttribute('data-camp-id');
          await this.toggleCampaign(campId);
        });
      });
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
      return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#39;';
          default: return m;
        }
      });
    }
  }

  window.OrlinxAdsAdmin = new OrlinxAdsAdmin();
})();
