(function (root) {
  'use strict';
  let sdkPromise;
  function loadSdk() {
    if (root.google?.payments?.api) return Promise.resolve();
    if (!sdkPromise) {
      sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timer = setTimeout(() => reject(new Error('SDK timeout')), 15000);
        script.src = 'https://pay.google.com/gp/p/js/pay.js';
        script.async = true;
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); reject(new Error('SDK unavailable')); };
        document.head.appendChild(script);
      });
    }
    return sdkPromise;
  }

  async function mount(container, amount) {
    if (!container || container.dataset.initialized) return;
    container.hidden = true;
    container.dataset.initialized = 'true';
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) return;
    try {
      const response = await fetch('/api/payments/google-pay/config', { cache: 'no-store' });
      if (!response.ok) return;
      const config = await response.json();
      if (config.enabled !== true || config.environment !== 'TEST') return;
      await loadSdk();
      const client = new root.google.payments.api.PaymentsClient({ environment: 'TEST' });
      const method = {
        type: 'CARD',
        parameters: { allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'], allowedCardNetworks: ['VISA', 'MASTERCARD'] },
        tokenizationSpecification: { type: 'PAYMENT_GATEWAY', parameters: { gateway: 'example', gatewayMerchantId: 'exampleGatewayMerchantId' } }
      };
      const base = { apiVersion: 2, apiVersionMinor: 0, allowedPaymentMethods: [method] };
      const ready = await client.isReadyToPay(base);
      if (!ready.result || !container.isConnected) return;
      const notice = document.createElement('p');
      notice.textContent = 'Demonstração Google Pay — nenhum valor será cobrado.';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.style.fontSize = '12px';
      const slot = document.createElement('div');
      slot.style.padding = '8px';
      let busy = false;
      const button = client.createButton({
        buttonColor: 'white', buttonType: 'pay', buttonLocale: 'pt',
        allowedPaymentMethods: [method],
        onClick: async () => {
          if (busy) return;
          busy = true;
          try {
            await client.loadPaymentData({ ...base,
              merchantInfo: { merchantName: config.merchantName },
              transactionInfo: { totalPriceStatus: 'FINAL', totalPrice: amount.toFixed(2), currencyCode: 'BRL', countryCode: 'BR' }
            });
            notice.textContent = 'Demonstração concluída. Nenhum pagamento foi processado; a proposta permanece em análise.';
          } catch (error) {
            notice.textContent = error?.statusCode === 'CANCELED'
              ? 'Demonstração cancelada. Nenhum valor foi cobrado.'
              : 'Google Pay indisponível para este teste. Nenhum valor foi cobrado.';
          } finally { busy = false; }
        }
      });
      slot.appendChild(button);
      container.replaceChildren(notice, slot);
      container.hidden = false;
    } catch (_) { container.hidden = true; }
  }
  root.OrlinxGooglePay = { mount };
})(window);
