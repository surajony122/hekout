(function() {
  // The widget may be on a page twice, from the theme setting and an older manual install.
  if (window.CheckoutFlow) return;
  window.CheckoutFlow = {
    trackEvent: async function(shop, eventName) {
      const getBase = () => {
         if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
         const scripts = document.querySelectorAll('script[src*="widget.js"]');
         for (let i = 0; i < scripts.length; i++) { try { return new URL(scripts[i].src).origin; } catch(e) {} }
         return 'https://checkoutflow-app.onrender.com';
      };
      const apiUrl = getBase() + '/api/widget/track';
      const eventPayload = { shop, sessionId: 'anon', eventName, timestamp: Date.now() };
      
      let queue = [];
      try {
        const stored = localStorage.getItem('checkoutflow_event_queue');
        if (stored) queue = JSON.parse(stored);
      } catch(e) {}
      
      queue.push(eventPayload);
      
      const newQueue = [];
      for (const ev of queue) {
        try {
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ev)
          });
        } catch (err) {
          newQueue.push(ev);
        }
      }
      
      try {
        if (newQueue.length > 0) {
          localStorage.setItem('checkoutflow_event_queue', JSON.stringify(newQueue.slice(0, 50)));
        } else {
          localStorage.removeItem('checkoutflow_event_queue');
        }
      } catch(e) {}
    },

    open: async function(options) {
      if (window._cfIsOpening || document.getElementById('checkoutflow-host')) return;
      window._cfIsOpening = true;

      const { shop, items, variantId, quantity, productTitle, productImage, price } = options;
      this.trackEvent(shop, 'WIDGET_OPENED');

      // Support old format (single item) or new format (items array)
      const cartItems = items || [{
         variantId: variantId,
         quantity: quantity || 1,
         title: productTitle || 'Product',
         price: price || 0,
         image: productImage || ''
      }];

      const getApiBaseUrl = () => {
         if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
         }
         const scripts = document.querySelectorAll('script[src*="widget.js"]');
         for (let i = 0; i < scripts.length; i++) {
            try {
               const u = new URL(scripts[i].src);
               return u.origin;
            } catch(e) {}
         }
         return 'https://checkoutflow-app.onrender.com';
      };
      const apiBaseUrl = getApiBaseUrl();
      let widgetConfig = { 
        isPrepaidDiscountEnabled: false, prepaidDiscountType: 'percentage', prepaidDiscountValue: 0, 
        isPartialCodEnabled: false, partialCodAmount: 0, codFeeAmount: 69, hasRazorpay: false,
        primaryColor: '#7c3aed',
        brandLogoUrl: '',
        preLoginBannerText: '', preLoginBannerBg: '#000000', preLoginBannerColor: '#ffffff',
        postLoginBannerText: '', postLoginBannerBg: '#ecfdf5', postLoginBannerColor: '#059669'
      };

      const primaryColor = widgetConfig.primaryColor || '#7c3aed';

      // Remove any existing widget instances to prevent duplicate ID bugs
      const existingHost = document.getElementById('checkoutflow-host');
      if (existingHost) existingHost.remove();

      const host = document.createElement('div');
      host.id = 'checkoutflow-host';
      host.style.cssText = 'all: initial; position: relative; z-index: 2147483647;';
      const widgetRoot = host.attachShadow({ mode: 'open' });

      const overlay = document.createElement('div');
      overlay.id = 'checkoutflow-overlay';
      overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:999999; display:flex; align-items:flex-end; justify-content:center; opacity:0; transition:opacity 0.25s ease;';

      const sheet = document.createElement('div');
      sheet.id = 'checkoutflow-sheet';
      sheet.style.cssText = 'width:100%; max-width:420px; height:92vh; height:92dvh; background:#f9fafb; border-top-left-radius:24px; border-top-right-radius:24px; transform:translateY(100%); transition:transform 0.32s cubic-bezier(0.32, 0.72, 0, 1); will-change:transform; overflow:hidden; display:flex; flex-direction:column; position:relative; box-shadow:0 -10px 40px rgba(0,0,0,0.25);';

      // Uses the copy fetched when the page loaded, so the popup opens without waiting.
      const configPromise = window._cfConfigPromise || fetch(`${apiBaseUrl}/api/widget/config?shop=${shop}`).then(res => res.json());
      configPromise
        .then(configData => {
           if (configData.success && configData.config) {
              widgetConfig = configData.config;
              host.style.setProperty('--p1', widgetConfig.primaryColor || '#7c3aed');
              const brand = widgetRoot.getElementById('cf-brand');
              if (brand) {
                 if (widgetConfig.brandLogoUrl) {
                    const logo = document.createElement('img');
                    logo.src = widgetConfig.brandLogoUrl;
                    logo.alt = widgetConfig.storeName || 'Store logo';
                    logo.style.cssText = 'max-height:28px; object-fit:contain;';
                    brand.replaceChildren(logo);
                 } else if (widgetConfig.storeName) {
                    brand.textContent = widgetConfig.storeName.substring(0, 24);
                 }
              }
              const banner = widgetRoot.getElementById('dynamic-banner');
              if (banner && widgetConfig.preLoginBannerText) {
                 banner.style.display = 'flex';
                 banner.style.background = widgetConfig.preLoginBannerBg || '';
                 const bannerText = widgetRoot.getElementById('cf-banner-text');
                 bannerText.textContent = widgetConfig.preLoginBannerText;
                 bannerText.style.color = widgetConfig.preLoginBannerColor || '';
              }
              if (typeof updatePricing === 'function') updatePricing();
              if (widgetConfig.hasRazorpay) {
                 loadScript(RAZORPAY_URL).catch(() => {});
                 widgetRoot.getElementById('cf-trust-payments').style.display = '';
              }
              // Settings can arrive after the customer reaches payment, so show the right methods.
              if (widgetRoot.getElementById('state-checkout').style.display === 'block') renderPaymentMethods();
           }
        }).catch(e => console.log('Config fetch fallback to default:', e));

      let totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      let subtotalBase = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      let total = subtotalBase;
      
      let verifiedPhone = '';
      let sessionToken = '';
      try {
         const stored = localStorage.getItem('checkoutflow_verified');
         if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.sessionToken && parsed.shop === shop && Date.now() - parsed.time < 24 * 60 * 60 * 1000) {
               verifiedPhone = parsed.phone;
               sessionToken = parsed.sessionToken;
            } else {
               localStorage.removeItem('checkoutflow_verified');
            }
         }
      } catch (e) {}
      let customerData = null;

      const RAZORPAY_URL = 'https://checkout.razorpay.com/v1/checkout.js';
      const CONFETTI_URL = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
      const scriptLoads = {};
      function loadScript(src) {
         if (!scriptLoads[src]) {
            scriptLoads[src] = new Promise((resolve, reject) => {
               const script = document.createElement('script');
               script.src = src;
               script.onload = resolve;
               script.onerror = () => { delete scriptLoads[src]; reject(new Error('Could not load ' + src)); };
               document.head.appendChild(script);
            });
         }
         return scriptLoads[src];
      }
      const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!document.getElementById('cf-font-preconnect')) {
         const preconnect = document.createElement('link');
         preconnect.id = 'cf-font-preconnect';
         preconnect.rel = 'preconnect';
         preconnect.href = 'https://fonts.gstatic.com';
         preconnect.crossOrigin = 'anonymous';
         document.head.appendChild(preconnect);
      }

      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
      document.head.appendChild(fontLink);

      sheet.innerHTML = `
        <svg class="cf-sprite" aria-hidden="true"><symbol id="ic-arrow-left" viewBox="0 0 24 24"><line x1="20" y1="12" x2="5" y2="12"></line><polyline points="11 6 5 12 11 18"></polyline></symbol><symbol id="ic-shield-check" viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V6l8-3Z"></path><polyline points="8.5 12 11 14.5 15.5 9.5"></polyline></symbol><symbol id="ic-truck" viewBox="0 0 24 24"><path d="M2 6h11v10H2V6Z"></path><path d="M13 9h4.5L21 12.5V16h-8"></path><circle cx="6.5" cy="18.5" r="1.8"></circle><circle cx="17" cy="18.5" r="1.8"></circle></symbol><symbol id="ic-cart" viewBox="0 0 24 24"><path d="M2.5 4h2.2l2.6 10.5h10.4L21 7H6"></path><circle cx="9" cy="19" r="1.6"></circle><circle cx="17" cy="19" r="1.6"></circle></symbol><symbol id="ic-chevron-down" viewBox="0 0 24 24"><polyline points="5 9 12 16 19 9"></polyline></symbol><symbol id="ic-chevron-right" viewBox="0 0 24 24"><polyline points="9 5 16 12 9 19"></polyline></symbol><symbol id="ic-tag" viewBox="0 0 24 24"><path d="M3 3h8l10 10-8 8L3 11V3Z"></path><circle cx="7.5" cy="7.5" r="1.4"></circle></symbol><symbol id="ic-map-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.6"></circle></symbol><symbol id="ic-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><polyline points="8 12 11 15 16 9"></polyline></symbol><symbol id="ic-x" viewBox="0 0 24 24"><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></symbol><symbol id="ic-qr-code" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.3"></rect><rect x="14" y="3" width="7" height="7" rx="1.3"></rect><rect x="3" y="14" width="7" height="7" rx="1.3"></rect><line x1="14" y1="14" x2="17" y2="14"></line><line x1="20" y1="14" x2="21" y2="14"></line><line x1="14" y1="18" x2="14" y2="21"></line><line x1="18" y1="17.5" x2="21" y2="17.5"></line><line x1="18" y1="21" x2="21" y2="21"></line></symbol><symbol id="ic-credit-card" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.2"></rect><line x1="2.5" y1="10" x2="21.5" y2="10"></line><line x1="6" y1="15" x2="10" y2="15"></line></symbol><symbol id="ic-wallet" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5"></rect><path d="M3 10h18"></path><circle cx="16.5" cy="14.5" r="1.3"></circle></symbol><symbol id="ic-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><line x1="3" y1="12" x2="21" y2="12"></line><path d="M12 3c2.6 2.4 4 5.4 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.4-4-9s1.4-6.6 4-9Z"></path></symbol><symbol id="ic-banknote" viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="19" height="11" rx="2"></rect><circle cx="12" cy="12" r="2.6"></circle><line x1="6" y1="12" x2="6.01" y2="12"></line><line x1="18" y1="12" x2="18.01" y2="12"></line></symbol><symbol id="ic-star" viewBox="0 0 24 24"><path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.9l6.1-.8L12 3.5Z"></path></symbol><symbol id="ic-lock" viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="10.5" rx="2"></rect><path d="M8 10V7.5a4 4 0 0 1 8 0V10"></path></symbol></svg>
        <style>
          :host {
  --p1: #6d28d9; /* Deep Purple Accent */
  --p1-light: #f5f3ff; /* Very Light Purple for active backgrounds */
  --bg: #f9fafb; /* Canvas Background */
  --surface: #ffffff; /* Card Background */
  --border: #e5e7eb; /* Light border */
  --border-active: #8b5cf6;
  --text-main: #111827; /* Dark Slate */
  --text-muted: #6b7280; /* Muted Gray */
  --green: #16a34a; /* Success Green */
  --red: #dc2626; /* Alert Red */
  --text1: #111827;
  --text2: #4b5563;
  --text3: #6b7280;
  --border2: #e5e7eb;
  --radius: 16px;
  --radius-sm: 10px;
  --radius-lg: 24px;
  --font: 'Poppins', sans-serif;
  
  font-family: var(--font);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font); }

/* Main Sheet */
.sheet-container {
  width: 100%; max-width: 420px; height: 92vh; 
  background: var(--bg);
  border-top-left-radius: var(--radius-lg); 
  border-top-right-radius: var(--radius-lg); 
  transform: translateY(100%); 
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
  overflow: hidden; display: flex; flex-direction: column; 
  position: relative; box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
}

/* Header */
.top-header { background: var(--bg); padding: 16px 20px 12px; display: flex; align-items: center; position: relative; }
.back-btn { cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
.back-btn svg { width: 24px; height: 24px; stroke: var(--text-main); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.brand-center { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; margin-right: 32px; }
.brand-title { font-weight: 700; font-size: 16px; letter-spacing: 1px; color: var(--text-main); text-transform: uppercase; }
.brand-subtitle { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
.brand-subtitle svg { width: 12px; height: 12px; stroke: var(--text-muted); fill: none; stroke-width: 2; }

/* Scrollable Body */
.scroll-body { padding: 0 16px 24px; flex: 1; overflow-y: auto; background: var(--bg); }

/* Promo Banner */
.promo-banner {
  background: var(--p1-light); border-radius: var(--radius-sm);
  padding: 10px; margin-top: 4px; margin-bottom: 20px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.promo-banner svg { width: 18px; height: 18px; stroke: var(--p1); fill: none; stroke-width: 2; }
.promo-text { font-size: 12px; font-weight: 500; color: var(--text-main); }
.promo-text strong { color: var(--p1); font-weight: 700; }

/* Design Cards */
.design-card {
  background: var(--surface);
  border: 1px dashed var(--border); /* Dotted/dashed border like image */
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  display: flex; align-items: center; gap: 14px;
  cursor: pointer;
}
.design-card.solid-border { border: 1px solid var(--border); }

/* Icon Box inside Cards */
.icon-box {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.icon-box.purple { background: var(--p1-light); color: var(--p1); }
.icon-box.orange { background: #fff7ed; color: #f97316; }
.icon-box svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* Card Content */
.card-content { flex: 1; }
.card-title { font-size: 14px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; justify-content: space-between; }
.card-subtitle { font-size: 12px; font-weight: 500; color: var(--text-muted); margin-top: 2px; }
.card-price-col { text-align: right; }
.card-price { font-size: 16px; font-weight: 700; color: var(--text-main); }
.card-price-sub { font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 2px; }

.chevron-icon { width: 16px; height: 16px; stroke: var(--text-main); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.change-link { color: var(--p1); font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.change-link svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }
.home-tag { background: var(--p1-light); color: var(--p1); font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 12px; margin-left: 8px; }

/* Section Label */
.sec-lbl { font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 24px 0 12px 4px; text-transform: uppercase; letter-spacing: 0.5px; }

/* Payment Cards */
.pay-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 14px;
  cursor: pointer; transition: all 0.2s; position: relative;
}
.pay-card.active { border-color: var(--border-active); background: var(--p1-light); }

.pay-icon-box {
  width: 48px; height: 48px; border-radius: var(--radius-sm); border: 1px solid var(--border);
  background: var(--surface); display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.pay-icon-box svg, .pay-icon-box img { max-width: 32px; max-height: 32px; stroke: var(--p1); fill: none; stroke-width: 1.5; }

.pay-content { flex: 1; }
.pay-title { font-size: 14px; font-weight: 600; color: var(--text-main); }
.pay-subtitle { font-size: 11px; font-weight: 500; color: var(--text-muted); margin-top: 2px; }
.pay-savings { font-size: 11px; font-weight: 600; color: var(--green); margin-top: 4px; background: #dcfce7; display: inline-block; padding: 2px 6px; border-radius: 4px; }

.pay-right { text-align: right; display: flex; align-items: center; gap: 12px; }
.pay-price { font-size: 15px; font-weight: 700; color: var(--text-main); }
.pay-price.red { color: var(--red); }

.arrow-circle {
  width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center; color: var(--text-muted);
}
.arrow-circle svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pay-card.active .arrow-circle { background: var(--p1); border-color: var(--p1); color: #ffffff; }

.recommended-tag {
  position: absolute; top: 12px; right: 16px;
  background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 700;
  padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;
}
.recommended-tag svg { width: 10px; height: 10px; fill: currentColor; }

/* Trust Badges Footer */
.trust-footer {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 32px; margin-bottom: 24px;
  border-top: 1px solid var(--border); padding-top: 24px;
}
.trust-item { display: flex; flex-direction: column; align-items: center; text-align: center; }
.trust-icon {
  width: 32px; height: 32px; border-radius: 50%; margin-bottom: 8px;
  display: flex; align-items: center; justify-content: center;
}
.trust-icon.purple { background: #f3e8ff; color: #7e22ce; }
.trust-icon.green { background: #dcfce7; color: #15803d; }
.trust-icon.blue { background: #dbeafe; color: #1d4ed8; }
.trust-icon.orange { background: #ffedd5; color: #c2410c; }
.trust-icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; }
.trust-title { font-size: 10px; font-weight: 700; color: var(--text-main); line-height: 1.2; }
.trust-sub { font-size: 9px; font-weight: 500; color: var(--text-muted); margin-top: 2px; }

/* Overlays */
.cf-payment-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: flex-end; }

/* Floating Label Inputs */
.cf-float-group {
  position: relative;
  margin-bottom: 12px;
}
.cf-float-input {
  width: 100%;
  padding: 18px 12px 6px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  background: var(--surface);
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
}
.cf-float-input:focus {
  border-color: var(--p1);
}
.cf-float-input:disabled {
  background: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}
.cf-float-label {
  position: absolute;
  top: 14px;
  left: 12px;
  font-size: 14px;
  color: var(--text2);
  transition: 0.2s ease all;
  pointer-events: none;
  background: var(--surface);
  padding: 0 4px;
  border-radius: 4px;
  font-weight: 500;
}
/* When disabled, ensure label bg matches input bg */
.cf-float-input:disabled ~ .cf-float-label {
  background: transparent;
}
/* Float up when focused or not empty (placeholder-shown) */
.cf-float-input:focus ~ .cf-float-label,
.cf-float-input:not(:placeholder-shown) ~ .cf-float-label {
  top: -8px;
  font-size: 11px;
  color: var(--p1);
  background: var(--surface);
}
.cf-float-input:disabled:not(:placeholder-shown) ~ .cf-float-label {
  color: #6b7280;
  background: linear-gradient(180deg, var(--surface) 50%, #f3f4f6 50%);
}

/* Radio Buttons */
.cf-radio-group {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
.cf-radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.cf-radio-label input[type="radio"] {
  accent-color: #ea580c;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* Saved Address Card */
.cf-address-card {
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface);
}
.cf-address-card.selected {
  border-color: var(--p1);
  background: var(--p1-light);
}
.cf-address-card-info {
  flex: 1;
}
.cf-address-card-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cf-address-card-type {
  font-size: 10px;
  font-weight: 700;
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.cf-address-card.selected .cf-address-card-type {
  background: #ddd6fe;
  color: var(--p1);
}
.cf-address-card-details {
  font-size: 13px;
  color: var(--text2);
  line-height: 1.4;
}

          :host { --p1: ${primaryColor}; }
          
          /* Custom form styles */
          .cf-input { width: 100%; height: 48px; padding: 0 16px; border: 1.5px solid var(--border2); border-radius: var(--radius-sm); font-size: 14px; font-family: var(--font); color: var(--text1); outline: none; transition: border-color 0.2s; margin-bottom: 12px; }
          .cf-input:focus { border-color: var(--p1); }
          .cf-btn { width: 100%; height: 52px; background: var(--p1); color: #fff; border: none; border-radius: var(--radius); font-size: 15px; font-weight: 600; cursor: pointer; font-family: var(--font); transition: transform 0.15s, box-shadow 0.15s; }
          .cf-btn:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 6px 16px rgba(15,23,42,0.14); }
          .cf-btn:active:not(:disabled) { transform: scale(0.98); }
          .cf-btn:disabled { opacity: 0.55; cursor: not-allowed; }
          .cf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
          .cf-btn:focus-visible, .cf-link:focus-visible, .pay-card:focus-visible, .design-card:focus-visible, .back-btn:focus-visible { outline: 2px solid var(--p1); outline-offset: 2px; }
          .cf-input { font-size: 16px; }
          .cf-float-input { font-size: 16px; }
          .cf-link { background: none; border: none; padding: 6px 0; color: var(--p1); font: inherit; font-weight: 600; cursor: pointer; }
          .cf-link:disabled { color: var(--text-muted); cursor: default; }
          .cf-phone-field { display: flex; align-items: center; background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 4px 12px; margin-bottom: 16px; transition: border-color 0.2s, box-shadow 0.2s; }
          .cf-phone-field:focus-within { border-color: var(--p1); box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
          .cf-otp-input { width: 100%; border: 1.5px solid var(--border); border-radius: 12px; padding: 14px; font-size: 20px; text-align: center; letter-spacing: 12px; outline: none; font-weight: 600; color: var(--text-main); background: var(--surface); transition: border-color 0.2s, box-shadow 0.2s; }
          .cf-otp-input:focus { border-color: var(--p1); box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
          .cf-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: cf-spin 0.7s linear infinite; }
          .cf-grabber { width: 40px; height: 4px; background: #d1d5db; border-radius: 4px; margin: 8px auto 0; flex-shrink: 0; }

          #cf-notice { position: absolute; top: 12px; left: 16px; right: 16px; z-index: 950; padding: 12px 14px; border-radius: 12px; background: #111827; color: #fff; font-size: 13px; font-weight: 500; line-height: 1.4; box-shadow: 0 10px 30px rgba(15,23,42,0.3); opacity: 0; transform: translateY(-12px); pointer-events: none; transition: opacity 0.2s, transform 0.2s; }
          #cf-notice.show { opacity: 1; transform: translateY(0); }

          .cf-skeleton { display: inline-block; min-width: 64px; min-height: 16px; border-radius: 6px; background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%); background-size: 200% 100%; animation: cf-shimmer 1.2s linear infinite; }
          .cf-pop { animation: cf-pop 0.3s ease; }
          .cf-shake { animation: cf-shake 0.35s ease; }
          .pay-card, .design-card { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
          .pay-card:hover, .design-card:hover { border-color: var(--border-active); box-shadow: 0 4px 14px rgba(15,23,42,0.07); }
          .pay-card:active, .design-card:active { transform: scale(0.985); }
          .trust-footer { grid-template-columns: repeat(2, 1fr); }

          .cf-sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
          #checkoutflow-sheet svg:not(.cf-sprite) { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
          .pay-icon-box { color: var(--p1); }
          .pay-icon-box svg { width: 24px; height: 24px; }
          .recommended-tag svg { width: 11px; height: 11px; fill: currentColor !important; }
          .cf-success-check { color: var(--green); }
          .cf-heading { color: var(--text-main); font-size: 18px; font-weight: 700; }

          /* Keeps content and the main action clear of the phone's bottom edge. */
          .scroll-body { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
          /* The negative values cancel the scroll area's bottom padding, so nothing shows beneath the button. */
          .cf-sticky-action { position: sticky; bottom: calc(-1 * max(24px, env(safe-area-inset-bottom))); z-index: 5; margin: 16px -16px calc(-1 * max(24px, env(safe-area-inset-bottom))); padding: 12px 16px max(16px, env(safe-area-inset-bottom)); background: var(--bg); box-shadow: 0 -8px 16px -12px rgba(15,23,42,0.25); }
          .cf-payment-drawer { width: calc(100% - 24px) !important; margin: 0 auto max(12px, env(safe-area-inset-bottom)) !important; border-radius: 20px !important; max-height: 85%; overflow-y: auto; }
          .cf-payment-overlay { z-index: 300; }
          .card-content, .pay-content { min-width: 0; }
          .card-title { gap: 6px; }
          .card-title .chevron-icon { flex-shrink: 0; }
          .card-price-col { flex-shrink: 0; }
          .pay-card { padding: 14px; gap: 12px; }
          .pay-card.active { margin-top: 18px; }
          .pay-subtitle > div { flex-wrap: wrap; gap: 4px 10px !important; }
          .pay-right { flex-shrink: 0; gap: 8px; }
          .pay-icon-box { width: 42px; height: 42px; }
          .recommended-tag { top: -10px; right: auto; left: 14px; }
          #cf-edit-addr { flex-shrink: 0; cursor: pointer; }
          .brand-center { min-width: 0; }

          #state-phone, #state-address-list, #state-address, #state-checkout, #cf-otp-box { animation: cf-screen-in 0.26s cubic-bezier(0.16, 1, 0.3, 1) both; }
          #state-checkout > .design-card, #pay-methods-container > .pay-card { animation: cf-screen-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
          #pay-methods-container > .pay-card:nth-child(2) { animation-delay: 0.04s; }
          #pay-methods-container > .pay-card:nth-child(3) { animation-delay: 0.08s; }
          #pay-methods-container > .pay-card:nth-child(4) { animation-delay: 0.12s; }
          #pay-methods-container > .pay-card:nth-child(5) { animation-delay: 0.16s; }
          .cf-payment-overlay { animation: cf-fade-in 0.2s ease both; }
          .cf-payment-drawer { animation: cf-slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1) both; }
          .cf-success-check { animation: cf-check-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
          .success-screen { animation: cf-fade-in 0.25s ease both; }

          @keyframes cf-spin { to { transform: rotate(360deg); } }
          @keyframes cf-shimmer { to { background-position: -200% 0; } }
          @keyframes cf-pop { 40% { transform: scale(1.08); } }
          @keyframes cf-shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
          @keyframes cf-screen-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
          @keyframes cf-fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cf-slide-up { from { transform: translateY(100%); } to { transform: none; } }
          @keyframes cf-check-in { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: none; } }

          /* Inputs stay 16px because iPhones zoom the page in on anything smaller. */
          @media (max-width: 480px) {
            .top-header { padding: 8px 14px 8px; }
            .scroll-body { padding-left: 12px; padding-right: 12px; }
            .cf-sticky-action { margin-left: -12px; margin-right: -12px; padding-left: 12px; padding-right: 12px; }
            .brand-title { font-size: 14px; }
            .brand-subtitle { font-size: 10px; }
            .cf-heading { font-size: 16px; }
            .promo-banner { padding: 8px; margin-bottom: 12px; }
            .promo-text { font-size: 11px; }
            .design-card { padding: 10px 12px; margin-bottom: 8px !important; gap: 10px; }
            .icon-box { width: 34px; height: 34px; }
            .icon-box svg { width: 17px; height: 17px; }
            .card-title { font-size: 13px; }
            .card-subtitle { font-size: 11px; }
            .card-price { font-size: 14px; }
            .change-link { font-size: 12px; }
            .sec-lbl { font-size: 10px; margin: 14px 0 8px 2px; }
            .pay-card { padding: 10px 12px; margin-bottom: 8px; gap: 10px; }
            .pay-card.active { margin-top: 14px; }
            .pay-icon-box { width: 36px; height: 36px; }
            .pay-icon-box svg { width: 20px; height: 20px; }
            .pay-title { font-size: 13px; }
            .pay-subtitle, .pay-subtitle span { font-size: 10px !important; }
            .pay-price { font-size: 13px; }
            .arrow-circle { width: 22px; height: 22px; }
            .recommended-tag { font-size: 9px; }
            .trust-footer { margin-top: 16px; margin-bottom: 8px; padding-top: 14px; }
            .cf-btn { height: 46px; font-size: 14px; }
            .cf-float-group { margin-bottom: 10px; }
            .cf-float-label { font-size: 13px; }
            .cf-address-card { padding: 12px; margin-bottom: 8px; }
            .cf-address-card-name { font-size: 13px; }
            .cf-address-card-details { font-size: 12px; }
          }

          @media (min-width: 640px) {
            #checkoutflow-overlay { align-items: center !important; }
            #checkoutflow-sheet { height: min(720px, 90vh) !important; border-radius: 24px !important; }
            .cf-grabber { display: none; }
            .cf-payment-overlay { position: absolute !important; }
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: 0.01ms !important; animation-delay: 0ms !important; transition-duration: 0.01ms !important; }
          }
        </style>
        
        
        <div id="cf-notice" role="alert"></div>
        <div class="cf-grabber" aria-hidden="true"></div>
        <canvas id="confetti-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1000;"></canvas>

        <div class="top-header">
          <div class="back-btn" id="cf-close-btn" role="button" tabindex="0" aria-label="Close checkout">
            <svg viewBox="0 0 24 24"><use href="#ic-arrow-left"/></svg>
          </div>
          <div class="brand-center">
            <div class="brand-title" id="cf-brand">${shop.split('.')[0].substring(0,18)}</div>
            <div class="brand-subtitle"><svg viewBox="0 0 24 24"><use href="#ic-shield-check"/></svg> Secure Checkout</div>
          </div>
        </div>

        <div class="scroll-body">
          <div class="promo-banner" id="dynamic-banner" style="display:none;">
            <svg viewBox="0 0 24 24"><use href="#ic-truck"/></svg>
            <span class="promo-text" id="cf-banner-text"></span>
          </div>

          <!-- STATE 1: PHONE -->
          <div id="state-phone" style="padding: 10px 0;">
             <h3 class="cf-heading" style="margin-bottom:4px;">Enter your mobile number</h3>
             <p style="margin-bottom:16px; color:var(--text-muted); font-size:13px;">We'll send a code to confirm it's you.</p>
             
             <div class="cf-phone-field">
               <div style="display:flex; align-items:center; gap:6px; padding-right:12px; border-right:1.5px solid var(--border); font-weight:600; font-size:15px; color:var(--text-main);">
                 <span>🇮🇳</span> <span>+91</span>
               </div>
               <input type="tel" id="cf-phone-in" aria-label="Mobile number" style="flex:1; min-width:0; border:none; background:transparent; padding:12px; font-size:16px; outline:none; font-weight:600; color:var(--text-main); letter-spacing:1px;" placeholder="10-digit number" maxlength="10" inputmode="numeric" autocomplete="tel-national" />
             </div>
             
             <div id="cf-otp-box" style="display:none; margin-bottom:16px;">
               <div id="cf-otp-sent" style="font-size:13px; font-weight:500; color:var(--text2); margin-bottom:8px; text-align:center;">Enter the 6-digit code</div>
               <input type="text" id="cf-otp-in" aria-label="6-digit code" class="cf-otp-input" placeholder="••••••" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
               <div id="cf-otp-err" role="alert" style="color:var(--red); font-size:12px; font-weight:600; text-align:center; display:none; margin-top:8px;"></div>
               <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:13px; font-weight:600;">
                 <button type="button" id="cf-change-phone" class="cf-link">Change number</button>
                 <button type="button" id="cf-resend" class="cf-link" disabled>Resend code</button>
               </div>
             </div>
             <button id="cf-phone-btn" class="cf-btn">Continue</button>
             <div id="cf-phone-err" role="alert" style="color:var(--red); font-size:12px; font-weight:600; text-align:center; margin-top:10px; display:none;"></div>
          </div>

          <!-- STATE 1.5: ADDRESS LIST -->
          <div id="state-address-list" style="display:none; padding: 10px 0;">
             <h3 class="cf-heading" style="margin-bottom:12px;">Select delivery address</h3>
             <div id="cf-address-cards" style="margin-bottom:16px;"></div>
             <button id="cf-addr-new-btn" class="cf-btn" style="background:var(--surface); color:var(--p1); border:1.5px solid var(--p1); margin-bottom:16px;">+ Add New Address</button>
             <div class="cf-sticky-action"><button id="cf-addr-sel-btn" class="cf-btn">Continue</button></div>
          </div>

          <!-- STATE 2: ADDRESS FORM -->
          <div id="state-address" style="display:none; padding: 10px 0;">
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
               <h3 class="cf-heading" style="margin:0;">Add new address</h3>
               <div id="cf-addr-back" style="font-size:14px; font-weight:600; color:var(--p1); cursor:pointer; display:none;">Cancel</div>
             </div>
             
             <div class="cf-float-group">
                <input type="text" id="cf-addr-pin" class="cf-float-input" placeholder=" " maxlength="6" inputmode="numeric" autocomplete="postal-code" />
                <label class="cf-float-label">Pincode<span style="color:var(--red);">*</span></label>
             </div>
             
             <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
               <div class="cf-float-group">
                  <input type="text" id="cf-addr-fname" class="cf-float-input" placeholder=" " />
                  <label class="cf-float-label">First name<span style="color:var(--red);">*</span></label>
               </div>
               <div class="cf-float-group">
                  <input type="text" id="cf-addr-lname" class="cf-float-input" placeholder=" " />
                  <label class="cf-float-label">Last name<span style="color:var(--red);">*</span></label>
               </div>
             </div>
             
             <div class="cf-float-group">
                <input type="text" id="cf-addr-street" class="cf-float-input" placeholder=" " />
                <label class="cf-float-label">Flat, house number, floor, building<span style="color:var(--red);">*</span></label>
             </div>
             
             <div class="cf-float-group">
                <input type="text" id="cf-addr-area" class="cf-float-input" placeholder=" " />
                <label class="cf-float-label">Area, street, sector, village<span style="color:var(--red);">*</span></label>
             </div>
             
             <div class="cf-float-group">
                <input type="text" id="cf-addr-landmark" class="cf-float-input" placeholder=" " />
                <label class="cf-float-label">Landmark area</label>
             </div>
             
             <div class="cf-float-group" style="margin-bottom:20px;">
                <input type="text" id="cf-addr-phone" class="cf-float-input" placeholder=" " disabled />
                <label class="cf-float-label">Receiver's number<span style="color:var(--red);">*</span></label>
                <div style="font-size:11px; font-weight:600; font-style:italic; color:var(--text2); margin-top:4px;">We'll contact you on this number during delivery</div>
             </div>
             
             <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
               <div class="cf-float-group">
                  <input type="text" id="cf-addr-city" class="cf-float-input" placeholder=" " disabled />
                  <label class="cf-float-label">City<span style="color:var(--red);">*</span></label>
               </div>
               <div class="cf-float-group">
                  <input type="text" id="cf-addr-state" class="cf-float-input" placeholder=" " disabled />
                  <label class="cf-float-label">State<span style="color:var(--red);">*</span></label>
               </div>
             </div>
             
             <div class="cf-float-group" style="margin-bottom:20px;">
                <input type="email" id="cf-addr-email" class="cf-float-input" placeholder=" " />
                <label class="cf-float-label">E-mail</label>
                <div style="font-size:11px; font-weight:600; font-style:italic; color:var(--text2); margin-top:4px;">Order delivery details will be sent here</div>
             </div>
             
             <div style="margin-bottom:24px;">
               <div style="font-size:13px; font-weight:700; color:var(--text-main);">Address type</div>
               <div class="cf-radio-group">
                 <label class="cf-radio-label"><input type="radio" name="cf-addr-type" value="Home" checked /> Home</label>
                 <label class="cf-radio-label"><input type="radio" name="cf-addr-type" value="Office" /> Office</label>
                 <label class="cf-radio-label"><input type="radio" name="cf-addr-type" value="Others" /> Others</label>
               </div>
             </div>
             
             <div class="cf-sticky-action"><button id="cf-addr-btn" class="cf-btn">Save Address</button></div>
          </div>

          <!-- STATE 3: CHECKOUT (GOKWIK UI) -->
          <div id="state-checkout" style="display:none;">
            
             <!-- Order Summary -->
             <div class="design-card solid-border" onclick="window.cfToggleDrawer('drwBill', true)">
               <div class="icon-box purple"><svg viewBox="0 0 24 24"><use href="#ic-cart"/></svg></div>
               <div class="card-content">
                  <div class="card-title"><span>Order Summary (<span id="osItemCount">${totalQuantity} item${totalQuantity>1?'s':''}</span>)</span> <svg class="chevron-icon" viewBox="0 0 24 24"><use href="#ic-chevron-down"/></svg></div>
                  <div class="card-subtitle" id="osShippingText" style="color:var(--green); font-weight:600;">+ Free Shipping</div>
               </div>
               <div class="card-price-col">
                  <div class="card-price" id="hFinal">₹${total.toLocaleString('en-IN')}</div>
                  <div class="card-price-sub" id="osFinalPrice">₹${total.toLocaleString('en-IN')}</div>
               </div>
             </div>

             <!-- Apply Coupon -->
             <div class="design-card solid-border" id="osCpnLink" style="margin-bottom: 24px;" onclick="window.cfToggleDrawer('drwCoupon', true)">
               <div class="icon-box orange"><svg viewBox="0 0 24 24"><use href="#ic-tag"/></svg></div>
               <div class="card-content">
                  <div class="card-title" style="color: #f97316;" id="osCpnLinkText">Apply Coupon</div>
                  <div class="card-subtitle" id="osCpnSubtitle">Unlock extra savings on your order</div>
               </div>
               <svg class="chevron-icon" viewBox="0 0 24 24"><use href="#ic-chevron-right"/></svg>
             </div>

             <!-- Delivered To -->
             <div class="design-card solid-border">
               <div class="icon-box purple"><svg viewBox="0 0 24 24"><use href="#ic-map-pin"/></svg></div>
               <div class="card-content">
                  <div class="card-title" style="font-size:12px; font-weight:500; color:var(--text-main);">Delivered To</div>
                  <div class="card-title" style="margin-top:4px;"><span id="disp-name">Name</span> <span class="home-tag">Home</span></div>
                  <div class="card-subtitle" id="disp-addr">Address</div>
               </div>
               <div class="change-link" id="cf-edit-addr">Change <svg viewBox="0 0 24 24"><use href="#ic-chevron-down"/></svg></div>
             </div>

             <div class="sec-lbl">PAYMENT METHODS</div>
             <div id="pay-methods-container">
               <!-- Injected -->
             </div>

             <div class="trust-footer">
               <div class="trust-item" id="cf-trust-payments" style="display:none;">
                 <div class="trust-icon purple"><svg viewBox="0 0 24 24"><use href="#ic-lock"/></svg></div>
                 <div class="trust-title">Secure payments</div>
                 <div class="trust-sub">Processed by Razorpay</div>
               </div>
               <div class="trust-item">
                 <div class="trust-icon green"><svg viewBox="0 0 24 24"><use href="#ic-shield-check"/></svg></div>
                 <div class="trust-title">Verified login</div>
                 <div class="trust-sub">Protected by OTP</div>
               </div>
             </div>
          </div>
        </div>
        <!-- DRAWERS WRAPPER -->
        <div id="drawers-container">

         
            <div class="cf-payment-overlay" id="drwBill" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:300; align-items:flex-end;" onclick="this.style.display='none'">
              <div class="cf-payment-drawer" style="width:100%; max-width:420px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                   <div style="font-size:18px; font-weight:600;">Order Summary</div>
                   <svg viewBox="0 0 24 24" onclick="window.cfToggleDrawer('drwBill', false)" style="width:24px; height:24px; stroke:var(--text3); fill:none; stroke-width:2; cursor:pointer;"><use href="#ic-x"/></svg>
                </div>
                <div class="card" style="padding:16px; border:1.5px solid var(--border); border-radius:12px; background:var(--bg);">
                   <div id="cart-items-container">
                     ${cartItems.map((item, index) => `
                     <div id="oi${index}" style="display:flex; align-items:center; gap:12px; padding:12px 0; ${index > 0 ? 'border-top:1.5px dashed var(--border);' : ''} ${index === 0 ? 'padding-top:0;' : ''} ${index === cartItems.length-1 ? 'padding-bottom:0;' : ''}">
                       <div style="width:50px; height:50px; border-radius:8px; border:1px solid var(--border); overflow:hidden; background:var(--surface); display:flex; align-items:center; justify-content:center; flex-shrink:0;">${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;"/>` : '🛍️'}</div>
                       <div style="flex:1;">
                         <div style="font-size:14px; font-weight:600; color:var(--text-main); margin-bottom:6px;">${item.title || 'Product'}</div>
                         <div style="display:flex; align-items:center; gap:10px;">
                           <div onclick="window.cfUpdateQty(${index}, -1)" style="width:24px; height:24px; border:1.5px solid var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:600; color:var(--text-main); ${cartItems.length > 1 ? 'display:none;' : ''}">−</div>
                           <span id="q${index}" style="font-size:13px; font-weight:600; color:var(--text-main); min-width:12px; text-align:center;">${item.quantity}</span>
                           <div onclick="window.cfUpdateQty(${index}, 1)" style="width:24px; height:24px; border:1.5px solid var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:600; color:var(--text-main); ${cartItems.length > 1 ? 'display:none;' : ''}">+</div>
                         </div>
                       </div>
                       <div style="font-weight:700; color:var(--text-main); font-size:15px; margin-left:12px;" id="p${index}">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
                     </div>
                     `).join('')}
                   </div>
                </div>
                <div style="font-size:16px; font-weight:700; margin:20px 0 12px; color:var(--text-main);">Bill summary</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px;"><span style="color:var(--text2); font-weight:500;">Sub total</span><span id="tSub" style="color:var(--text-main); font-weight:600;">₹${total.toLocaleString('en-IN')}</span></div>
                <div id="trDisc" style="display:none; justify-content:space-between; margin-bottom:10px; font-size:14px;"><span style="color:var(--text2); font-weight:500;">Discount on MRP</span><span id="tDisc" style="color:var(--green); font-weight:600;">-₹0</span></div>
                <div id="trShip" style="display:none; justify-content:space-between; margin-bottom:10px; font-size:14px;"><span style="color:var(--text2); font-weight:500;">Shipping Fee</span><span id="tShipFee" style="color:var(--text-main); font-weight:600;">₹0</span></div>
                <div id="trTax" style="display:none; justify-content:space-between; margin-bottom:10px; font-size:14px;"><span style="color:var(--text2); font-weight:500;">Tax</span><span id="tTax" style="color:var(--text-main); font-weight:600;"></span></div>
                <div id="trCod" style="display:none; justify-content:space-between; margin-bottom:10px; font-size:14px;"><span style="color:var(--text2); font-weight:500;">COD Fee</span><span id="tCodFee" style="color:var(--text-main); font-weight:600;">₹${widgetConfig.codFeeAmount}</span></div>
                <hr style="border:none; border-top:1.5px dashed var(--border); margin:12px 0;">
                <div style="display:flex; justify-content:space-between; font-size:16px; align-items:center;"><span style="color:var(--text1); font-weight:700;">Total amount</span><span id="tGrand" style="color:var(--text-main); font-weight:700; font-size:18px;">₹${total.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
         

         
         
            <div class="cf-payment-overlay" id="drwCoupon" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:300; align-items:flex-end;" onclick="this.style.display='none'">
              <div class="cf-payment-drawer" style="width:100%; max-width:420px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                   <div style="font-size:18px; font-weight:600;">Apply Coupon</div>
                   <svg viewBox="0 0 24 24" onclick="window.cfToggleDrawer('drwCoupon', false)" style="width:24px; height:24px; stroke:var(--text3); fill:none; stroke-width:2; cursor:pointer;"><use href="#ic-x"/></svg>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:16px;">
                   <input type="text" id="cpn-manual-input" class="cf-input" placeholder="Enter coupon code" style="margin-bottom:0; flex:1; text-transform:uppercase; font-weight:500;" />
                   <button class="cf-btn" id="cpn-manual-btn" style="width:auto; padding:0 24px; font-size:14px;">Apply</button>
                </div>
                <div id="cpn-manual-err" style="color:var(--red); font-size:12px; font-weight:600; display:none; margin-bottom:16px;"></div>
                
              </div>
            </div>
         

</div>
        
        <!-- SUCCESS SCREEN -->
        <div class="success-screen" id="successScr" style="display:none; flex-direction:column; align-items:center; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--bg); z-index:900; text-align:center;">
          <div class="s-icon" style="margin-top:80px;"><svg class="cf-success-check" viewBox="0 0 24 24" style="width:64px; height:64px; stroke:var(--green); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><use href="#ic-check-circle"/></svg></div>
          <div class="s-title" id="cf-success-title" style="font-size:24px; font-weight:600; color:var(--text1); margin-top:24px;">Order placed!</div>
          <div class="s-sub" id="cf-success-sub" style="font-size:15px; color:var(--text3); margin-top:8px;">Your order is confirmed.</div>
          <button class="cf-btn" id="close-success-btn" style="margin-top:40px; width:80%;">Close</button>
        </div>
      `;

      overlay.appendChild(sheet);
      widgetRoot.appendChild(overlay);
      document.body.appendChild(host);
      document.body.style.overflow = 'hidden';

      // Forcing a layout starts the transition from the off-screen position.
      void sheet.offsetHeight;
      overlay.style.opacity = '1';
      sheet.style.transform = 'none';

      const closeWidget = () => {
        sheet.style.transform = window.innerWidth >= 640 ? 'translateY(24px) scale(0.98)' : 'translateY(100%)';
        overlay.style.opacity = '0';
        setTimeout(() => { 
          const h = document.getElementById('checkoutflow-host');
          if (h) h.remove();
          document.body.style.overflow = '';
          window._cfIsOpening = false;
        }, 280);
      };
      widgetRoot.getElementById('cf-close-btn').onclick = closeWidget;
      widgetRoot.getElementById('cf-close-btn').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') closeWidget(); };
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeWidget(); });

      // Friendly messages inside the popup, in place of browser alerts.
      let noticeTimer;
      const notify = (message) => {
         const notice = widgetRoot.getElementById('cf-notice');
         notice.textContent = message;
         notice.classList.add('show');
         clearTimeout(noticeTimer);
         noticeTimer = setTimeout(() => notice.classList.remove('show'), 5000);
      };

      // Confetti Logic
      
      window.launchConfetti = async () => {
         if (prefersReducedMotion()) return;
         const canvas = widgetRoot.getElementById('confetti-canvas');
         if (!canvas) return;
         try {
            await loadScript(CONFETTI_URL);
            const myConfetti = window.confetti.create(canvas, { resize: true, useWorker: true });
            myConfetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
         } catch(e) {}
      };

      // --- STATE MANAGEMENT ---
      const statePhone = widgetRoot.getElementById('state-phone');
      const stateAddress = widgetRoot.getElementById('state-address');
      const stateCheckout = widgetRoot.getElementById('state-checkout');
      const sumHdr = widgetRoot.getElementById('sumHdr');
            
      
      // Open Drawers
      if (sumHdr) sumHdr.onclick = () => { widgetRoot.getElementById('drwBill').style.display='flex'; };
      const cpnL = widgetRoot.getElementById('osCpnLink'); if(cpnL) cpnL.onclick = () => { widgetRoot.getElementById('drwCoupon').style.display='flex'; };

      let appliedCoupon = null;
      let activeUpsell = null;
      let upsellAccepted = false;
      let quotes = null;
      let quoteRequestId = 0;
      let quoteFailed = false;

      const getCustomerDetails = () => ({
         customerName: (`${widgetRoot.getElementById('cf-addr-fname')?.value || ''} ${widgetRoot.getElementById('cf-addr-lname')?.value || ''}`.trim()) || customerData?.name || customerData?.fname || 'Valued Customer',
         customerEmail: widgetRoot.getElementById('cf-addr-email')?.value || customerData?.email || '',
         address: widgetRoot.getElementById('cf-addr-street')?.value || customerData?.street || customerData?.address || '',
         city: widgetRoot.getElementById('cf-addr-city')?.value || customerData?.city || '',
         state: widgetRoot.getElementById('cf-addr-state')?.value || customerData?.state || '',
         pincode: widgetRoot.getElementById('cf-addr-pin')?.value || customerData?.pincode || ''
      });

      // Shopify works out the final totals, including discounts and tax.
      const fetchQuotes = async (couponCode) => {
         const res = await fetch(`${apiBaseUrl}/api/checkout/quote`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop, sessionToken, items: cartItems, couponCode: couponCode || undefined, upsellVariantId: upsellAccepted && activeUpsell ? activeUpsell.variantId : undefined, ...getCustomerDetails() })
         });
         return { status: res.status, data: await res.json() };
      };

      const refreshQuotes = async () => {
         const requestId = ++quoteRequestId;
         quotes = null;
         quoteFailed = false;
         updatePricing();
         let failureMessage = 'Could not load your total. Please try again.';
         try {
            let { status, data } = await fetchQuotes(appliedCoupon);
            if (requestId !== quoteRequestId) return null;
            if (status === 401) {
               // The verified session ended, so ask for a new code.
               localStorage.removeItem('checkoutflow_verified');
               sessionToken = '';
               widgetRoot.getElementById('state-checkout').style.display = 'none';
               widgetRoot.getElementById('cf-change-phone').click();
               widgetRoot.getElementById('state-phone').style.display = 'block';
               notify('Please verify your number again to continue.');
               return null;
            }
            // A coupon can stop applying when the cart changes, so retry without it.
            if (data.code === 'INVALID_COUPON') {
               appliedCoupon = null;
               ({ data } = await fetchQuotes(null));
               if (requestId !== quoteRequestId) return null;
            }
            if (data.success) {
               quotes = { cod: data.cod, prepaid: data.prepaid };
            } else if (data.error) {
               failureMessage = data.error;
            }
         } catch(e) {}
         if (requestId !== quoteRequestId) return null;
         if (!quotes) {
            quoteFailed = true;
            notify(failureMessage);
         }
         updatePricing();
         return quotes;
      };

      
      const cfTrack = async (evt) => {
         try {
            await fetch(`${apiBaseUrl}/api/widget/track`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ shop, eventName: evt })
            });
         } catch(e){}
      };

      
      const loadUpsell = async () => {
         try {
            const res = await fetch(`${apiBaseUrl}/api/upsell/active?shop=${shop}&variantId=${cartItems[0].variantId}`);
            const data = await res.json();
            if (data && data.active && data.offer) {
               activeUpsell = data.offer;
               
               // Inject UI above payment methods
               const payContainer = widgetRoot.getElementById('pay-methods-container');
               const upsellBox = document.createElement('div');
               upsellBox.innerHTML = `
                  <div style="background:var(--bg); border:1px solid var(--green); border-radius:12px; padding:12px; margin-bottom:20px; display:flex; gap:12px; align-items:center;">
                     <div style="flex:1;">
                        <div style="color:var(--green); font-size:12px; font-weight:700; margin-bottom:4px;">🔥 SPECIAL OFFER</div>
                        <div style="font-size:14px; font-weight:600; color:var(--text1); line-height:1.2;">Add ${activeUpsell.title}</div>
                        <div style="font-size:13px; color:var(--text2); margin-top:4px;">
                           <span style="text-decoration:line-through; color:var(--text3); font-size:12px; margin-right:4px;">₹${activeUpsell.originalPrice}</span>
                           <span style="font-weight:600; color:var(--text1);">₹${activeUpsell.price}</span>
                        </div>
                     </div>
                     <div>
                        <label style="display:flex; align-items:center; cursor:pointer; background:var(--green); color:white; padding:6px 12px; border-radius:8px; font-size:13px; font-weight:600;">
                           <input type="checkbox" id="cf-upsell-check" style="margin-right:8px; width:16px; height:16px;"> Add
                        </label>
                     </div>
                  </div>
               `;
               payContainer.parentNode.insertBefore(upsellBox, payContainer);
               
               widgetRoot.getElementById('cf-upsell-check').addEventListener('change', (e) => {
                  upsellAccepted = e.target.checked;
                  refreshQuotes();
               });
            }
         } catch(e) {}
      };
      loadUpsell();

      // Handle manual input. Shopify decides whether the code is valid for this cart.
      widgetRoot.getElementById('cpn-manual-btn').onclick = async () => {
         const input = widgetRoot.getElementById('cpn-manual-input');
         const err = widgetRoot.getElementById('cpn-manual-err');
         const btn = widgetRoot.getElementById('cpn-manual-btn');
         const code = input.value.trim().toUpperCase();
         if(!code) return;
         err.style.display = 'none';
         const btnText = btn.innerText;
         btn.innerText = '...';
         btn.disabled = true;
         try {
            const { data } = await fetchQuotes(code);
            if (!data.success) {
               err.style.display = 'block';
               err.innerText = data.error || 'Invalid coupon code.';
               return;
            }
            quoteRequestId++;
            appliedCoupon = code;
            quotes = { cod: data.cod, prepaid: data.prepaid };
            if(window.launchConfetti) window.launchConfetti();
            input.value = '';
            widgetRoot.getElementById('drwCoupon').style.display = 'none';
            updatePricing();
         } catch(e) {
            err.style.display = 'block';
            err.innerText = 'Could not check this coupon. Please try again.';
         } finally {
            btn.innerText = btnText;
            btn.disabled = false;
         }
      };

            // --- DYNAMIC PRICING ---
      let currentPaymentMethod = null;
      
      const updatePricing = (method = null) => {
        if (method) currentPaymentMethod = method;

        const useCodQuote = currentPaymentMethod === 'COD' || (currentPaymentMethod === null && !widgetConfig.hasRazorpay);
        const quote = quotes ? (useCodQuote ? quotes.cod : quotes.prepaid) : null;
        const money = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
        const subtotal = quote ? quote.subtotal : subtotalBase;
        const couponDiscount = quote ? quote.discount : 0;
        const prepaidDiscount = quote ? quote.prepaidDiscount : 0;
        const codFee = quote ? quote.codFee : 0;
        const shippingFee = quote ? quote.shippingFee : 0;
        const tax = quote ? quote.tax : 0;
        const totalDiscount = couponDiscount + prepaidDiscount;
        const grandTotal = quote ? quote.total : subtotalBase;

        const showAmount = (el, text) => {
           if (!el) return;
           const previous = el.dataset.amount;
           el.classList.toggle('cf-skeleton', !text && !quoteFailed);
           el.textContent = text || (quoteFailed ? '–' : '');
           if (text) {
              el.dataset.amount = text;
              if (previous && previous !== text) {
                 el.classList.remove('cf-pop');
                 void el.offsetWidth;
                 el.classList.add('cf-pop');
              }
           }
        };
        showAmount(widgetRoot.getElementById('hFinal'), quote ? money(grandTotal) : null);
        widgetRoot.getElementById('osFinalPrice').style.display = 'none';
        widgetRoot.getElementById('osItemCount').innerText = `${totalQuantity} item${totalQuantity>1?'s':''}`;
        
        const osShipTxt = widgetRoot.getElementById('osShippingText');
        if (osShipTxt) {
           if (shippingFee > 0) {
              osShipTxt.innerText = `+ ₹${shippingFee} Shipping`;
              osShipTxt.style.color = "var(--text3)";
           } else {
              osShipTxt.innerText = "+ Free Shipping";
              osShipTxt.style.color = "var(--green)";
           }
        }
        
        // Original price in header
        const osOrigPrice = widgetRoot.getElementById('osOrigPrice');
        if(osOrigPrice) {
           if(totalDiscount > 0) {
              osOrigPrice.style.display = 'inline';
              osOrigPrice.innerText = `₹${subtotal.toLocaleString('en-IN')}`;
           } else {
              osOrigPrice.style.display = 'none';
           }
        }

        // Green Save Banner
        const osSaveBanner = widgetRoot.getElementById('osSaveBanner');
        const osSaveAmt = widgetRoot.getElementById('osSaveAmt');
        if(osSaveBanner) {
           if(couponDiscount > 0) {
              osSaveBanner.style.display = 'block';
              if (osSaveAmt) osSaveAmt.innerText = `₹${Math.round(couponDiscount).toLocaleString('en-IN')}`;
           } else {
              osSaveBanner.style.display = 'none';
           }
        }

        // Coupon Box in Order Summary Bar
        const cpnTitle = widgetRoot.getElementById('osCpnLinkText');
        const cpnSub = widgetRoot.getElementById('osCpnSubtitle');
        if (cpnTitle && cpnSub) {
           cpnTitle.innerText = appliedCoupon ? `${appliedCoupon} applied` : 'Apply Coupon';
           if (couponDiscount > 0) {
              cpnSub.innerText = `You save ${money(couponDiscount)}${appliedCoupon ? ' · Tap to change' : ''}`;
           } else {
              cpnSub.innerText = appliedCoupon ? 'Tap to change' : 'Unlock extra savings on your order';
           }
        }

        // Drawer values
        widgetRoot.getElementById('tSub').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        showAmount(widgetRoot.getElementById('tGrand'), quote ? money(grandTotal) : null);

        const discRow = widgetRoot.getElementById('trDisc');
        if (discRow) {
           if (totalDiscount > 0) {
              discRow.style.display = 'flex';
              const tDisc = widgetRoot.getElementById('tDisc');
              if (tDisc) tDisc.innerText = `-₹${Math.round(totalDiscount).toLocaleString('en-IN')}`;
           } else {
              discRow.style.display = 'none';
           }
        }

        const shipRow = widgetRoot.getElementById('trShip');
        if (shipRow) {
           if (shippingFee > 0) {
              shipRow.style.display = 'flex';
              const tShip = widgetRoot.getElementById('tShipFee');
              if (tShip) tShip.innerText = `₹${shippingFee.toLocaleString('en-IN')}`;
           } else {
              shipRow.style.display = 'none';
           }
        }

        const taxRow = widgetRoot.getElementById('trTax');
        if (taxRow) {
           taxRow.style.display = tax > 0 ? 'flex' : 'none';
           const tTax = widgetRoot.getElementById('tTax');
           if (tTax) tTax.innerText = money(tax);
        }

        const codRow = widgetRoot.getElementById('trCod');
        if (codRow) {
           if (codFee > 0) {
              codRow.style.display = 'flex';
              const tCod = widgetRoot.getElementById('tCodFee');
              if (tCod) tCod.innerText = `₹${codFee.toLocaleString('en-IN')}`;
           } else {
              codRow.style.display = 'none';
           }
        }

        ['UPI','Card','Wallet','Netbanking'].forEach(m => {
           const el = widgetRoot.getElementById(`pp${m}`);
           showAmount(el, quotes ? money(quotes.prepaid.total) : null);
        });
        const elCod = widgetRoot.getElementById('ppCOD');
        showAmount(elCod, quotes ? money(quotes.cod.total) : null);

        const elCodBtn = widgetRoot.getElementById('cod-confirm-btn');
        if(elCodBtn) {
           elCodBtn.textContent = quotes ? `Confirm COD (${money(quotes.cod.total)})` : (quoteFailed ? 'Try again' : 'Updating total...');
           elCodBtn.disabled = !quotes && !quoteFailed;
        }

        const elOnlineBtn = widgetRoot.getElementById('cod-save-btn');
        if(elOnlineBtn) {
            const onlineSaving = quotes ? quotes.cod.total - quotes.prepaid.total : 0;
            if (onlineSaving > 0) {
                elOnlineBtn.innerHTML = `Pay Online <span style="background:rgba(255,255,255,0.25); padding:4px 8px; border-radius:20px; font-size:12px; margin-left:6px; font-weight:600;">Save ${money(onlineSaving)}</span>`;
            } else {
                elOnlineBtn.innerHTML = `Pay Online`;
            }
        }

        // --- SHIPPING TIER LOGIC ---
        const msgEl = widgetRoot.getElementById('cf-shipping-msg');
        const statEl = widgetRoot.getElementById('cf-shipping-status');
        const barEl = widgetRoot.getElementById('cf-shipping-bar');
        const boxEl = widgetRoot.getElementById('cf-shipping-tier-box');
        
        if (msgEl && statEl && barEl && boxEl) {
           const threshold = typeof widgetConfig.freeShippingThreshold === 'number' ? widgetConfig.freeShippingThreshold : 999;
           if (!widgetConfig.isShippingFeeEnabled || threshold === 0) {
              boxEl.style.display = 'none';
           } else {
              boxEl.style.display = 'block';
              if (subtotal >= threshold) {
              msgEl.innerText = "You've unlocked Free Shipping! 🚚";
              msgEl.style.color = "var(--green)";
              statEl.innerText = "FREE";
              statEl.style.color = "var(--green)";
              barEl.style.width = "100%";
           } else {
              const diff = threshold - subtotal;
              const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
              msgEl.innerText = `Add ₹${diff.toLocaleString('en-IN')} more to get Free Shipping`;
              msgEl.style.color = "var(--text1)";
              statEl.innerText = `₹${threshold.toLocaleString('en-IN')}`;
              statEl.style.color = "var(--text3)";
              barEl.style.width = `${pct}%`;
           }
        }
      }
    };

      window.cfToggleDrawer = (id, show) => {
         const el = widgetRoot.getElementById(id);
         if (el) el.style.display = show ? 'flex' : 'none';
      };

      window.cfUpdateQty = (index, delta) => {
         if (cartItems[index]) {
            const newQty = cartItems[index].quantity + delta;
            if (newQty >= 1) {
               cartItems[index].quantity = newQty;
               widgetRoot.getElementById(`q${index}`).innerText = newQty;
               widgetRoot.getElementById(`p${index}`).innerText = `₹${(cartItems[index].price * newQty).toLocaleString('en-IN')}`;
               
               // Recalculate totals
               totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
               subtotalBase = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
               widgetRoot.getElementById('osItemCount').innerText = `${totalQuantity} item${totalQuantity > 1 ? 's' : ''}`;
               
               refreshQuotes();
            }
         }
      };
      // --- PHONE LOGIC ---
      let otpStepActive = false;
      const phoneIn = widgetRoot.getElementById('cf-phone-in');
      const otpIn = widgetRoot.getElementById('cf-otp-in');
      const phoneBtn = widgetRoot.getElementById('cf-phone-btn');
      
      const phoneErr = widgetRoot.getElementById('cf-phone-err');
      const otpErr = widgetRoot.getElementById('cf-otp-err');
      const otpBox = widgetRoot.getElementById('cf-otp-box');
      const resendBtn = widgetRoot.getElementById('cf-resend');
      const showError = (el, message) => { el.textContent = message || ''; el.style.display = message ? 'block' : 'none'; };
      const SPINNER = '<span class="cf-spinner" aria-hidden="true"></span>';
      const setBusy = (button, label) => { button.disabled = true; button.innerHTML = SPINNER + label; };
      const setIdle = (button, label) => { button.disabled = false; button.textContent = label; };
      const updatePhoneBtn = () => { if (!otpStepActive) phoneBtn.disabled = !/^[6-9]\d{9}$/.test(phoneIn.value); };
      updatePhoneBtn();

      let resendTimer;
      const startResendCountdown = () => {
         let remaining = 30;
         clearInterval(resendTimer);
         resendBtn.disabled = true;
         resendBtn.textContent = `Resend in ${remaining}s`;
         resendTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
               clearInterval(resendTimer);
               resendBtn.disabled = false;
               resendBtn.textContent = 'Resend code';
            } else {
               resendBtn.textContent = `Resend in ${remaining}s`;
            }
         }, 1000);
      };

      const sendOtp = async () => {
         const phone = phoneIn.value;
         const res = await fetch(`${apiBaseUrl}/api/otp/send`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, phone })
         });
         const data = await res.json();
         if (!data.success) throw new Error(data.error || 'Could not send the code. Please try again.');
         verifiedPhone = phone;
         widgetRoot.getElementById('cf-otp-sent').textContent = `Enter the 6-digit code sent to +91 ${phone}`;
         otpBox.style.display = 'block';
         otpStepActive = true;
         phoneIn.disabled = true;
         startResendCountdown();
         otpIn.value = '';
         otpIn.focus();
         if (data.simulatedCode) {
            let testBadge = widgetRoot.getElementById('cf-test-badge');
            if (!testBadge) {
               testBadge = document.createElement('button');
               testBadge.type = 'button';
               testBadge.id = 'cf-test-badge';
               testBadge.style.cssText = 'width:100%; margin-top:10px; padding:10px 14px; background:rgba(124,58,237,0.12); border:1px dashed var(--p1); border-radius:8px; color:var(--p1); font-size:13px; font-weight:600; cursor:pointer;';
               otpBox.appendChild(testBadge);
            }
            testBadge.textContent = `Test mode code: ${data.simulatedCode} (tap to fill)`;
            testBadge.onclick = () => { otpIn.value = data.simulatedCode; phoneBtn.click(); };
         }
      };

      phoneIn.addEventListener('input', () => {
         phoneIn.value = phoneIn.value.replace(/\D/g, '').slice(0, 10);
         showError(phoneErr, '');
         updatePhoneBtn();
      });
      phoneIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !phoneBtn.disabled) phoneBtn.click(); });
      otpIn.addEventListener('input', () => {
         otpIn.value = otpIn.value.replace(/\D/g, '').slice(0, 6);
         showError(otpErr, '');
         if (otpIn.value.length === 6) phoneBtn.click();
      });

      phoneBtn.onclick = async () => {
        if (!otpStepActive) {
          if (phoneBtn.disabled) return;
          setBusy(phoneBtn, 'Sending code...');
          showError(phoneErr, '');
          try {
            await sendOtp();
            setIdle(phoneBtn, 'Verify & Continue');
          } catch(err) {
            setIdle(phoneBtn, 'Continue');
            showError(phoneErr, err.message);
          }
        } else {
          const code = otpIn.value;
          if (code.length !== 6) { showError(otpErr, 'Enter the 6-digit code.'); return; }
          if (phoneBtn.disabled) return;
          setBusy(phoneBtn, 'Verifying...');
          showError(otpErr, '');
          try {
            const res = await fetch(`${apiBaseUrl}/api/otp/verify`, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ shop, phone: verifiedPhone, code })
            });
            const data = await res.json();
            if (data.success && data.sessionToken) {
              sessionToken = data.sessionToken;
              clearInterval(resendTimer);
              localStorage.setItem('checkoutflow_verified', JSON.stringify({ phone: verifiedPhone, shop, sessionToken, time: Date.now() }));
              cfTrack('OTP_VERIFIED');
              checkCustomer();
            } else {
              setIdle(phoneBtn, 'Verify & Continue');
              showError(otpErr, data.error || 'That code did not work. Please try again.');
              otpIn.select();
              otpIn.classList.remove('cf-shake');
              void otpIn.offsetWidth;
              otpIn.classList.add('cf-shake');
            }
          } catch(err) {
            setIdle(phoneBtn, 'Verify & Continue');
            showError(otpErr, 'Could not reach the server. Please try again.');
          }
        }
      };

      resendBtn.onclick = async () => {
         resendBtn.disabled = true;
         showError(otpErr, '');
         try {
            await sendOtp();
            notify('A new code has been sent.');
         } catch(err) {
            showError(otpErr, err.message);
            resendBtn.disabled = false;
         }
      };

      widgetRoot.getElementById('cf-change-phone').onclick = () => {
         clearInterval(resendTimer);
         otpStepActive = false;
         otpBox.style.display = 'none';
         showError(otpErr, '');
         phoneIn.disabled = false;
         phoneIn.focus();
         phoneBtn.textContent = 'Continue';
         updatePhoneBtn();
      };

      let selectedAddressIndex = 0;
      const renderSavedAddresses = (addrs) => {
         const container = widgetRoot.getElementById('cf-address-cards');
         container.innerHTML = addrs.map((a, i) => `
            <div class="cf-address-card ${i === selectedAddressIndex ? 'selected' : ''}" onclick="window.cfSelectAddress(${i})">
               <div style="padding-top:2px;">
                  <input type="radio" name="addr-sel" ${i === selectedAddressIndex ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--p1);pointer-events:none;" />
               </div>
               <div class="cf-address-card-info">
                  <div class="cf-address-card-name">
                     ${a.fname || ''} ${a.lname || ''} <span class="cf-address-card-type">${a.type || 'HOME'}</span>
                  </div>
                  <div class="cf-address-card-details">
                     ${a.street || ''}${a.area ? ', '+a.area : ''}<br/>
                     ${a.city || ''}, ${a.state || ''} ${a.pincode || ''}<br/>
                     +91 ${a.phone || verifiedPhone}
                  </div>
               </div>
            </div>
         `).join('');
      };
      
      window.cfSelectAddress = (idx) => {
         selectedAddressIndex = idx;
         try {
            const stored = JSON.parse(localStorage.getItem('cf_addrs_' + verifiedPhone) || '[]');
            customerData = stored[idx];
            renderSavedAddresses(stored);
         } catch(e){}
      };
      
      const populateCheckoutFromCustomerData = () => {
         widgetRoot.getElementById('state-address-list').style.display = 'none';
         widgetRoot.getElementById('state-address').style.display = 'none';
         widgetRoot.getElementById('disp-name').innerText = `${customerData.fname || customerData.name || ''} ${customerData.lname || ''}`.trim();
         widgetRoot.getElementById('disp-addr').innerText = `${customerData.street || customerData.address || ''}${customerData.area ? ', '+customerData.area : ''}, ${customerData.city || ''}`;
         const dP = widgetRoot.getElementById('disp-phone'); if(dP) dP.innerText = verifiedPhone;
         const dE = widgetRoot.getElementById('disp-email'); if(dE) dE.innerText = customerData.email || '';
         
         const setVal = (id, val) => { const el = widgetRoot.getElementById(id); if (el) el.value = val || ''; };
         setVal('cf-addr-fname', customerData.fname || customerData.name?.split(' ')[0] || '');
         setVal('cf-addr-lname', customerData.lname || customerData.name?.split(' ').slice(1).join(' ') || '');
         setVal('cf-addr-email', customerData.email || '');
         setVal('cf-addr-street', customerData.street || customerData.address || '');
         setVal('cf-addr-area', customerData.area || '');
         setVal('cf-addr-landmark', customerData.landmark || '');
         setVal('cf-addr-city', customerData.city || '');
         setVal('cf-addr-state', customerData.state || '');
         setVal('cf-addr-pin', customerData.pincode || '');
         
         renderPaymentMethods();
         stateCheckout.style.display = 'block';
      };

      const checkCustomer = async () => {
        statePhone.style.display = 'none';
        try {
          const res = await fetch(`${apiBaseUrl}/api/customer/lookup`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, sessionToken })
          });
          if (res.status === 401) {
            // The saved session is no longer valid, so ask for a new OTP.
            localStorage.removeItem('checkoutflow_verified');
            verifiedPhone = '';
            sessionToken = '';
            statePhone.style.display = 'block';
            return;
          }
          const data = await res.json();
          let serverCustomer = null;
          if (data.success && data.customer) serverCustomer = data.customer;
          
          let savedAddresses = [];
          try {
             const stored = localStorage.getItem('cf_addrs_' + verifiedPhone);
             if (stored) savedAddresses = JSON.parse(stored);
          } catch(e) {}
          
          if (serverCustomer && !savedAddresses.some(a => (a.street === serverCustomer.address || a.pincode === serverCustomer.pincode) && a.city === serverCustomer.city)) {
             savedAddresses.push({
                fname: serverCustomer.name?.split(' ')[0] || '',
                lname: serverCustomer.name?.split(' ').slice(1).join(' ') || '',
                phone: verifiedPhone,
                street: serverCustomer.address || '',
                area: '', landmark: '',
                city: serverCustomer.city || '',
                state: serverCustomer.state || '',
                pincode: serverCustomer.pincode || '',
                email: serverCustomer.email || '',
                type: 'Home'
             });
             localStorage.setItem('cf_addrs_' + verifiedPhone, JSON.stringify(savedAddresses));
          }
          
          if (savedAddresses.length > 0) {
             customerData = savedAddresses[0];
             selectedAddressIndex = 0;
             renderSavedAddresses(savedAddresses);
             widgetRoot.getElementById('state-address-list').style.display = 'block';
          } else {
             widgetRoot.getElementById('cf-addr-phone').value = verifiedPhone;
             widgetRoot.getElementById('state-address').style.display = 'block';
          }
        } catch(e) {
           widgetRoot.getElementById('cf-addr-phone').value = verifiedPhone;
           widgetRoot.getElementById('state-address').style.display = 'block'; 
        }
      };

      widgetRoot.getElementById('cf-addr-new-btn').onclick = () => {
         widgetRoot.getElementById('state-address-list').style.display = 'none';
         widgetRoot.getElementById('cf-addr-phone').value = verifiedPhone;
         widgetRoot.getElementById('cf-addr-back').style.display = 'block';
         widgetRoot.getElementById('state-address').style.display = 'block';
      };
      
      widgetRoot.getElementById('cf-addr-back').onclick = () => {
         widgetRoot.getElementById('state-address').style.display = 'none';
         widgetRoot.getElementById('state-address-list').style.display = 'block';
      };
      
      widgetRoot.getElementById('cf-addr-sel-btn').onclick = () => {
         if (!customerData) return;
         populateCheckoutFromCustomerData();
      };
      
      widgetRoot.getElementById('cf-addr-btn').onclick = () => {
         const typeEl = widgetRoot.querySelector('input[name="cf-addr-type"]:checked');
         const newAddr = {
            fname: widgetRoot.getElementById('cf-addr-fname').value.trim(),
            lname: widgetRoot.getElementById('cf-addr-lname').value.trim(),
            phone: verifiedPhone,
            street: widgetRoot.getElementById('cf-addr-street').value.trim(),
            area: widgetRoot.getElementById('cf-addr-area').value.trim(),
            landmark: widgetRoot.getElementById('cf-addr-landmark').value.trim(),
            city: widgetRoot.getElementById('cf-addr-city').value.trim(),
            state: widgetRoot.getElementById('cf-addr-state').value.trim(),
            pincode: widgetRoot.getElementById('cf-addr-pin').value.trim(),
            email: widgetRoot.getElementById('cf-addr-email').value.trim(),
            type: typeEl ? typeEl.value : 'Home'
         };
         if(!newAddr.fname || !newAddr.street || !newAddr.city || !newAddr.state || !newAddr.pincode) {
            notify('Please fill in all the required fields.'); return;
         }
         let addrs = [];
         try {
            const stored = localStorage.getItem('cf_addrs_' + verifiedPhone);
            if(stored) addrs = JSON.parse(stored);
         } catch(e){}
         addrs.unshift(newAddr);
         localStorage.setItem('cf_addrs_' + verifiedPhone, JSON.stringify(addrs));
         
         customerData = newAddr;
         populateCheckoutFromCustomerData();
      };
      
      widgetRoot.getElementById('cf-edit-addr').onclick = () => {
        stateCheckout.style.display = 'none';
        let addrs = [];
        try { addrs = JSON.parse(localStorage.getItem('cf_addrs_' + verifiedPhone) || '[]'); } catch(e){}
        if (addrs.length > 0) {
           renderSavedAddresses(addrs);
           widgetRoot.getElementById('state-address-list').style.display = 'block';
        } else {
           widgetRoot.getElementById('cf-addr-phone').value = verifiedPhone;
           widgetRoot.getElementById('state-address').style.display = 'block';
        }
      };

      widgetRoot.getElementById('cf-addr-pin').addEventListener('input', async (e) => {
         const val = e.target.value.trim();
         if(val.length === 6) {
            try {
               const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
               const data = await res.json();
               if(data && data[0] && data[0].Status === 'Success') {
                  const postOffice = data[0].PostOffice[0];
                  widgetRoot.getElementById('cf-addr-city').value = postOffice.District;
                  widgetRoot.getElementById('cf-addr-state').value = postOffice.State;
               }
            } catch(err) {}
         }
      });

      if (verifiedPhone) {
        checkCustomer();
      }

      // --- PAYMENT DRAWERS & METHODS ---
      const renderPaymentMethods = () => {
         const container = widgetRoot.getElementById('pay-methods-container');
         const dContainer = widgetRoot.getElementById('drawers-container');
         let html = '';
         let dHtml = '';

                  
         
         const methods = [
            { id: 'UPI', name: 'Pay via UPI', sub: '<div style="display:flex;gap:12px;align-items:center;margin-top:2px;"><span style="font-weight:700;letter-spacing:-0.5px;font-size:12px;"><span style="color:#EA4335">G</span><span style="color:#5F6368">Pay</span></span><span style="font-weight:700;color:#5E239D;letter-spacing:-0.5px;font-size:12px;">PhonePe</span><span style="font-weight:800;color:#00BAF2;letter-spacing:-0.5px;font-size:12px;font-style:italic;">Paytm</span><span style="font-weight:700;color:#F06522;letter-spacing:-0.5px;font-size:12px;">BHIM</span></div>', icon: '<svg viewBox="0 0 24 24"><use href="#ic-qr-code"/></svg>' },
            { id: 'Card', name: 'Debit / Credit Cards', sub: '<div style="display:flex;gap:12px;align-items:center;margin-top:2px;"><span style="font-style:italic;font-weight:800;color:#1434CB;letter-spacing:-0.5px;font-size:13px;">VISA</span><span style="display:inline-flex;align-items:center;position:relative;"><div style="width:14px;height:14px;border-radius:50%;background:#EB001B;opacity:0.9;"></div><div style="width:14px;height:14px;border-radius:50%;background:#F79E1B;margin-left:-6px;opacity:0.9;"></div></span><span style="font-weight:800;color:#F06522;font-style:italic;letter-spacing:-0.5px;font-size:13px;">RuPay</span></div>', icon: '<svg viewBox="0 0 24 24"><use href="#ic-credit-card"/></svg>' },
            { id: 'Wallet', name: 'Wallets', sub: '<div style="display:flex;gap:12px;align-items:center;margin-top:2px;"><span style="font-weight:800;color:#00BAF2;letter-spacing:-0.5px;font-size:12px;font-style:italic;">Paytm</span><span style="font-weight:700;color:#5E239D;letter-spacing:-0.5px;font-size:12px;">PhonePe</span><span style="font-weight:700;color:#232F3E;letter-spacing:-0.5px;font-size:12px;">amazon<span style="color:#FF9900">pay</span></span></div>', icon: '<svg viewBox="0 0 24 24"><use href="#ic-wallet"/></svg>' },
            { id: 'Netbanking', name: 'Net Banking', sub: '<div style="font-size:12px; color:var(--text3); font-weight:500; margin-top:2px;">HDFC · SBI · ICICI · Axis</div>', icon: '<svg viewBox="0 0 24 24"><use href="#ic-globe"/></svg>' },
            { id: 'COD', name: 'Cash on Delivery', sub: (widgetConfig.isCodFeeEnabled !== false && (widgetConfig.codFeeAmount || 0) > 0) ? `Pay ₹${widgetConfig.codFeeAmount} fee` : 'Pay at doorstep', icon: '<svg viewBox="0 0 24 24" style="color:#ea580c;"><use href="#ic-banknote"/></svg>' }
         ];

         methods.forEach(m => {
            if (m.id !== 'COD' && !widgetConfig.hasRazorpay) return; // Skip online methods if RP disabled

            // Drawer
            if (m.id === 'COD') {
              dHtml += `
                <div class="cf-payment-overlay" id="drw${m.id}" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:200; align-items:flex-end;" onclick="this.style.display='none'">
                  <div class="cf-payment-drawer" style="width:100%; max-width:420px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                     <div style="font-size:18px; font-weight:600; margin-bottom:16px;">${m.name}</div>
                     <div style="display:flex; flex-direction:column; gap:10px;">
                        ${widgetConfig.hasRazorpay ? `<button class="cf-btn" onclick="window.cfToggleDrawer('drw${m.id}', false); window.cfExecutePayment('UPI')" id="cod-save-btn" style="background:var(--green);">Pay Online (Save)</button>` : ''}
                        <button class="cf-btn" onclick="window.cfExecutePayment('${m.id}')" id="cod-confirm-btn" style="background:var(--surface); color:var(--text-main); border:1.5px solid var(--border); box-shadow:none;">Confirm COD</button>
                     </div>
                  </div>
                </div>
              `;
            }

            // Row
            let offerTxt = '';
            if (m.id !== 'COD' && widgetConfig.isPrepaidDiscountEnabled && widgetConfig.prepaidDiscountValue > 0) {
                const discountText = widgetConfig.prepaidDiscountType === 'percentage' 
                    ? `Extra ${widgetConfig.prepaidDiscountValue}% OFF` 
                    : `You save ₹${widgetConfig.prepaidDiscountValue}`;
                offerTxt = discountText;
            }

            const clickAction = m.id === 'COD' 
                ? `window.cfUpdatePricing('${m.id}'); window.cfToggleDrawer('drw${m.id}', true)`
                : `window.cfUpdatePricing('${m.id}'); window.cfExecutePayment('${m.id}')`;

            html += `
              <div class="pay-card ${m.id==='UPI' ? 'active' : ''}" onclick="${clickAction}">
                ${m.id==='UPI' ? '<div class="recommended-tag"><svg viewBox="0 0 24 24"><use href="#ic-star"/></svg> Recommended</div>' : ''}
                <div class="pay-icon-box">
                  ${m.icon}
                </div>
                <div class="pay-content">
                  <div class="pay-title">${m.name}</div>
                  <div class="pay-subtitle">${m.sub}</div>
                  ${offerTxt ? `<div class="pay-savings">${offerTxt}</div>` : ''}
                </div>
                <div class="pay-right">
                  <div class="pay-price ${m.id==='COD' ? 'red' : ''}" id="pp${m.id}"></div>
                  <div class="arrow-circle">
                    <svg viewBox="0 0 24 24"><use href="#ic-chevron-right"/></svg>
                  </div>
                </div>
              </div>
            `;
         });
         container.innerHTML = html;
         
         let dynD = widgetRoot.getElementById('dynamic-drawers');
         if(!dynD) { dynD = document.createElement('div'); dynD.id = 'dynamic-drawers'; dContainer.appendChild(dynD); }
         dynD.innerHTML = dHtml;

         refreshQuotes();
      };

      // --- PAYMENT EXECUTION ---
      window.cfUpdatePricing = updatePricing;
      window.cfExecutePayment = async (method) => {
         const btn = widgetRoot.getElementById(method === 'COD' ? 'cod-confirm-btn' : 'cod-save-btn');
         if (btn) btn.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><svg style="width:18px;height:18px;animation:cf-spin 1s linear infinite;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="31.4" stroke-linecap="round"></circle></svg> Placing your order...</div>';

         if (!quotes) await refreshQuotes();
         // refreshQuotes has already told the customer what went wrong.
         if (!quotes) return;

         // The customer agreed to this total, so the server stops the order if it has changed.
         const quotedTotal = method === 'COD' ? quotes.cod.total : quotes.prepaid.total;
         const payload = {
            shop, sessionToken, items: cartItems,
            ...getCustomerDetails(),
            paymentMethod: method,
            expectedTotal: quotedTotal,
            quoteToken: method === 'COD' ? quotes.cod.quoteToken : quotes.prepaid.quoteToken,
            upsellVariantId: upsellAccepted && activeUpsell ? activeUpsell.variantId : undefined,
            appliedCoupon: appliedCoupon ? { code: appliedCoupon } : undefined
         };

         const createFinalOrder = async () => {
             try {
                const res = await fetch(`${apiBaseUrl}/api/create-order`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (data.paymentReceived) {
                   const drw = widgetRoot.getElementById(`drw${method}`);
                   if (drw) drw.style.display = 'none';
                   widgetRoot.getElementById('state-checkout').style.display='none';
                   widgetRoot.getElementById('successScr').style.display='flex';
                   widgetRoot.getElementById('cf-success-title').textContent = 'Payment received';
                   widgetRoot.getElementById('cf-success-sub').textContent = data.error;
                } else if(data.success) {
                   const drw = widgetRoot.getElementById(`drw${method}`);
                   if (drw) drw.style.display = 'none';
                   widgetRoot.getElementById('state-checkout').style.display='none';
                   widgetRoot.getElementById('successScr').style.display='flex';
                   if (window.launchConfetti) window.launchConfetti();
                   if (data.orderStatusUrl) {
                       widgetRoot.getElementById('close-success-btn').style.display = 'none';
                       widgetRoot.getElementById('cf-success-sub').textContent = 'Taking you to your order details...';
                       window.location.href = data.orderStatusUrl;
                   }
                } else {
                   notify(data.error || 'Could not place your order. Please try again.');
                   await refreshQuotes();
                }
             } catch(e) {
                notify('Could not reach the server. Please check your connection and try again.');
                updatePricing();
             }
         };

         if (method !== 'COD') {
           try {
             const rzpOrderRes = await fetch(`${apiBaseUrl}/api/checkout/create-razorpay-order`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
             });
             const rzpOrderData = await rzpOrderRes.json();
             
             if (!rzpOrderData.success) {
               notify(rzpOrderData.error || 'Could not start the payment. Please try again.');
               await refreshQuotes();
               return;
             }

             const options = {
               key: rzpOrderData.keyId,
               amount: rzpOrderData.amount,
               currency: "INR",
               name: (widgetConfig.storeName || shop.split('.')[0]).toUpperCase(),
               description: "Order Payment",
               order_id: rzpOrderData.orderId,
               handler: async function (response) {
                 if (btn) btn.innerText = 'Verifying...';
                 // The server verifies this payment with Razorpay before creating the order.
                 payload.razorpay_order_id = response.razorpay_order_id;
                 payload.razorpay_payment_id = response.razorpay_payment_id;
                 payload.razorpay_signature = response.razorpay_signature;
                 await createFinalOrder();
               },
               prefill: {
                 name: payload.customerName,
                 email: payload.customerEmail,
                 contact: verifiedPhone
               },
               theme: { color: primaryColor },
               modal: {
                 ondismiss: function() {
                   updatePricing();
                 }
               }
             };
             
             await loadScript(RAZORPAY_URL);
             const rzp = new window.Razorpay(options);
             rzp.on('payment.failed', function (response){
               notify('Payment failed: ' + response.error.description);
               updatePricing();
             });
             rzp.open();
             
           } catch(e) {
             notify('Could not start the payment. Please try again.');
             updatePricing();
           }
         } else {
            await createFinalOrder();
         }
      };

      widgetRoot.getElementById('close-success-btn').onclick = closeWidget;

    },

    autoInject: function() {
      // Fetches store settings and wakes the server early, so opening the popup is instant.
      const prefetch = () => {
        const shop = window.Shopify && window.Shopify.shop;
        if (!shop || window._cfConfigPromise) return;
        const scripts = document.querySelectorAll('script[src*="widget.js"]');
        let base = 'https://checkoutflow-app.onrender.com';
        if (scripts.length > 0) { try { base = new URL(scripts[0].src).origin; } catch(e) {} }
        window._cfConfigPromise = fetch(base + '/api/widget/config?shop=' + encodeURIComponent(shop)).then(res => res.json());
        window._cfConfigPromise.then((data) => {
          if (data && data.config && data.config.primaryColor) document.documentElement.style.setProperty('--cf-btn-color', data.config.primaryColor);
        }).catch(() => {});
        window._cfConfigPromise.catch(() => { window._cfConfigPromise = null; });
      };
      if (window.requestIdleCallback) requestIdleCallback(prefetch); else setTimeout(prefetch, 500);
      const injectButtons = () => {
        // 1. Inject on Product Page
        const productForms = document.querySelectorAll('form[action="/cart/add"], form[action^="/cart/add"]');
        productForms.forEach(form => {
          if (form.querySelector('.checkoutflow-btn')) return;
          const formId = form.getAttribute('id') || '';
          const formClass = form.getAttribute('class') || '';
          if (formId.includes('installment') || formClass.includes('installment')) return;
          
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'checkoutflow-btn';
          btn.innerText = 'Express Checkout';
          btn.style.cssText = 'width: 100%; padding: 15px; margin-top: 10px; background-color: var(--cf-btn-color, #111827); color: white; border: none; font-weight: bold; font-size: 16px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
          
          btn.onmouseover = () => btn.style.transform = 'scale(0.98)';
          btn.onmouseout = () => btn.style.transform = 'scale(1)';
          
          btn.onclick = (e) => {
             e.preventDefault();
             let variantId = 'unknown';
             const variantInput = form.querySelector('input[name="id"], select[name="id"]');
             if (variantInput) variantId = variantInput.value;

             let quantity = 1;
             const qtyInput = form.querySelector('input[name="quantity"]');
             if (qtyInput) quantity = parseInt(qtyInput.value) || 1;

             const shopDomain = window.Shopify ? window.Shopify.shop : 'test.myshopify.com';
             const titleEl = document.querySelector('h1');
             const productTitle = titleEl ? titleEl.innerText : 'Product';
             
             let price = 0;
             let productImage = null;
             if (window.meta && window.meta.product && window.meta.product.variants && window.meta.product.variants.length > 0) {
               const variants = window.meta.product.variants;
               const selectedVariant = variants.find(v => String(v.id) === String(variantId)) || variants[0];
               price = selectedVariant.price / 100;
               if (selectedVariant.featured_image) {
                 productImage = selectedVariant.featured_image.src;
               }
             } else {
               const priceEl = document.querySelector('.price-item--regular, .price, .product__price, [data-product-price]');
               if (priceEl) {
                 let text = priceEl.innerText.replace(/,/g, '');
                 let match = text.match(/[\d]+(\.[\d]+)?/);
                 if (match) price = parseFloat(match[0]);
               }
             }
             if (!productImage) {
               const imgEl = document.querySelector('img.product-single__photo, img.product__image, img[data-product-featured-image]');
               if (imgEl) productImage = imgEl.src;
             }

             window.CheckoutFlow.open({
               shop: shopDomain,
               items: [{
                 variantId: variantId,
                 quantity: quantity,
                 title: productTitle,
                 price: price,
                 image: productImage
               }]
             });
          };

          // Custom themes may use plain buttons, so also match on the button's label.
          const customBuyBtns = Array.from(form.querySelectorAll('button')).filter(b => /add to (cart|bag)|buy (it )?now/i.test(b.textContent));
          const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button[name="add"], .shopify-payment-button') || customBuyBtns[customBuyBtns.length - 1];
          if (!submitBtn) return; // Do not inject if form lacks an add to cart button

          if (submitBtn && submitBtn.parentNode) {
             const dynamicCheckout = form.querySelector('.shopify-payment-button');
             if (dynamicCheckout && dynamicCheckout.parentNode) {
                dynamicCheckout.parentNode.insertBefore(btn, dynamicCheckout.nextSibling);
             } else {
                submitBtn.parentNode.insertBefore(btn, submitBtn.nextSibling);
             }
          } else {
             form.appendChild(btn);
          }
        });

        // 2. Inject on Cart Page / Drawer
        const cartCheckoutElements = document.querySelectorAll('form[action="/cart"] [name="checkout"], form[action="/cart"] button[type="submit"], .cart__checkout, .cart-checkout, button[name="checkout"], [data-checkout-button], #CartDrawer-Checkout, .checkout-button, .btn--checkout');
        cartCheckoutElements.forEach(checkoutBtn => {
          const container = checkoutBtn.parentNode;
          if (container && !container.querySelector('.checkoutflow-cart-btn')) {
             const btn = document.createElement('button');
             btn.type = 'button';
             btn.className = 'checkoutflow-cart-btn';
             btn.innerText = 'Express Checkout';
             btn.style.cssText = 'width: 100%; padding: 15px; margin-top: 10px; background-color: var(--cf-btn-color, #111827); color: white; border: none; font-weight: bold; font-size: 16px; border-radius: 6px; cursor: pointer; transition: transform 0.15s ease;';
             
             btn.onmouseover = () => btn.style.transform = 'scale(0.98)';
             btn.onmouseout = () => btn.style.transform = 'scale(1)';
             
             btn.onclick = async (e) => {
               e.preventDefault();
               const originalText = btn.innerText;
               btn.innerText = 'Loading...';
               try {
                 const res = await fetch('/cart.js');
                 const cart = await res.json();
                 if (cart.items && cart.items.length > 0) {
                   const shopDomain = window.Shopify ? window.Shopify.shop : 'test.myshopify.com';
                   const items = cart.items.map(item => ({
                      variantId: item.variant_id.toString(),
                      quantity: item.quantity,
                      title: item.title,
                      price: item.price / 100,
                      image: item.image || null
                   }));
                   window.CheckoutFlow.open({ shop: shopDomain, items: items });
                 } else {
                   alert('Cart is empty');
                 }
               } catch(err) {
                 alert('Error fetching cart');
               } finally {
                 btn.innerText = originalText;
               }
             };
             container.insertBefore(btn, checkoutBtn.nextSibling);
          }
        });
      };

      const observeAndInject = () => {
         injectButtons();
         const observer = new MutationObserver(() => injectButtons());
         observer.observe(document.body, { childList: true, subtree: true });
      };

      if (document.readyState === 'loading') {
         document.addEventListener('DOMContentLoaded', observeAndInject);
      } else {
         observeAndInject();
      }
    }
  };

  window.CheckoutFlow.autoInject();
})();
