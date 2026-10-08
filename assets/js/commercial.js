/**
 * ORLINX ADS - Módulo Comercial & Captação de Anunciantes
 * Zero WhatsApp Fictício | Zero Chave Pix Não Confirmada | Checkout Suspenso
 * Registro Direto no Servidor Central / Banco Centralizado
 */

(function () {
  'use strict';

  class OrlinxCommercial {
    constructor() {
      this.plans = {
        starter: { name: 'Plano Starter', price: 199.00, slot: 'sidebar-box' },
        business: { name: 'Plano Business', price: 389.00, slot: 'feed-billboard' },
        master: { name: 'Plano Master', price: 790.00, slot: 'top-leaderboard' }
      };
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.bindEvents());
      } else {
        this.bindEvents();
      }
    }

    bindEvents() {
      const form = document.getElementById('orx-ad-order-form');
      if (form) {
        form.addEventListener('submit', (e) => this.handleSubmit(e));
      }

      // Botões de seleção rápida de plano
      document.querySelectorAll('[data-select-plan]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const planKey = e.currentTarget.getAttribute('data-select-plan');
          this.selectPlan(planKey);
        });
      });

      const bannerInput = document.getElementById('ad-banner-file');
      if (bannerInput) {
        bannerInput.addEventListener('change', (e) => this.handleBannerPreview(e));
      }
    }

    selectPlan(planKey) {
      const selectElement = document.getElementById('ad-plan-select');
      if (selectElement) {
        selectElement.value = planKey;
      }
      const orderSection = document.getElementById('formulario-pedido');
      if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
      }
    }

    handleBannerPreview(e) {
      const file = e.target.files[0];
      const previewContainer = document.getElementById('banner-preview-box');
      if (!file || !previewContainer) return;

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.type)) {
        alert('Formato de arquivo não suportado. Por favor, utilize apenas imagens nos formatos PNG, JPG ou WebP.');
        e.target.value = '';
        previewContainer.innerHTML = '';
        previewContainer.removeAttribute('data-banner-base64');
        return;
      }

      if (file.size > 2 * 1024 * 1024) { // Limite estrito de 2MB
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
            <p class="text-xs text-[#D4AF37] font-semibold mb-2">Pré-visualização do Banner Selecionado:</p>
            <img src="${event.target.result}" alt="Pré-visualização da Peça" class="max-h-36 mx-auto rounded-lg border border-[#1E3158] object-contain">
            <p class="text-[11px] text-[#D3CBC3] mt-1.5 text-center">${this.escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)</p>
          </div>
        `;
        previewContainer.setAttribute('data-banner-base64', event.target.result);
      };
      reader.readAsDataURL(file);
    }

    async handleSubmit(e) {
      e.preventDefault();
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');

      const company_name = form.elements['company_name']?.value.trim();
      const document_num = form.elements['document']?.value.trim();
      const email = form.elements['email']?.value.trim();
      const phone = form.elements['phone']?.value.trim();
      const plan = form.elements['plan']?.value;
      const target_url = form.elements['target_url']?.value.trim();
      const termsAccepted = form.elements['terms']?.checked;

      // Validação estrita de URL no cliente (apenas protocolos seguros http:// ou https://)
      if (!target_url.startsWith('http://') && !target_url.startsWith('https://')) {
        alert('A URL de destino deve começar estritamente com http:// ou https://');
        return;
      }

      // Validação contra esquemas inseguros
      if (/^(javascript:|data:|vbscript:)/i.test(target_url)) {
        alert('URL com protocolo não permitido. Insira um link corporativo válido.');
        return;
      }

      if (!termsAccepted) {
        alert('É necessário concordar com os Termos de Publicidade e com a Política de Privacidade (LGPD).');
        return;
      }

      const previewBox = document.getElementById('banner-preview-box');
      const bannerBase64 = previewBox ? previewBox.getAttribute('data-banner-base64') || '' : '';

      const payload = {
        company_name,
        document: document_num,
        email,
        phone,
        plan,
        target_url,
        banner: bannerBase64
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Enviando proposta ao servidor...';
      }

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          form.reset();
          if (previewBox) {
            previewBox.innerHTML = '';
            previewBox.removeAttribute('data-banner-base64');
          }
          this.renderSubmissionModal(data, payload);
        } else {
          alert('Erro na solicitação: ' + (data.error || 'Não foi possível registrar o pedido no momento.'));
        }
      } catch (err) {
        alert('Falha na comunicação com o servidor de processamento. Tente novamente em alguns instantes.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>&#128179;</span> Enviar Proposta de Veiculação &rarr;';
        }
      }
    }

    renderSubmissionModal(resData, orderPayload) {
      const modalContainer = document.getElementById('order-status-modal');
      if (!modalContainer) return;

      const planInfo = this.plans[orderPayload.plan] || this.plans.starter;
      const amountFormatted = planInfo.price.toFixed(2).replace('.', ',');
      const orderId = resData.orderId || resData.order_code || 'ORX-PENDENTE';

      modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div class="bg-[#1F1511] border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 sm:p-8 text-[#FDFBF7] shadow-2xl relative">
            <button type="button" class="absolute top-4 right-4 text-[#D3CBC3] hover:text-[#FDFBF7] text-2xl font-bold" onclick="document.getElementById('order-status-modal')?.replaceChildren();">
              &times;
            </button>

            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E1F1A] border border-[#D4AF37]/40 mb-3">
              <span class="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
              <span class="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">Proposta Protocolada</span>
            </div>

            <h3 class="text-xl sm:text-2xl font-bold text-[#FDFBF7] font-space mb-1">
              Protocolo &bull; ${this.escapeHtml(orderId)}
            </h3>
            <p class="text-xs text-[#D3CBC3] mb-5">
              ${this.escapeHtml(planInfo.name)} &bull; Valor de Referência: <strong class="text-[#D4AF37] text-sm">R$ ${amountFormatted}</strong>
            </p>

            <div class="bg-[#080E1E] p-4 rounded-2xl border border-[#4A332B] text-center mb-5 space-y-2">
              <div class="w-12 h-12 mx-auto rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] text-xl font-bold font-space">
                &#10003;
              </div>
              <h4 class="text-sm font-bold text-[#FDFBF7]">Campanha Encaminhada para Homologação</h4>
              <p class="text-xs text-[#D3CBC3] leading-relaxed">
                Os dados cadastrais e o banner da sua empresa foram registrados com segurança no banco de dados centralizado e estão disponíveis para a gestão do <strong>ORLINX GROUP</strong>.
              </p>
            </div>

            <div class="bg-[#0E1830] p-4 rounded-xl border border-[#1E3158] text-xs text-[#D3CBC3] space-y-2 mb-6">
              <p class="font-semibold text-[#FDFBF7]">&bull; Próximas Etapas:</p>
              <p>1. <strong>Validação Técnica:</strong> A equipe confere as dimensões da arte e a conformidade ética com os Termos de Publicidade.</p>
              <p>2. <strong>Faturamento Corporativo:</strong> Os dados bancários oficiais e instruções de liquidação serão encaminhados diretamente ao e-mail <strong>${this.escapeHtml(orderPayload.email)}</strong>.</p>
              <p class="text-[11px] text-[#D4AF37]/90 italic">* O checkout público automatizado encontra-se suspenso até a confirmação formal dos dados de faturamento.</p>
            </div>

            <button type="button" class="w-full py-3.5 px-4 rounded-xl text-xs font-bold btn-gold shadow-lg" onclick="document.getElementById('order-status-modal')?.replaceChildren();">
              Concluir Protocolo
            </button>
          </div>
        </div>
      `;
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

  window.OrlinxCommercial = new OrlinxCommercial();
})();
