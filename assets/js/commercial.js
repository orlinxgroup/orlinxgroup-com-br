/**
 * ORLINX ADS - Módulo Comercial & Fluxo de Cobrança Pix
 * Simulação de Proposta, Upload Seguro de Banner e Confirmação de Pedido
 */

(function () {
  'use strict';

  // Chave Pix padrão da empresa (Configurável via Admin)
  const DEFAULT_PIX_KEY = 'contato@orlinxgroup.com.br';
  const WHATSAPP_COMMERCIAL = '5511999999999'; // Atualizável no painel ou config

  const PLANS = {
    starter: {
      name: 'Plano Starter (Sidebar)',
      price: 199.00,
      period: '30 dias',
      slot: 'sidebar-box',
      formats: '300x250 px',
      description: 'Ideal para negócios locais e produtos específicos com veiculação lateral contínua.'
    },
    business: {
      name: 'Plano Business (Feed Billboard)',
      price: 389.00,
      period: '30 dias',
      slot: 'feed-billboard',
      formats: '970x250 px ou 728x90 px',
      description: 'Destaque no fluxo de leitura e artigos corporativos com alta taxa de conversão.'
    },
    master: {
      name: 'Plano Master (Topo + Vitrine)',
      price: 790.00,
      period: '30 dias',
      slot: 'top-leaderboard',
      formats: '728x90 px + 300x250 px',
      description: 'Presença no topo de todas as páginas institucionais com máxima visibilidade executiva.'
    }
  };

  class OrlinxCommercial {
    constructor() {
      this.plans = PLANS;
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

      const planSelectors = document.querySelectorAll('[data-select-plan]');
      planSelectors.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const planKey = btn.getAttribute('data-select-plan');
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

      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        alert('Por favor, selecione uma imagem válida (PNG, JPG, WebP ou GIF).');
        e.target.value = '';
        return;
      }

      if (file.size > 2 * 1024 * 1024) { // 2MB max
        alert('O arquivo deve ter no máximo 2MB.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        previewContainer.innerHTML = `
          <div class="p-3 border border-slate-700 rounded-lg bg-slate-900/80">
            <p class="text-xs text-amber-400 font-semibold mb-2">Pré-visualização do Banner Carregado:</p>
            <img src="${event.target.result}" alt="Preview do Banner" class="max-h-36 mx-auto rounded border border-slate-800 object-contain">
            <p class="text-[11px] text-slate-400 mt-1 text-center">${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
          </div>
        `;
        previewContainer.setAttribute('data-banner-base64', event.target.result);
      };
      reader.readAsDataURL(file);
    }

    handleSubmit(e) {
      e.preventDefault();
      const form = e.target;
      
      const companyName = form.elements['company_name']?.value.trim();
      const documentNumber = form.elements['document']?.value.trim();
      const email = form.elements['email']?.value.trim();
      const phone = form.elements['phone']?.value.trim();
      const website = form.elements['website']?.value.trim();
      const planKey = form.elements['plan']?.value;
      const targetUrl = form.elements['target_url']?.value.trim();
      const termsAccepted = form.elements['terms']?.checked;

      if (!companyName || !email || !phone || !planKey || !targetUrl) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
      }

      if (!termsAccepted) {
        alert('É necessário concordar com os Termos de Publicidade e Política de Privacidade.');
        return;
      }

      const plan = this.plans[planKey] || this.plans.starter;
      const orderId = 'ORX-' + Math.floor(100000 + Math.random() * 900000);
      const previewBox = document.getElementById('banner-preview-box');
      const bannerBase64 = previewBox ? previewBox.getAttribute('data-banner-base64') || '' : '';

      const orderData = {
        orderId,
        date: new Date().toISOString(),
        companyName,
        documentNumber,
        email,
        phone,
        website,
        planKey,
        planName: plan.name,
        amount: plan.price,
        slot: plan.slot,
        targetUrl,
        bannerUrl: bannerBase64,
        status: 'pending_payment' // Aguardando confirmação do Pix
      };

      // Salva no banco local de pedidos pendentes para o painel admin
      this.saveOrder(orderData);

      // Exibe modal ou área de pagamento Pix
      this.renderPixCheckout(orderData);
    }

    saveOrder(order) {
      try {
        const orders = JSON.parse(localStorage.getItem('orx_ads_orders') || '[]');
        orders.unshift(order);
        localStorage.setItem('orx_ads_orders', JSON.stringify(orders));
      } catch (err) {
        console.error('Falha ao armazenar pedido:', err);
      }
    }

    renderPixCheckout(order) {
      const checkoutContainer = document.getElementById('pix-checkout-modal');
      if (!checkoutContainer) return;

      const pixKey = DEFAULT_PIX_KEY;
      const amountStr = order.amount.toFixed(2).replace('.', ',');

      checkoutContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div class="bg-[#1F1511] border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 sm:p-8 text-[#FDFBF7] shadow-2xl relative">
            <button type="button" class="absolute top-4 right-4 text-[#D3CBC3] hover:text-[#FDFBF7] text-2xl font-bold" onclick="document.getElementById('pix-checkout-modal').innerHTML=''">
              &times;
            </button>
            
            <div class="flex items-center gap-2 mb-3">
              <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">Solicitação Registrada</span>
            </div>

            <h3 class="text-xl sm:text-2xl font-bold text-[#FDFBF7] font-space mb-1">Pagamento via Pix &bull; ${order.orderId}</h3>
            <p class="text-xs text-[#D3CBC3] mb-4">${order.planName} &bull; Total: <strong class="text-[#D4AF37] text-sm">R$ ${amountStr}</strong></p>

            <div class="bg-[#080E1E] p-4 rounded-2xl border border-[#4A332B] text-center mb-4">
              <div class="w-36 h-36 mx-auto bg-white p-2.5 rounded-xl flex items-center justify-center mb-3">
                <svg viewBox="0 0 100 100" class="w-full h-full text-slate-950">
                  <path fill="currentColor" d="M10 10h30v30h-30zM15 15h20v20h-20zM60 10h30v30h-30zM65 15h20v20h-20zM10 60h30v30h-30zM15 65h20v20h-20zM22 22h6v6h-6zM72 22h6v6h-6zM22 72h6v6h-6zM50 15h5v15h-5zM50 40h15v5h-15zM75 50h15v10h-15zM50 60h20v5h-20zM60 75h10v15h-10zM80 80h10v10h-10zM40 75h10v10h-10zM15 50h15v5h-15z" />
                </svg>
              </div>
              <p class="text-[11px] text-[#D3CBC3] mb-1">Chave Pix Institucional (E-mail):</p>
              <div class="flex items-center justify-center gap-2 bg-[#1F1511] p-2 rounded-lg border border-[#4A332B]">
                <code class="text-xs font-mono text-[#D4AF37] font-bold select-all">${pixKey}</code>
                <button type="button" class="text-xs px-2.5 py-0.5 rounded bg-[#2E1F1A] hover:bg-[#3D2922] text-[#FDFBF7] border border-[#D4AF37]/40" onclick="navigator.clipboard.writeText('${pixKey}'); alert('Chave Pix copiada com sucesso!');">Copiar</button>
              </div>
            </div>

            <div class="bg-[#0E1830] p-3.5 rounded-xl border border-[#1E3158] text-xs text-[#D3CBC3] space-y-1 mb-5">
              <p>&bull; <strong>Identificador do Pedido:</strong> <span class="font-mono text-[#D4AF37]">${order.orderId}</span></p>
              <p>&bull; <strong>Ativação:</strong> O banner será ativado após conferência manual do comprovante.</p>
            </div>

            <div class="flex flex-col sm:flex-row gap-2.5">
              <a href="https://wa.me/${WHATSAPP_COMMERCIAL}?text=${encodeURIComponent('Olá! Enviei a solicitação de anúncio no ORLINX ADS com o pedido ' + order.orderId + ' da empresa ' + order.companyName + ' no valor de R$ ' + amountStr + '. Segue o comprovante do Pix.')}" target="_blank" rel="noopener noreferrer" class="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950">
                Enviar Comprovante via WhatsApp &rarr;
              </a>
              <button type="button" class="py-3 px-4 rounded-xl text-xs font-semibold btn-coffee" onclick="document.getElementById('pix-checkout-modal').innerHTML=''">
                Fechar
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  window.OrlinxCommercial = new OrlinxCommercial();
})();
