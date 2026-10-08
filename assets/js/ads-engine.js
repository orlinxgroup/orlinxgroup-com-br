/**
 * ORLINX ADS - Advertising & Telemetry Engine
 * Rotação, Telemetria e Monitoramento de Impressões e Cliques Reais
 * Zero LocalStorage: Conexão direta com API Centralizada / Supabase
 * Sem anunciantes fictícios: apenas chamadas institucionais próprias e anunciantes reais validados.
 */

(function () {
  'use strict';

  // Fallback institucional oficial enquanto sincroniza com o banco centralizado
  const INITIAL_CAMPAIGNS = [
    {
      id: 'orx-slot-topo',
      client_name: 'Espaço Disponível • ORLINX ADS',
      title: 'Posicione sua Empresa no Topo do Portal ORLINX GROUP',
      slot: 'top-leaderboard',
      banner_url: '',
      target_url: '/anuncie.html',
      cta_text: 'Anuncie Conosco',
      status: 'active'
    },
    {
      id: 'orx-slot-lateral',
      client_name: 'Vitrine de Anunciantes • ORLINX ADS',
      title: 'Destaque seus Serviços Corporativos para Líderes e Empresas',
      slot: 'sidebar-box',
      banner_url: '',
      target_url: '/anuncie.html',
      cta_text: 'Ver Formatos',
      status: 'active'
    },
    {
      id: 'orx-slot-feed',
      client_name: 'ORLINX GROUP Institucional',
      title: 'Soluções Empresariais, Infraestrutura e Consultoria Estratégica',
      slot: 'feed-billboard',
      banner_url: '',
      target_url: '/anuncie.html',
      cta_text: 'Conhecer a Rede',
      status: 'active'
    }
  ];

  class OrlinxAdsEngine {
    constructor() {
      this.campaigns = [...INITIAL_CAMPAIGNS];
      this.observedSlots = new Set();
      this.recentClicks = new Map();
      this.init();
    }

    async init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.start());
      } else {
        await this.start();
      }
    }

    async start() {
      await this.fetchActiveCampaigns();
      this.mountSlots();
    }

    async fetchActiveCampaigns() {
      try {
        // Consulta ao backend centralizado / Supabase
        const res = await fetch('/api/campaigns');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.campaigns) && data.campaigns.length > 0) {
            this.campaigns = data.campaigns;
          }
        }
      } catch (err) {
        // Em caso de offline, preserva os slots institucionais seguros sem quebrar o layout
        console.warn('[ORLINX ADS] Sincronização centralizada:', err.message || err);
      }
    }

    mountSlots() {
      const slotElements = document.querySelectorAll('[data-orx-slot]');
      if (!slotElements.length) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const el = entry.target;
            const slotName = el.getAttribute('data-orx-slot');
            const campaignId = el.getAttribute('data-orx-campaign-id');

            if (campaignId && !this.observedSlots.has(slotName + ':' + campaignId)) {
              this.observedSlots.add(slotName + ':' + campaignId);
              this.sendTelemetry(campaignId, 'impression', slotName);
            }
          }
        });
      }, {
        threshold: [0.5]
      });

      slotElements.forEach((el) => {
        const slotName = el.getAttribute('data-orx-slot');
        const campaign = this.getCampaignForSlot(slotName);
        this.renderBanner(el, campaign, slotName);
        observer.observe(el);
      });
    }

    getCampaignForSlot(slotName) {
      const active = this.campaigns.filter(c => c.slot === slotName && c.status === 'active');
      if (active.length > 0) {
        const randomIndex = Math.floor(Math.random() * active.length);
        return active[randomIndex];
      }
      return null;
    }

    renderBanner(container, campaign, slotName) {
      if (!campaign) {
        container.innerHTML = `
          <div class="p-4 rounded-xl border border-dashed border-[#4A332B] bg-[#1F1511]/90 text-center flex flex-col items-center justify-center">
            <span class="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold mb-1">Espaço Publicitário Aberto</span>
            <p class="text-xs text-[#F5EFEB] mb-2 font-medium">Divulgue seus serviços no ORLINX ADS.</p>
            <a href="/anuncie.html" class="text-xs font-bold text-[#D4AF37] hover:underline">Ver Tabela de Formatos &rarr;</a>
          </div>
        `;
        return;
      }

      container.setAttribute('data-orx-campaign-id', campaign.id);

      if (campaign.banner_url || campaign.bannerUrl) {
        const banner = campaign.banner_url || campaign.bannerUrl;
        const target = campaign.target_url || campaign.targetUrl;
        const title = campaign.title || 'Anúncio ORLINX ADS';

        container.innerHTML = `
          <div class="relative group overflow-hidden rounded-xl border border-[#4A332B] bg-[#0E1830] shadow-lg">
            <div class="absolute top-2 right-2 z-10">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#080E1E]/85 text-[#D4AF37] border border-[#D4AF37]/40 backdrop-blur-sm">
                Publicidade &bull; ORLINX ADS
              </span>
            </div>
            <a href="${this.escapeHtml(target)}" target="_blank" rel="noopener noreferrer" class="orx-ad-link block" data-campaign-id="${this.escapeHtml(campaign.id)}">
              <img src="${this.escapeHtml(banner)}" alt="${this.escapeHtml(title)}" class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.01]" loading="lazy">
            </a>
          </div>
        `;
      } else {
        const clientName = campaign.client_name || campaign.clientName || 'ORLINX GROUP';
        const target = campaign.target_url || campaign.targetUrl || '/anuncie.html';
        const cta = campaign.cta_text || campaign.ctaText || 'Saiba Mais';

        container.innerHTML = `
          <div class="p-4 sm:p-5 rounded-xl border border-[#4A332B] bg-gradient-to-r from-[#1F1511] via-[#2E1F1A] to-[#0E1830] text-[#FDFBF7] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#2E1F1A] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-bold text-sm shrink-0 font-space">
                OX
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">Espaço Disponível</span>
                  <span class="text-xs text-[#D3CBC3]">${this.escapeHtml(clientName)}</span>
                </div>
                <h4 class="text-sm font-bold text-[#FDFBF7] mt-0.5">${this.escapeHtml(campaign.title)}</h4>
              </div>
            </div>
            <a href="${this.escapeHtml(target)}" class="orx-ad-link shrink-0 px-4 py-2 rounded-lg text-xs font-bold btn-gold shadow-md text-center" data-campaign-id="${this.escapeHtml(campaign.id)}">
              ${this.escapeHtml(cta)} &rarr;
            </a>
          </div>
        `;
      }

      const link = container.querySelector('.orx-ad-link');
      if (link) {
        link.addEventListener('click', () => {
          this.handleClick(campaign.id, slotName);
        });
      }
    }

    handleClick(campaignId, slotName) {
      const now = Date.now();
      const last = this.recentClicks.get(campaignId) || 0;
      // Anti-fraude: debounce de 3 segundos por campanha em memória de sessão
      if (now - last < 3000) return;
      this.recentClicks.set(campaignId, now);

      this.sendTelemetry(campaignId, 'click', slotName);
    }

    async sendTelemetry(campaignId, eventType, slotName) {
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            type: eventType,
            slot: slotName
          })
        });
      } catch (err) {
        // Silencioso em caso de falha transitória de rede
      }
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

  window.OrlinxAds = new OrlinxAdsEngine();
})();
