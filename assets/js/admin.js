/**
 * ORLINX ADS - Painel Administrativo de Campanhas e Telemetria
 * Paleta Oficial: Azul-Marinho, Marrom Café, Dourado e Marfim
 */

(function () {
  'use strict';

  // Hash SHA-256 do PIN mestre ("orlinx2026")
  const ADMIN_PIN_HASH = '1f654dfbb48d8a7065f6c8d2089f816c7cf6bb911488c2794eb8e3a2c49fa5eb';
  const SESSION_AUTH_KEY = 'orx_admin_authenticated';

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  class OrlinxAdsAdmin {
    constructor() {
      this.campaigns = this.loadCampaigns();
      this.orders = this.loadOrders();
      this.init();
    }

    loadCampaigns() {
      try {
        return JSON.parse(localStorage.getItem('orx_ads_campaigns') || '[]');
      } catch (e) {
        return [];
      }
    }

    saveCampaigns(camps) {
      localStorage.setItem('orx_ads_campaigns', JSON.stringify(camps));
      this.campaigns = camps;
      window.dispatchEvent(new CustomEvent('orlinx_ads_updated', { detail: { campaigns: camps } }));
    }

    loadOrders() {
      try {
        return JSON.parse(localStorage.getItem('orx_ads_orders') || '[]');
      } catch (e) {
        return [];
      }
    }

    saveOrders(orders) {
      localStorage.setItem('orx_ads_orders', JSON.stringify(orders));
      this.orders = orders;
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.checkAuthAndRender());
      } else {
        this.checkAuthAndRender();
      }
    }

    isAuthenticated() {
      return sessionStorage.getItem(SESSION_AUTH_KEY) === 'true';
    }

    async authenticate(pinInput) {
      const hash = await sha256(pinInput.trim());
      if (hash === ADMIN_PIN_HASH || pinInput.trim() === 'orlinx2026') {
        sessionStorage.setItem(SESSION_AUTH_KEY, 'true');
        this.renderDashboard();
        return true;
      }
      return false;
    }

    logout() {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      this.renderLoginForm();
    }

    checkAuthAndRender() {
      if (this.isAuthenticated()) {
        this.renderDashboard();
      } else {
        this.renderLoginForm();
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
            <h2 class="text-2xl font-bold text-[#FDFBF7] font-space">Console Administrativo</h2>
            <p class="text-xs text-[#D3CBC3] mt-1">Gestão de Campanhas &bull; ORLINX ADS</p>
          </div>

          <form id="admin-login-form" class="space-y-4">
            <div>
              <label for="admin-pin" class="block text-xs font-semibold text-[#FDFBF7] mb-1">Senha de Acesso / PIN Master</label>
              <input type="password" id="admin-pin" required placeholder="Digite a credencial de gestor" class="w-full px-4 py-2.5 rounded-xl bg-[#080E1E] border border-[#4A332B] text-[#FDFBF7] placeholder-[#D3CBC3]/40 focus:outline-none focus:border-[#D4AF37] text-sm">
            </div>
            <div id="login-error" class="hidden text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2.5 rounded-lg">
              Senha incorreta. Verifique os dados de acesso.
            </div>
            <button type="submit" class="w-full py-3 px-4 rounded-xl text-sm font-bold btn-gold shadow-lg shadow-[#D4AF37]/20">
              Autenticar Console &rarr;
            </button>
          </form>

          <div class="mt-6 pt-6 border-t border-[#4A332B]/60 text-center">
            <a href="/" class="text-xs text-[#D3CBC3] hover:text-[#D4AF37]">&larr; Retornar ao Portal Institucional</a>
          </div>
        </div>
      `;

      document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('admin-pin')?.value;
        const errEl = document.getElementById('login-error');
        const success = await this.authenticate(pin);
        if (!success && errEl) {
          errEl.classList.remove('hidden');
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
      const pendingOrdersCount = this.orders.filter(o => o.status === 'pending_payment').length;

      root.innerHTML = `
        <div class="space-y-8">
          <!-- Header do Dashboard -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E3158]">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Gestor Autenticado</span>
              </div>
              <h1 class="text-2xl font-bold text-[#FDFBF7] font-space mt-1">Console de Mídia & Telemetria ORLINX ADS</h1>
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

          <!-- Cards de Métricas Reais -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Impressões Reais</span>
              <p class="text-2xl font-bold text-[#FDFBF7] mt-1">${totalImpressions.toLocaleString('pt-BR')}</p>
              <span class="text-[11px] text-emerald-400">Viewports Ativos</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#4A332B] bg-[#1F1511]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Cliques Consolidados</span>
              <p class="text-2xl font-bold text-[#D4AF37] mt-1">${totalClicks.toLocaleString('pt-BR')}</p>
              <span class="text-[11px] text-[#D3CBC3]">Sem Duplicidade</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Taxa de CTR</span>
              <p class="text-2xl font-bold text-[#FDFBF7] mt-1">${ctr}%</p>
              <span class="text-[11px] text-[#D4AF37]">Média de Conversão</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#4A332B] bg-[#1F1511]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Campanhas no Ar</span>
              <p class="text-2xl font-bold text-emerald-400 mt-1">${activeCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Slots Ativos</span>
            </div>
            <div class="p-5 rounded-2xl border border-[#1E3158] bg-[#0E1830]/80 shadow-lg">
              <span class="text-xs text-[#D3CBC3] font-medium">Aguardando Pix</span>
              <p class="text-2xl font-bold text-[#D4AF37] mt-1">${pendingOrdersCount}</p>
              <span class="text-[11px] text-[#D3CBC3]">Solicitações Novas</span>
            </div>
          </div>

          <!-- Solicitações Pendentes de Anunciantes -->
          <div class="p-6 rounded-2xl border border-[#4A332B] bg-[#1F1511]/90 shadow-xl space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold text-[#FDFBF7] flex items-center gap-2">
                <span class="text-[#D4AF37]">&#9881;</span> Solicitações de Anúncio Recebidas
              </h2>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#2E1F1A] border border-[#4A332B] text-[#D3CBC3] font-semibold">${this.orders.length} pedidos</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-[#D3CBC3] border-collapse">
                <thead>
                  <tr class="border-b border-[#4A332B] text-[#D4AF37] font-semibold">
                    <th class="py-3 px-3">Pedido</th>
                    <th class="py-3 px-3">Empresa / Contato</th>
                    <th class="py-3 px-3">Plano & Valor</th>
                    <th class="py-3 px-3">Slot</th>
                    <th class="py-3 px-3">Status</th>
                    <th class="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#4A332B]/60">
                  ${this.orders.length === 0 ? `
                    <tr>
                      <td colspan="6" class="py-6 text-center text-[#D3CBC3]/60">Nenhuma solicitação de anunciante pendente no momento.</td>
                    </tr>
                  ` : this.orders.map(o => `
                    <tr class="hover:bg-[#2E1F1A]/50 transition-colors">
                      <td class="py-3 px-3 font-mono font-bold text-[#D4AF37]">${o.orderId}</td>
                      <td class="py-3 px-3">
                        <strong class="text-[#FDFBF7] block">${o.companyName}</strong>
                        <span class="text-[11px] text-[#D3CBC3]">${o.email} &bull; ${o.phone}</span>
                      </td>
                      <td class="py-3 px-3">
                        <span class="text-[#FDFBF7] block font-semibold">${o.planName}</span>
                        <span class="text-[#D4AF37] font-bold">R$ ${(o.amount || 0).toFixed(2).replace('.', ',')}</span>
                      </td>
                      <td class="py-3 px-3 font-mono text-[#D3CBC3]">${o.slot}</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${o.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-[#2E1F1A] text-[#D4AF37] border border-[#D4AF37]/50'}">
                          ${o.status === 'active' ? 'Ativo' : 'Aguardando Pix'}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right">
                        ${o.status !== 'active' ? `
                          <button class="btn-approve-order px-3 py-1.5 rounded-lg text-xs font-bold btn-gold shadow" data-order-id="${o.orderId}">
                            Aprovar & Ativar &rarr;
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
                <span class="text-[#D4AF37]">&#128225;</span> Campanhas e Banners no Ar
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
                          <span class="font-mono text-[#D4AF37] font-bold block">${c.id}</span>
                          <span class="text-[#FDFBF7]">${c.clientName}</span>
                        </td>
                        <td class="py-3 px-3 max-w-xs truncate text-[#D3CBC3]">${c.title}</td>
                        <td class="py-3 px-3 font-mono text-[#D3CBC3]">${c.slot}</td>
                        <td class="py-3 px-3 font-bold text-[#FDFBF7]">${(c.impressions || 0).toLocaleString('pt-BR')}</td>
                        <td class="py-3 px-3 font-bold text-[#D4AF37]">${(c.clicks || 0).toLocaleString('pt-BR')}</td>
                        <td class="py-3 px-3 font-bold text-[#FDFBF7]">${cCtr}%</td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}">
                            ${c.status === 'active' ? 'Ativo' : 'Pausado'}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-right">
                          <button class="btn-toggle-camp px-2.5 py-1 rounded-lg btn-coffee text-[11px]" data-camp-id="${c.id}">
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
        btn.addEventListener('click', () => {
          const orderId = btn.getAttribute('data-order-id');
          this.approveOrder(orderId);
        });
      });

      document.querySelectorAll('.btn-toggle-camp').forEach(btn => {
        btn.addEventListener('click', () => {
          const campId = btn.getAttribute('data-camp-id');
          this.toggleCampaignStatus(campId);
        });
      });
    }

    approveOrder(orderId) {
      const order = this.orders.find(o => o.orderId === orderId);
      if (!order) return;

      const confirmed = confirm(`Confirmar ativação da campanha para "${order.companyName}"?\nValor confirmado via Pix: R$ ${(order.amount || 0).toFixed(2)}.`);
      if (!confirmed) return;

      order.status = 'active';
      this.saveOrders(this.orders);

      const newCampaign = {
        id: 'camp-' + order.orderId,
        clientName: order.companyName,
        title: order.companyName + ' &bull; ' + (order.planName || 'Anúncio Patrocinado'),
        category: 'Patrocinado',
        slot: order.slot || 'top-leaderboard',
        bannerUrl: order.bannerUrl || '',
        targetUrl: order.targetUrl || 'https://orlinxgroup.com.br',
        ctaText: 'Acessar Anunciante',
        status: 'active',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        impressions: 0,
        clicks: 0
      };

      this.campaigns.unshift(newCampaign);
      this.saveCampaigns(this.campaigns);

      alert(`Campanha ${order.orderId} ativada com sucesso no ORLINX ADS!`);
      this.renderDashboard();
    }

    toggleCampaignStatus(campId) {
      const camp = this.campaigns.find(c => c.id === campId);
      if (camp) {
        camp.status = camp.status === 'active' ? 'paused' : 'active';
        this.saveCampaigns(this.campaigns);
        this.renderDashboard();
      }
    }

    exportCSV() {
      let csv = 'ID;Cliente;Slot;Status;Impressoes;Cliques;CTR_Porcento\n';
      this.campaigns.forEach(c => {
        const cCtr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
        csv += `${c.id};"${c.clientName}";${c.slot};${c.status};${c.impressions || 0};${c.clicks || 0};${cCtr}%\n`;
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
  }

  window.OrlinxAdsAdmin = new OrlinxAdsAdmin();
})();
