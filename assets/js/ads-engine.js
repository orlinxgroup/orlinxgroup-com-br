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
    },
    {
      id: 'camp-tessari-verao',
      campaign_code: 'CAMP-TESSARI-01',
      client_name: 'Tessari Malhas',
      title: 'Elegância que acompanha o verão',
      category: 'Moda Praia e Piscina',
      description: 'Descubra saias, shorts, vestidos e calças em tricô para momentos de sol com sofisticação e estilo.',
      slot: 'feed-billboard',
      banner_url: '/assets/ads/tessari/tessari_orlinx_ads_banner_1600x720.jpg',
      target_url: 'https://www.tessarimalhas.com.br',
      cta_text: 'Conheça a Coleção',
      status: 'active',
      start_date: '2026-10-15',
      end_date: '2027-10-15'
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
      // 1. Tenta endpoint PHP dedicado no servidor
      try {
        const res = await fetch('/api/campaigns.php');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.campaigns) && data.campaigns.length > 0) {
            this.campaigns = data.campaigns;
            return;
          }
        }
      } catch (err) {
        // Fallback silencioso
      }

      // 2. Tenta endpoint limpo /api/campaigns
      try {
        const res = await fetch('/api/campaigns');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.campaigns) && data.campaigns.length > 0) {
            this.campaigns = data.campaigns;
            return;
          }
        }
      } catch (err) {
        // Fallback para campanhas em memória
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
      if (active.length === 0) return null;

      // Preserva anunciantes contratados priorizando-os sobre placeholders institucionais vazios
      const commercial = active.filter(c => c.id !== 'orx-slot-feed' && c.id !== 'orx-slot-topo' && c.id !== 'orx-slot-lateral');
      if (commercial.length > 0) {
        const randomIndex = Math.floor(Math.random() * commercial.length);
        return commercial[randomIndex];
      }

      const randomIndex = Math.floor(Math.random() * active.length);
      return active[randomIndex];
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
        const target = this.sanitizeUrl(campaign.target_url || campaign.targetUrl);
        const title = campaign.title || 'Anúncio ORLINX ADS';
        const clientName = campaign.client_name || campaign.clientName || 'ORLINX ADS';
        const category = campaign.category || 'Publicidade Premium';
        const description = campaign.description || '';
        const cta = campaign.cta_text || campaign.ctaText || 'Conheça Mais';

        container.innerHTML = `
          <div class="relative group overflow-hidden rounded-2xl border border-[#4A332B] bg-[#0E1830] shadow-2xl transition-all duration-300 hover:border-[#D4AF37]/50">
            <div class="absolute top-3 right-3 z-20">
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#080E1E]/90 text-[#D4AF37] border border-[#D4AF37]/40 backdrop-blur-md shadow-md">
                Publicidade &bull; ORLINX ADS
              </span>
            </div>
            <a href="${this.escapeHtml(target)}" target="_blank" rel="noopener noreferrer" class="orx-ad-link block overflow-hidden bg-[#14100D]" data-campaign-id="${this.escapeHtml(campaign.id)}" aria-label="${this.escapeHtml(title)}">
              <img src="${this.escapeHtml(banner)}" alt="${this.escapeHtml(title)}" class="w-full h-auto aspect-[1600/720] object-cover transition-transform duration-500 group-hover:scale-[1.01]" loading="lazy">
            </a>
            <div class="p-4 sm:p-5 bg-gradient-to-r from-[#14100D] via-[#1F1511] to-[#0E1830] border-t border-[#4A332B]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">${this.escapeHtml(category)}</span>
                  <span class="text-xs text-[#D3CBC3] font-medium">${this.escapeHtml(clientName)}</span>
                </div>
                <h3 class="text-sm sm:text-base font-bold text-[#FDFBF7] font-space">${this.escapeHtml(title)}</h3>
                ${description ? `<p class="text-xs text-[#D3CBC3]/80 max-w-2xl">${this.escapeHtml(description)}</p>` : ''}
              </div>
              <a href="${this.escapeHtml(target)}" target="_blank" rel="noopener noreferrer" class="orx-ad-link shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold btn-gold shadow-lg hover:shadow-xl transition-all" data-campaign-id="${this.escapeHtml(campaign.id)}">
                ${this.escapeHtml(cta)} &rarr;
              </a>
            </div>
          </div>
        `;
      } else {
        const clientName = campaign.client_name || campaign.clientName || 'ORLINX GROUP';
        const target = this.sanitizeUrl(campaign.target_url || campaign.targetUrl || '/anuncie.html');
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

      const links = container.querySelectorAll('.orx-ad-link');
      links.forEach((link) => {
        link.addEventListener('click', () => {
          this.handleClick(campaign.id, slotName);
        });
      });
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
        const payload = JSON.stringify({
          campaignId,
          type: eventType,
          slot: slotName,
          ts: Date.now()
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/telemetry.php', payload);
        } else {
          await fetch('/api/telemetry.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          });
        }
      } catch (err) {
        // Silencioso em caso de falha transitória de rede
      }
    }

    sanitizeUrl(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return '#';
      const trimmed = rawUrl.trim();
      if (/^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed) || trimmed.startsWith('/')) {
        return trimmed;
      }
      return '#';
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
