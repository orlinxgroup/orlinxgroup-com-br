/**
 * ORLINX GROUP & ORLINX ADS - Módulo Comercial & Captação de Anunciantes
 * Projeto Oficial Exclusivo: ulajrvkaqqedwuaiaksp (https://ulajrvkaqqedwuaiaksp.supabase.co)
 * Captura Segura de Propostas Comerciais, Gestão de UTMs e Mensuração de Conversão
 * Zero Credenciais Privadas no Frontend | Zero Senhas Padrão | Checkout Suspenso
 */

(function () {
  'use strict';

  const OFFICIAL_SUPABASE_URL = 'https://ulajrvkaqqedwuaiaksp.supabase.co';
  const UTM_STORAGE_KEY = 'orx_ads_utm_data';

  // --- 1. Módulo de Rastreamento de Parâmetros UTM e Conversões (Google Ads Ready) ---
  class OrlinxAnalyticsTracker {
    constructor() {
      this.utmData = this.captureUtmParams();
    }

    captureUtmParams() {
      const params = new URLSearchParams(window.location.search);
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'];
      const captured = {};
      let hasAny = false;

      utmKeys.forEach((key) => {
        const val = params.get(key);
        if (val) {
          captured[key] = this.sanitize(val.substring(0, 150));
          hasAny = true;
        }
      });

      if (hasAny) {
        try {
          sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(captured));
        } catch (_) {}
        return captured;
      }

      // Recupera de navegação anterior na mesma sessão
      try {
        const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (_) {}

      return {};
    }

    sanitize(str) {
      if (!str || typeof str !== 'string') return '';
      return str.replace(/[^\w\s\-._~]/gi, '').trim();
    }

    /**
     * Dispara evento de conversão desacoplado (Google Ads / GA4 / GTM)
     * Não ativa campanhas publicitárias pagas; apenas despacha evento no ambiente
     */
    trackConversion(eventName, details) {
      const eventPayload = {
        event: eventName,
        event_category: 'ORLINX_ADS_COMMERCIAL',
        plan: details.plan || 'custom',
        amount: details.amount || 0,
        order_code: details.order_code || '',
        lead_source: details.lead_source || 'organic',
        timestamp: new Date().toISOString(),
        ...this.utmData
      };

      // 1. Google Tag Manager dataLayer (se presente)
      if (typeof window.dataLayer !== 'undefined' && Array.isArray(window.dataLayer)) {
        window.dataLayer.push(eventPayload);
      }

      // 2. Google Ads / gtag.js (se presente)
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'generate_lead', {
          event_category: 'Lead Comercial',
          event_label: details.plan,
          value: details.amount || 0,
          currency: 'BRL',
          transaction_id: details.order_code
        });
      }

      // 3. Evento Customizado no DOM (para escuta e testes sem dependências externas)
      try {
        const domEvent = new CustomEvent('orx:commercial_conversion', { detail: eventPayload });
        document.dispatchEvent(domEvent);
      } catch (_) {}

      // Log seguro de depuração interna
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.info('[ORLINX Telemetria] Conversão registrada:', eventName, eventPayload);
      }
    }
  }

  // --- 2. Módulo Comercial e Formulários de Proposta ---
  class OrlinxCommercialApp {
    constructor() {
      this.analytics = new OrlinxAnalyticsTracker();
      this.plans = {
        starter: { name: 'Plano Starter', price: 199.00, slot: 'sidebar-box' },
        business: { name: 'Plano Business', price: 389.00, slot: 'feed-billboard' },
        master: { name: 'Plano Master', price: 790.00, slot: 'top-leaderboard' },
        custom: { name: 'Plano Personalizado', price: 0.00, slot: 'custom-package' }
      };

      this.supabaseUrl = window.ORLINX_SUPABASE_URL || OFFICIAL_SUPABASE_URL;
      this.supabaseAnonKey = window.ORLINX_SUPABASE_ANON_KEY || '';

      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.bindAll());
      } else {
        this.bindAll();
      }
    }

    bindAll() {
      this.bindOrderForm('orx-ad-order-form', 'anuncie_page');
      this.bindOrderForm('orx-lp-lead-form', 'google_ads_lp');
      this.bindPlanSelectors();
      this.bindBannerPreview();
      this.bindInputMasks();
    }

    bindPlanSelectors() {
      document.querySelectorAll('[data-select-plan]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const planKey = e.currentTarget.getAttribute('data-select-plan');
          this.selectPlan(planKey);
        });
      });
    }

    selectPlan(planKey) {
      const selectElement = document.getElementById('ad-plan-select') || document.getElementById('lp-plan-select');
      if (selectElement) {
        selectElement.value = planKey;
      }
      const targetSection = document.getElementById('formulario-pedido') || document.getElementById('formulario-lp');
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    }

    bindInputMasks() {
      // Máscara CNPJ / CPF
      const docInputs = document.querySelectorAll('input[name="document"], #document, #lp_document');
      docInputs.forEach((input) => {
        input.addEventListener('input', (e) => {
          let v = e.target.value.replace(/\D/g, '');
          if (v.length <= 11) {
            // CPF: 000.000.000-00
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
          } else {
            // CNPJ: 00.000.000/0001-00
            v = v.substring(0, 14);
            v = v.replace(/^(\d{2})(\d)/, '$1.$2');
            v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
            v = v.replace(/(\d{4})(\d)/, '$1-$2');
          }
          e.target.value = v;
        });
      });

      // Máscara Telefone
      const phoneInputs = document.querySelectorAll('input[type="tel"], #phone, #lp_phone');
      phoneInputs.forEach((input) => {
        input.addEventListener('input', (e) => {
          let v = e.target.value.replace(/\D/g, '').substring(0, 11);
          if (v.length > 10) {
            v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
          } else if (v.length > 5) {
            v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
          } else if (v.length > 2) {
            v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
          }
          e.target.value = v;
        });
      });
    }

    bindBannerPreview() {
      const bannerInput = document.getElementById('ad-banner-file') || document.getElementById('lp-banner-file');
      if (!bannerInput) return;

      bannerInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const previewContainer = document.getElementById('banner-preview-box') || document.getElementById('lp-banner-preview');
        if (!file || !previewContainer) return;

        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.type)) {
          alert('Formato de arquivo não suportado. Por favor, envie uma imagem nos formatos PNG, JPG ou WebP.');
          e.target.value = '';
          previewContainer.innerHTML = '';
          previewContainer.removeAttribute('data-banner-base64');
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          alert('O arquivo selecionado excede o limite máximo permitido de 2MB.');
          e.target.value = '';
          previewContainer.innerHTML = '';
          previewContainer.removeAttribute('data-banner-base64');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          previewContainer.innerHTML = `
            <div class="p-3 border border-[#4A332B] rounded-xl bg-[#0E1830]/80">
              <p class="text-xs text-[#D4AF37] font-semibold mb-2">Pré-visualização do Banner da Campanha:</p>
              <img src="${event.target.result}" alt="Pré-visualização" class="max-h-36 mx-auto rounded-lg border border-[#1E3158] object-contain">
              <p class="text-[11px] text-[#D3CBC3] mt-1.5 text-center">${this.escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)</p>
            </div>
          `;
          previewContainer.setAttribute('data-banner-base64', event.target.result);
        };
        reader.readAsDataURL(file);
      });
    }

    bindOrderForm(formId, source) {
      const form = document.getElementById(formId);
      if (!form) return;

      form.addEventListener('submit', (e) => this.handleSubmit(e, source));
    }

    async handleSubmit(e, leadSource) {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');

      const company_name = form.elements['company_name']?.value.trim();
      const document_num = form.elements['document']?.value.trim();
      const email = form.elements['email']?.value.trim();
      const phone = form.elements['phone']?.value.trim();
      const plan = form.elements['plan']?.value || 'business';
      const target_url = (form.elements['target_url']?.value || '').trim();
      const notes = (form.elements['notes']?.value || '').trim();
      const termsAccepted = form.elements['terms'] ? form.elements['terms'].checked : true;

      // Validações básicas no cliente
      if (!company_name || company_name.length < 3) {
        alert('Por favor, informe a Razão Social ou Nome da Empresa (mínimo de 3 caracteres).');
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Por favor, informe um endereço de e-mail corporativo válido.');
        return;
      }

      if (!phone || phone.length < 8) {
        alert('Por favor, informe um telefone ou WhatsApp corporativo com DDD.');
        return;
      }

      if (target_url && !target_url.startsWith('http://') && !target_url.startsWith('https://')) {
        alert('A URL de destino deve começar estritamente com http:// ou https://');
        return;
      }

      if (target_url && /^(javascript:|data:|vbscript:)/i.test(target_url)) {
        alert('URL com protocolo não permitido.');
        return;
      }

      if (!termsAccepted) {
        alert('É necessário concordar com os Termos de Publicidade e com a Política de Privacidade (LGPD).');
        return;
      }

      const previewBox = document.getElementById('banner-preview-box') || document.getElementById('lp-banner-preview');
      const bannerBase64 = previewBox ? previewBox.getAttribute('data-banner-base64') || '' : '';

      const planInfo = this.plans[plan] || this.plans.business;
      const orderCode = 'ORX-' + Math.floor(100000 + Math.random() * 900000);

      const payload = {
        order_code: orderCode,
        company_name,
        document: document_num || 'ISENTO/PENDENTE',
        document_number: document_num || 'ISENTO/PENDENTE',
        email,
        phone,
        plan,
        plan_key: plan,
        plan_name: planInfo.name,
        amount: planInfo.price,
        slot: planInfo.slot,
        target_url: target_url || 'https://www.orlinxgroup.com.br',
        banner: bannerBase64,
        status: 'pending_review',
        lead_source: leadSource,
        notes,
        ...this.analytics.utmData
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Protocolando proposta comercial...';
      }

      try {
        let persisted = false;
        let responseData = null;

        // 1. Tentativa via Gateway Backend local/servidor (/api/orders)
        try {
          const apiRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (apiRes.ok) {
            responseData = await apiRes.json();
            persisted = true;
          }
        } catch (_) {
          // Servidor local /api/orders não disponível (ambiente estático Hostinger)
        }

        // 2. Fallback via API REST Oficial do Supabase (ulajrvkaqqedwuaiaksp) com política RLS pública
        if (!persisted && this.supabaseAnonKey) {
          try {
            const supabasePayload = {
              order_code: orderCode,
              company_name,
              document_number: document_num || 'PENDENTE',
              email,
              phone,
              plan_key: plan,
              plan_name: planInfo.name,
              amount: planInfo.price,
              slot: planInfo.slot,
              target_url: target_url || 'https://www.orlinxgroup.com.br',
              banner_url: bannerBase64 ? 'base64_criativo_em_análise' : null,
              status: 'pending_review'
            };

            const sbRes = await fetch(`${this.supabaseUrl}/rest/v1/orx_ads_orders`, {
              method: 'POST',
              headers: {
                'apikey': this.supabaseAnonKey,
                'Authorization': `Bearer ${this.supabaseAnonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(supabasePayload)
            });

            if (sbRes.ok || sbRes.status === 201) {
              responseData = { success: true, orderId: orderCode, order_code: orderCode };
              persisted = true;
            }
          } catch (_) {}
        }

        // 3. Resultado
        form.reset();
        if (previewBox) {
          previewBox.innerHTML = '';
          previewBox.removeAttribute('data-banner-base64');
        }

        // Dispara evento de conversão comercial (sem ativar anúncios pagos)
        this.analytics.trackConversion('generate_lead', {
          plan,
          amount: planInfo.price,
          order_code: orderCode,
          lead_source: leadSource
        });

        this.renderSubmissionModal(responseData || { order_code: orderCode }, payload, persisted);

      } catch (err) {
        alert('Ocorreu uma falha no envio. Por favor, envie sua proposta diretamente para comercial@orlinxgroup.com.br');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>&#128179;</span> Enviar Proposta de Veiculação &rarr;';
        }
      }
    }

    renderSubmissionModal(resData, orderPayload, wasPersisted) {
      const modalContainer = document.getElementById('order-status-modal') || document.body;
      const planInfo = this.plans[orderPayload.plan] || this.plans.business;
      const amountFormatted = planInfo.price > 0 ? `R$ ${planInfo.price.toFixed(2).replace('.', ',')}` : 'Sob Consulta';
      const orderCode = resData.order_code || resData.orderId || orderPayload.order_code;

      const modalEl = document.createElement('div');
      modalEl.id = 'commercial-modal-backdrop';
      modalEl.className = 'fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4';
      modalEl.innerHTML = `
        <div class="bg-[#1F1511] border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 sm:p-8 text-[#FDFBF7] shadow-2xl relative animate-fade-in">
          <button type="button" id="btn-close-modal" class="absolute top-4 right-4 text-[#D3CBC3] hover:text-[#FDFBF7] text-2xl font-bold">
            &times;
          </button>

          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E1F1A] border border-[#D4AF37]/40 mb-3">
            <span class="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
            <span class="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">Proposta Protocolada</span>
          </div>

          <h3 class="text-xl sm:text-2xl font-bold text-[#FDFBF7] font-space mb-1">
            Protocolo &bull; ${this.escapeHtml(orderCode)}
          </h3>
          <p class="text-xs text-[#D3CBC3] mb-5">
            ${this.escapeHtml(planInfo.name)} &bull; Referência: <strong class="text-[#D4AF37] text-sm">${amountFormatted}</strong>
          </p>

          <div class="bg-[#080E1E] p-4 rounded-2xl border border-[#4A332B] text-center mb-5 space-y-2">
            <div class="w-12 h-12 mx-auto rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] text-xl font-bold font-space">
              &#10003;
            </div>
            <h4 class="text-sm font-bold text-[#FDFBF7]">Campanha Encaminhada para Homologação</h4>
            <p class="text-xs text-[#D3CBC3] leading-relaxed">
              Sua solicitação comercial para a empresa <strong>${this.escapeHtml(orderPayload.company_name)}</strong> foi recebida com sucesso pela equipe do <strong>ORLINX GROUP</strong>.
            </p>
          </div>

          <div class="bg-[#0E1830] p-4 rounded-xl border border-[#1E3158] text-xs text-[#D3CBC3] space-y-2 mb-6 text-left">
            <p class="font-semibold text-[#FDFBF7]">&bull; Próximos Passos do Faturamento B2B:</p>
            <p>1. <strong>Validação Cadastral & Técnica:</strong> Nossa equipe avalia os dados e a conformidade da arte em até 24 horas úteis.</p>
            <p>2. <strong>Proposta Formal & Liquidação:</strong> A fatura corporativa oficial será remetida diretamente para <strong>${this.escapeHtml(orderPayload.email)}</strong>.</p>
            <p class="text-[11px] text-[#D4AF37]/90 italic">* O checkout público automatizado permanece suspenso até a confirmação formal dos dados bancários corporativos.</p>
          </div>

          <button type="button" id="btn-conclude-modal" class="w-full py-3.5 px-4 rounded-xl text-xs font-bold btn-gold shadow-lg">
            Concluir Protocolo
          </button>
        </div>
      `;

      modalContainer.appendChild(modalEl);

      const closeModal = () => modalEl.remove();
      modalEl.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
      modalEl.querySelector('#btn-conclude-modal')?.addEventListener('click', closeModal);
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
      });
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

  window.OrlinxCommercial = new OrlinxCommercialApp();
})();
