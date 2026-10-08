/**
 * ORLINX ADS - Advertising & Telemetry Engine
 * Rotação, Telemetria e Monitoramento de Impressões e Cliques Reais
 * Sem anunciantes fictícios: apenas espaços institucionais oficiais e slots abertos para anunciantes.
 */

(function () {
  'use strict';

  const STORAGE_KEY_CAMPAIGNS = 'orx_ads_campaigns';

  // Slots e Campanhas Oficiais Iniciais
  // 100% transparentes: chamadas institucionais próprias do portal e convites para anunciantes reais
  const DEFAULT_CAMPAIGNS = [
    {
      id: 'orx-slot-topo',
      clientName: 'Espaço Disponível • ORLINX ADS',
      title: 'Posicione sua Empresa no Topo do Portal ORLINX GROUP',
      category: 'Publicidade B2B',
      slot: 'top-leaderboard',
      bannerUrl: '',
      targetUrl: 'https://orlinxgroup.com.br/anuncie.html',
      ctaText: 'Anuncie Conosco',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      impressions: 0,
      clicks: 0
    },
    {
      id: 'orx-slot-lateral',
      clientName: 'Vitrine de Anunciantes • ORLINX ADS',
      title: 'Destaque seus Serviços Corporativos para Líderes e Empresas',
      category: 'Publicidade B2B',
      slot: 'sidebar-box',
      bannerUrl: '',
      targetUrl: 'https://orlinxgroup.com.br/anuncie.html',
      ctaText: 'Ver Planos & Preços',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      impressions: 0,
      clicks: 0
    },
    {
      id: 'orx-slot-feed',
      clientName: 'ORLINX GROUP Institucional',
      title: 'Soluções Empresariais, Infraestrutura e Consultoria Estratégica',
      category: 'Institucional',
      slot: 'feed-billboard',
      bannerUrl: '',
      targetUrl: 'https://orlinxgroup.com.br/anuncie.html',
      ctaText: 'Conhecer a Rede',
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
      this.init();
    }

    loadCampaigns() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {}
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

      if (campaign.bannerUrl) {
        // Banner carregado do anunciante real
        container.innerHTML = `
          <div class="relative group overflow-hidden rounded-xl border border-[#4A332B] bg-[#0E1830] shadow-lg">
            <div class="absolute top-2 right-2 z-10">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#080E1E]/85 text-[#D4AF37] border border-[#D4AF37]/40 backdrop-blur-sm">
                Publicidade &bull; ORLINX ADS
              </span>
            </div>
            <a href="${campaign.targetUrl}" target="_blank" rel="noopener noreferrer" class="orx-ad-link block" data-campaign-id="${campaign.id}">
              <img src="${campaign.bannerUrl}" alt="${campaign.title}" class="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.01]" loading="lazy">
            </a>
          </div>
        `;
      } else {
        // Banner temático nativo integrado com a paleta oficial
        container.innerHTML = `
          <div class="p-4 sm:p-5 rounded-xl border border-[#4A332B] bg-gradient-to-r from-[#1F1511] via-[#2E1F1A] to-[#0E1830] text-[#FDFBF7] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#2E1F1A] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-bold text-sm shrink-0">
                OX
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">Espaço Disponível</span>
                  <span class="text-xs text-[#D3CBC3]">${campaign.clientName}</span>
                </div>
                <h4 class="text-sm font-bold text-[#FDFBF7] mt-0.5">${campaign.title}</h4>
              </div>
            </div>
            <a href="${campaign.targetUrl}" class="orx-ad-link shrink-0 px-4 py-2 rounded-lg text-xs font-bold btn-gold shadow-md text-center" data-campaign-id="${campaign.id}">
              ${campaign.ctaText || 'Saiba Mais'} &rarr;
            </a>
          </div>
        `;
      }

      const link = container.querySelector('.orx-ad-link');
      if (link) {
        link.addEventListener('click', () => {
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
      const lastClick = sessionStorage.getItem('last_click_' + campaignId);
      const now = Date.now();

      if (lastClick && (now - parseInt(lastClick, 10)) < 3000) {
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

  window.OrlinxAds = new OrlinxAdsEngine();
})();
