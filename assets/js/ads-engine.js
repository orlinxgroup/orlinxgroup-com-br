/**
 * ORLINX ADS - Advertising & Telemetry Engine
 * Rotação, Telemetria e Monitoramento de Impressões e Cliques Reais
 */

(function () {
  'use strict';

  const STORAGE_KEY_CAMPAIGNS = 'orx_ads_campaigns';
  const STORAGE_KEY_STATS = 'orx_ads_stats';

  // Campanhas padrão de inicialização (Slots disponíveis para anunciantes)
  const DEFAULT_CAMPAIGNS = [
    {
      id: 'orx-camp-001',
      clientName: 'Orlinx Group Oficial',
      title: 'Soluções Corporativas e Tecnologia Orbital',
      category: 'Tecnologia & B2B',
      slot: 'top-leaderboard',
      bannerUrl: '',
      targetUrl: 'https://orlinxgroup.com.br/anuncie.html',
      ctaText: 'Anuncie no Orlinx Ads',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      impressions: 0,
      clicks: 0
    },
    {
      id: 'orx-camp-002',
      clientName: 'Espaço Disponível',
      title: 'Destaque sua Empresa para Executivos e Tomadores de Decisão',
      category: 'Empresarial',
      slot: 'sidebar-box',
      bannerUrl: '',
      targetUrl: 'https://orlinxgroup.com.br/anuncie.html',
      ctaText: 'Garantir este Espaço',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      impressions: 0,
      clicks: 0
    },
    {
      id: 'orx-camp-003',
      clientName: 'Orlinx Intelligence',
      title: 'Plataforma Orlinx Ads: Visibilidade com Alta Conversão',
      category: 'Marketing Digital',
      slot: 'feed-billboard',
      bannerUrl: '',
      targetUrl: 'https://orlinxgroup.com.br/anuncie.html',
      ctaText: 'Conhecer Planos',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      impressions: 0,
      clicks: 0
    }
  ];

  class OrlinxAdsEngine {
    constructor() {
      this.campaigns = this.loadCampaigns();
      this.observedSlots = new Set();
      this.clickedInSession = new Set();
      this.init();
    }

    loadCampaigns() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.warn('[Orlinx Ads] LocalStorage indisponível, usando fallback em memória.');
      }
      this.saveCampaigns(DEFAULT_CAMPAIGNS);
      return DEFAULT_CAMPAIGNS;
    }

    saveCampaigns(camps) {
      try {
        localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(camps));
      } catch (e) {}
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.mountSlots());
      } else {
        this.mountSlots();
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
            
            // Registra impressão real apenas se ainda não contabilizada nesta exibição
            if (campaignId && !this.observedSlots.has(slotName + ':' + campaignId)) {
              this.observedSlots.add(slotName + ':' + campaignId);
              this.recordImpression(campaignId);
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
        // Rotação simples ou primeiro ativo
        const randomIndex = Math.floor(Math.random() * active.length);
        return active[randomIndex];
      }
      return null;
    }

    renderBanner(container, campaign, slotName) {
      if (!campaign) {
        // Fallback institucional oficial
        container.innerHTML = `
          <div class="orx-ad-banner default-banner p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-center flex flex-col items-center justify-center">
            <span class="text-xs uppercase tracking-wider text-amber-500 font-semibold mb-1">Espaço Publicitário Disponível</span>
            <p class="text-sm text-slate-300 font-medium mb-2">Conecte sua marca a milhares de empresas e parceiros.</p>
            <a href="/anuncie.html" class="inline-block text-xs font-bold text-amber-400 hover:text-amber-300 underline">Reserve este banner no ORLINX ADS &rarr;</a>
          </div>
        `;
        return;
      }

      container.setAttribute('data-orx-campaign-id', campaign.id);

      if (campaign.bannerUrl) {
        // Banner gráfico do anunciante
        container.innerHTML = `
          <div class="orx-ad-container relative group overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 shadow-lg">
            <div class="absolute top-2 right-2 z-10">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/75 text-amber-400 border border-amber-500/30 backdrop-blur-sm">Publicidade • Orlinx Ads</span>
            </div>
            <a href="${campaign.targetUrl}" target="_blank" rel="noopener noreferrer" class="orx-ad-link block" data-campaign-id="${campaign.id}">
              <img src="${campaign.bannerUrl}" alt="${campaign.title}" class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.01]" loading="lazy">
            </a>
          </div>
        `;
      } else {
        // Banner temático nativo integrado com o visual Orlinx Group
        container.innerHTML = `
          <div class="orx-ad-native p-5 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                OX
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Anúncio Verificado</span>
                  <span class="text-xs text-slate-400">${campaign.clientName}</span>
                </div>
                <h4 class="text-sm md:text-base font-bold text-white mt-0.5">${campaign.title}</h4>
              </div>
            </div>
            <a href="${campaign.targetUrl}" class="orx-ad-link shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md hover:shadow-amber-500/20" data-campaign-id="${campaign.id}">
              ${campaign.ctaText || 'Saiba Mais'} &rarr;
            </a>
          </div>
        `;
      }

      // Adiciona listener de clique com proteção anti-fraude
      const link = container.querySelector('.orx-ad-link');
      if (link) {
        link.addEventListener('click', (e) => {
          this.recordClick(campaign.id);
        });
      }
    }

    recordImpression(campaignId) {
      const camp = this.campaigns.find(c => c.id === campaignId);
      if (camp) {
        camp.impressions = (camp.impressions || 0) + 1;
        this.saveCampaigns(this.campaigns);
        this.dispatchStatsEvent();
      }
    }

    recordClick(campaignId) {
      // Previne cliques inflacionados em loop na mesma sessão de navegação
      const clickKey = campaignId + '_' + Date.now();
      const lastClick = sessionStorage.getItem('last_click_' + campaignId);
      const now = Date.now();

      if (lastClick && (now - parseInt(lastClick, 10)) < 3000) {
        // Ignora cliques duplos em menos de 3 segundos
        return;
      }
      sessionStorage.setItem('last_click_' + campaignId, now.toString());

      const camp = this.campaigns.find(c => c.id === campaignId);
      if (camp) {
        camp.clicks = (camp.clicks || 0) + 1;
        this.saveCampaigns(this.campaigns);
        this.dispatchStatsEvent();
      }
    }

    dispatchStatsEvent() {
      window.dispatchEvent(new CustomEvent('orlinx_ads_updated', {
        detail: { campaigns: this.campaigns }
      }));
    }
  }

  // Instancia global
  window.OrlinxAds = new OrlinxAdsEngine();
})();
