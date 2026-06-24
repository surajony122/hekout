(function() {
  window.CheckoutFlow = {
    trackEvent: async function(shop, eventName) {
      try {
        await fetch('https://checkoutflow-app.onrender.com/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, sessionId: 'anon', eventName })
        });
      } catch (err) {}
    },

    open: async function(options) {
      const { shop, variantId, quantity, productTitle, productImage, price } = options;
      this.trackEvent(shop, 'WIDGET_OPENED');

      const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
      let widgetConfig = { 
        isPrepaidDiscountEnabled: false, prepaidDiscountType: 'percentage', prepaidDiscountValue: 0, 
        isPartialCodEnabled: false, partialCodAmount: 0, codFeeAmount: 69, hasRazorpay: false,
        primaryColor: '#7c3aed',
        brandLogoUrl: '',
        preLoginBannerText: '🎉 FREE SHIPPING ON ALL ORDERS TODAY!', preLoginBannerBg: '#000000', preLoginBannerColor: '#ffffff',
        postLoginBannerText: '⚡ EXTRA 2% OFF ON UPI/CARDS', postLoginBannerBg: '#ecfdf5', postLoginBannerColor: '#059669'
      };

      try {
        const configRes = await fetch(`${apiBaseUrl}/api/widget/config?shop=${shop}&t=${Date.now()}`);
        const configData = await configRes.json();
        if (configData.success) { widgetConfig = configData.config; }
      } catch (e) {}

      const primaryColor = widgetConfig.primaryColor || '#7c3aed';

      const overlay = document.createElement('div');
      overlay.id = 'checkoutflow-overlay';
      overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:flex-end; justify-content:center;';

      const sheet = document.createElement('div');
      sheet.id = 'checkoutflow-sheet';
      sheet.style.cssText = 'width:100%; max-width:400px; height:88vh; background:#f5f3ff; border-top-left-radius:24px; border-top-right-radius:24px; transform:translateY(100%); transition:transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); overflow:hidden; display:flex; flex-direction:column; position:relative; box-shadow:0 -10px 40px rgba(0,0,0,0.2);';

      let currentQuantity = quantity;
      let basePrice = price;
      let total = basePrice * currentQuantity;
      let verifiedPhone = localStorage.getItem('checkoutflow_verified_phone') || '';
      let customerData = null;

      let finalProductImage = productImage;
      if (!finalProductImage) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) finalProductImage = ogImage.content;
      }

      const phosphorScript = document.createElement('script');
      phosphorScript.src = 'https://unpkg.com/@phosphor-icons/web';
      document.head.appendChild(phosphorScript);

      const confettiScript = document.createElement('script');
      confettiScript.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
      document.head.appendChild(confettiScript);

      const rzpScript = document.createElement('script');
      rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.head.appendChild(rzpScript);

      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap';
      document.head.appendChild(fontLink);

      sheet.innerHTML = `
        <style>
          :root {
  --p1: #4c1d95; /* Deep Indigo */
  --p2: #8b5cf6; /* Vivid Purple */
  --bg: #f5f3ff; /* Light Lavender Background */
  --surface: #ffffff;
  --border: #ddd6fe; /* Light Purple border */
  --border2: #e5e7eb;
  --text1: #1e1b4b; /* Deep Indigo Text */
  --text2: #4c1d95;
  --text3: #6b7280;
  --green: #059669;
  --red: #ef4444;
  --radius: 16px;
  --radius-sm: 10px;
  --font: 'Poppins', sans-serif;
  --grad: linear-gradient(90deg, #a855f7, #ec4899);
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font); }
body { background: var(--bg); color: var(--text1); -webkit-font-smoothing: antialiased; }
.top-header { background: var(--surface); border-bottom: 1px solid var(--border); }
.header-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; }
.back-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: 50%; cursor: pointer; }
.back-btn svg { width: 18px; height: 18px; stroke: var(--text1); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.brand-center { flex: 1; text-align: center; }
.brand-logo { color: var(--p1); font-weight: 600; font-size: 14px; letter-spacing: 1px; display: inline-flex; align-items: center; gap: 8px; }
.brand-logo::before, .brand-logo::after { content: ''; width: 16px; height: 1px; background: var(--p1); }
.header-price { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
.final { font-weight: 600; font-size: 16px; color: var(--p2); }
.orig { font-size: 11px; color: var(--text3); text-decoration: line-through; }
.upi-strip { background: var(--grad); color: #fff; text-align: center; padding: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; display: flex; justify-content: center; align-items: center; gap: 6px; }
.scroll-body { padding: 16px; flex: 1; overflow-y: auto; background: var(--bg); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.05); }
.summary-hdr { display: flex; align-items: center; padding: 16px; cursor: pointer; user-select: none; }
.summary-hdr .icon { width: 20px; height: 20px; stroke: var(--text1); fill: none; stroke-width: 2; margin-right: 12px; }
.summary-hdr-text { font-weight: 600; font-size: 15px; flex: 1; color: var(--text1); }
.summary-hdr-right { display: flex; align-items: center; gap: 8px; color: var(--p2); font-size: 13px; font-weight: 500; }
.summary-hdr-right .chev { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; transition: transform 0.2s; }
.summary-hdr.open .chev { transform: rotate(180deg); }
.summary-body { display: none; padding: 0 16px 16px; border-top: 1px dashed var(--border); }
.summary-body.show { display: block; }
.oi { display: flex; gap: 14px; padding-top: 16px; }
.oi-thumb { width: 64px; height: 64px; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 24px; background: var(--bg); overflow: hidden; }
.oi-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.oi-name { font-weight: 500; font-size: 13px; line-height: 1.4; color: var(--text1); }
.oi-ctrls { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 6px; width: fit-content; overflow: hidden; margin-top: 8px; }
.qty-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--text1); font-weight: 500; cursor: pointer; user-select: none; }
.qty-n { width: 32px; text-align: center; font-size: 13px; font-weight: 500; }
.oi-price { text-align: right; font-weight: 600; font-size: 14px; }
.totals-box { margin-top: 16px; background: var(--bg); border-radius: var(--radius-sm); padding: 12px; }
.tr { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: var(--text3); font-weight: 500; }
.tr:last-child { margin-bottom: 0; }
.tr.discount { color: var(--green); }
.tr.free-sh .v { color: var(--green); }
.tr-div { border: none; border-top: 1px dashed var(--border); margin: 10px 0; }
.tr.grand { font-size: 15px; font-weight: 600; color: var(--text1); }
.deliver-inner { padding: 16px; }
.deliver-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.deliver-top svg { width: 18px; height: 18px; stroke: var(--p1); fill: none; stroke-width: 2; }
.deliver-top-t { font-weight: 600; font-size: 15px; color: var(--text1); }
.tag { background: var(--bg); color: var(--p2); font-size: 10px; font-weight: 600; padding: 4px 8px; border-radius: 20px; }
.edit-lnk { margin-left: auto; color: var(--p2); font-size: 13px; font-weight: 500; cursor: pointer; }
.addr-box { font-size: 13px; line-height: 1.5; color: var(--text3); }
.aname { font-weight: 500; color: var(--text1); }
.addr-contact { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; font-weight: 500; }
.addr-contact span { display: flex; align-items: center; gap: 8px; }
.addr-contact svg { width: 14px; height: 14px; stroke: var(--p2); fill: none; stroke-width: 2; }
.sec-lbl { font-size: 12px; font-weight: 600; color: var(--text3); margin: 20px 0 10px 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.pow-row { text-align: center; font-size: 11px; font-weight: 500; color: var(--text3); margin-top: 24px; }
.pow-chip { font-weight: 600; color: var(--p1); }
.cf-payment-overlay { display: none; position: fixed; inset: 0; background: rgba(30,27,75,0.5); z-index: 200; align-items: flex-end; }
.cf-payment-drawer { width: 100%; max-width: 400px; margin: 0 auto; background: var(--surface); border-radius: 20px 20px 0 0; padding: 20px; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.pay-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-top: 1px solid var(--border); cursor: pointer; background: var(--surface); transition: background 0.2s; }
.pay-row:hover { background: var(--bg); }


.os-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.os-top { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; font-weight: 500; font-size: 14px; cursor: pointer; }
.os-prices { display: flex; align-items: center; gap: 6px; }
.os-orig { font-size: 12px; color: var(--text3); text-decoration: line-through; font-weight: 400; }
.os-final { color: var(--text1); font-weight: 700; font-size: 14px; }
.os-save-banner { background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; text-align: center; padding: 6px; }
.os-bottom { padding: 10px 14px; border-top: 1px solid var(--border2); display: flex; justify-content: space-between; align-items: center; }
.os-cpn-applied { display: inline-flex; align-items: center; gap: 8px; }
.os-cpn-tag { background: var(--green); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
.os-cpn-link { color: #f97316; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; }

.cpn-input-row { display: flex; gap: 8px; margin-bottom: 20px; border: 1px solid var(--border2); border-radius: 8px; padding: 4px; }
.cpn-input { flex: 1; height: 36px; border: none; padding: 0 12px; font-size: 14px; outline: none; background: transparent; }
.cpn-apply-btn { height: 36px; padding: 0 16px; background: transparent; color: #f97316; font-weight: 600; border: none; cursor: pointer; font-size: 14px; }

.cpn-list { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
.cpn-item { border: 1px solid var(--border2); border-radius: 8px; padding: 12px; }
.cpn-item.active { border-color: var(--green); background: #f0fdf4; }
.cpn-item.disabled { opacity: 0.6; background: #f9fafb; }
.cpn-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cpn-code { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.cpn-action { font-size: 13px; font-weight: 600; color: #f97316; cursor: pointer; }
.cpn-applied-txt { color: var(--text3); font-size: 13px; font-weight: 600; }
.cpn-save-box { border: 1px solid var(--green); color: var(--green); display: inline-block; padding: 4px 8px; font-size: 12px; font-weight: 600; border-radius: 4px; margin-bottom: 8px; }
.cpn-desc { font-size: 12px; color: var(--text3); line-height: 1.4; }
.cpn-err { color: var(--red); font-size: 12px; font-weight: 600; margin-bottom: 6px; }

@keyframes cf-spin { 100% { transform: rotate(360deg); } }

          :root { --p1: ${primaryColor}; }
          
          /* Custom form styles */
          .cf-input { width: 100%; height: 48px; padding: 0 16px; border: 1.5px solid var(--border2); border-radius: var(--radius-sm); font-size: 14px; font-family: var(--font); color: var(--text1); outline: none; transition: border-color 0.2s; margin-bottom: 12px; }
          .cf-input:focus { border-color: var(--p1); }
          .cf-btn { width: 100%; height: 52px; background: var(--p1); color: #fff; border: none; border-radius: var(--radius); font-size: 15px; font-weight: 600; cursor: pointer; font-family: var(--font); transition: transform 0.15s, box-shadow 0.15s; }
          .cf-btn:active { transform: scale(0.98); }
        </style>
        
        <canvas id="confetti-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1000;"></canvas>

        <div class="top-header">
          <div class="header-row">
            <div class="back-btn" id="cf-close-btn">
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </div>
            <div class="brand-center">
              ${widgetConfig.brandLogoUrl ? `<img src="${widgetConfig.brandLogoUrl}" alt="Logo" style="max-height:28px; object-fit:contain;"/>` : `<div class="brand-logo">${(widgetConfig.storeName || shop.split('.')[0]).substring(0,18).toUpperCase()}</div>`}
            </div>
            <div class="header-price">
              <div class="final" id="hFinal">₹${total.toLocaleString('en-IN')}</div>
              <div class="orig" id="hOrig" style="display:none;"></div>
            </div>
          </div>
          <div class="upi-strip" id="dynamic-banner" style="background:${widgetConfig.preLoginBannerBg}; color:${widgetConfig.preLoginBannerColor}; padding:8px; text-align:center; font-size:11px; font-weight:600; letter-spacing:0.5px; border-bottom:1px solid var(--border);">
            ${widgetConfig.preLoginBannerText}
          </div>
        </div>

        <div class="scroll-body" style="overflow-y:auto; flex:1;">
          <!-- NEW ORDER SUMMARY BAR -->
            <div class="os-bar" id="osBarTop" style="margin-bottom: 16px;">
               <div class="os-top" id="sumHdr" style="border-bottom:none;">
                 <div>Order summary (<span id="osItemCount">${currentQuantity} Item</span>)</div>
                 <div class="os-prices">
                    <span class="os-orig" id="osOrigPrice" style="display:none;"></span>
                    <span class="os-final" id="osFinalPrice">₹${total.toLocaleString('en-IN')}</span>
                    <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:2;"><path d="M9 18l6-6-6-6"/></svg>
                 </div>
               </div>
               <div class="os-save-banner" id="osSaveBanner" style="display:none;">Yay! You've saved <span id="osSaveAmt"></span> so far 🥳</div>
               <div class="os-bottom">
                  <div class="os-cpn-applied" id="osCpnActive" style="display:none;">
                     <div class="os-cpn-tag">
                        <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                        <span id="osCpnCode"></span>
                     </div>
                     <span class="os-cpn-save" id="osCpnSave"></span>
                  </div>
                  <div id="osCpnEmpty" style="font-size:13px; color:var(--text3); font-weight:500;">No coupon applied</div>
                  <div class="os-cpn-link" id="osCpnLink">Enter a Coupon ></div>
               </div>
            </div>

          
          <!-- STATE 1: PHONE -->
          <div id="state-phone" style="padding: 20px 10px;">
             <h3 style="margin-bottom:16px; color:var(--text1); font-size:16px; font-weight:600;">Enter mobile number</h3>
             <div class="card" style="padding:16px; margin-bottom:16px;">
               <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                 <span style="font-size:20px;">🇮🇳</span> <span style="font-weight:500;">+91</span>
                 <input type="tel" id="cf-phone-in" class="cf-input" style="margin-bottom:0; border:none; border-left:1.5px solid var(--border2); border-radius:0; padding-left:12px;" placeholder="Mobile Number" maxlength="10" />
               </div>
               <div id="cf-otp-box" style="display:none; margin-top:16px; padding-top:16px; border-top:1.5px dashed var(--border2);">
                 <input type="text" id="cf-otp-in" class="cf-input" placeholder="Enter 4-digit OTP" style="text-align:center; letter-spacing:8px; font-weight:500;" maxlength="4" />
                 <div id="cf-otp-err" style="color:var(--red); font-size:12px; font-weight:600; text-align:center; display:none;"></div>
               </div>
             </div>
             <button id="cf-phone-btn" class="cf-btn">Continue</button>
             <div id="cf-phone-err" style="color:var(--red); font-size:12px; font-weight:600; text-align:center; margin-top:10px; display:none;"></div>
          </div>

          <!-- STATE 2: ADDRESS -->
          <div id="state-address" style="display:none; padding: 20px 10px;">
             <h3 style="margin-bottom:16px; color:var(--text1); font-size:16px; font-weight:600;">Add shipping address</h3>
             <div class="card" style="padding:16px;">
                <input type="text" id="cf-addr-name" class="cf-input" placeholder="Full Name" />
                <input type="email" id="cf-addr-email" class="cf-input" placeholder="Email Address" />
                <input type="text" id="cf-addr-street" class="cf-input" placeholder="Street Address" />
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                  <input type="text" id="cf-addr-city" class="cf-input" placeholder="City" />
                  <input type="text" id="cf-addr-state" class="cf-input" placeholder="State" />
                </div>
                <input type="text" id="cf-addr-pin" class="cf-input" placeholder="Pincode" />
             </div>
             <button id="cf-addr-btn" class="cf-btn" style="margin-top:16px;">Save Address</button>
          </div>

          <!-- STATE 3: CHECKOUT (GOKWIK UI) -->
          <div id="state-checkout" style="display:none; padding-bottom:60px;">
            
                        <!-- DELIVER TO -->
            <div class="card">
              <div class="deliver-inner">
                <div class="deliver-top">
                  <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span class="deliver-top-t">Deliver to</span>
                  <span class="tag">Home</span>
                  <span class="edit-lnk" id="cf-edit-addr">Edit &gt;</span>
                </div>
                <div class="addr-box">
                  <span class="aname" id="disp-name">Name</span>, <span id="disp-addr">Address</span><br>
                  <div class="addr-contact">
                    <span><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12 19.79 19.79 0 01.14 3.18 2 2 0 012.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.45-.45a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> <span id="disp-phone"></span></span>
                    <span><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> <span id="disp-email">support@store.com</span></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- SHIPPING CARD -->
            <div class="card" style="padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:var(--p1);fill:none;stroke-width:2;"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  <span style="font-weight:600; font-size:15px; color:var(--text1);">Shipping</span>
                </div>
                <div style="font-weight:600; font-size:14px; color:var(--green); display:flex; align-items:center; gap:4px;">
                   FREE <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            </div>

            <!-- PAYMENT METHODS -->
            <div style="margin-top:20px;">
              <div class="sec-lbl">Payment methods</div>
              <div class="card" style="padding:0" id="pay-methods-container">
                <!-- Injected dynamically based on config -->
              </div>
            </div>
            
            <div class="pow-row" style="margin-top:24px;">
              Secured by <span class="pow-chip">CheckoutFlow</span>
            </div>
          </div>
        </div>
        
        <!-- DRAWERS WRAPPER -->
        <div id="drawers-container">

         
            <div class="cf-payment-overlay" id="drwBill" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:300; align-items:flex-end;" onclick="this.style.display='none'">
              <div class="cf-payment-drawer" style="width:100%; max-width:400px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                   <div style="font-size:18px; font-weight:600;">Order Summary</div>
                   <svg viewBox="0 0 24 24" onclick="document.getElementById('drwBill').style.display='none'" style="width:24px; height:24px; stroke:var(--text3); fill:none; stroke-width:2; cursor:pointer;"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </div>
                <div class="card" style="padding:16px;">
                   <div class="oi" id="oi1" style="padding-top:0;">
                     <div class="oi-thumb">${finalProductImage ? `<img src="${finalProductImage}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>` : '🛍️'}</div>
                     <div class="oi-info">
                       <div class="oi-name">${productTitle || 'Product'}</div>
                       <div class="oi-ctrls">
                         <div class="qty-btn" id="qty-minus">−</div>
                         <span class="qty-n" id="q1">${currentQuantity}</span>
                         <div class="qty-btn" id="qty-plus">+</div>
                       </div>
                     </div>
                     <div class="oi-price"><div class="pr" id="p1">₹${total.toLocaleString('en-IN')}</div></div>
                   </div>
                </div>
                <div style="font-size:16px; font-weight:700; margin:20px 0 12px;">Bill summary</div>
                <div class="tr"><span class="l">Sub total</span><span class="v" id="tSub">₹${total.toLocaleString('en-IN')}</span></div>
                <div class="tr discount" id="trDisc" style="display:none;"><span class="l">Discount on MRP</span><span class="v" id="tDisc">-₹0</span></div>
                <div class="tr" id="trCod" style="display:none;"><span class="l">COD Fee</span><span class="v" id="tCodFee">₹${widgetConfig.codFeeAmount}</span></div>
                <hr class="tr-div">
                <div class="tr grand" style="font-size:16px;"><span class="l">Total amount</span><span class="v" id="tGrand">₹${total.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
         

         
         
            <div class="cf-payment-overlay" id="drwCoupon" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:300; align-items:flex-end;" onclick="this.style.display='none'">
              <div class="cf-payment-drawer" style="width:100%; max-width:400px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                   <div style="font-size:18px; font-weight:600;">Apply Coupon</div>
                   <svg viewBox="0 0 24 24" onclick="document.getElementById('drwCoupon').style.display='none'" style="width:24px; height:24px; stroke:var(--text3); fill:none; stroke-width:2; cursor:pointer;"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </div>
                <div class="cpn-input-row">
                   <svg viewBox="0 0 24 24" style="width:20px; height:20px; stroke:var(--green); fill:none; stroke-width:2; margin:8px 0 0 8px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                   <input type="text" class="cpn-input" id="cpn-manual-input" placeholder="Enter coupon code" style="text-transform:uppercase;" />
                   <button class="cpn-apply-btn" id="cpn-manual-btn">Apply</button>
                </div>
                <div id="cpn-manual-err" class="cpn-err" style="display:none;"></div>
                <div id="cpn-list-container" class="cpn-list">Loading coupons...</div>
              </div>
            </div>
         

</div>
        
        <!-- SUCCESS SCREEN -->
        <div class="success-screen" id="successScr" style="display:none; flex-direction:column; align-items:center; position:absolute; top:0; left:0; width:100%; height:100%; background:var(--bg); z-index:900; text-align:center;">
          <div class="s-icon" style="margin-top:80px;"><svg viewBox="0 0 24 24" style="width:64px; height:64px; stroke:var(--green); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div>
          <div class="s-title" style="font-size:24px; font-weight:600; color:var(--text1); margin-top:24px;">Order placed! 🎉</div>
          <div class="s-sub" style="font-size:15px; color:var(--text3); margin-top:8px;">Your order is confirmed.</div>
          <button class="cf-btn" id="close-success-btn" style="margin-top:40px; width:80%;">Close</button>
        </div>
      `;

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 10);

      const closeWidget = () => {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; }, 400);
      };
      document.getElementById('cf-close-btn').onclick = closeWidget;

      // Confetti Logic
      
      window.launchConfetti = () => {
         const canvas = document.getElementById('confetti-canvas');
         if (!canvas || !window.confetti) return;
         const myConfetti = window.confetti.create(canvas, { resize: true, useWorker: true });
         myConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      };


      // --- STATE MANAGEMENT ---
      const statePhone = document.getElementById('state-phone');
      const stateAddress = document.getElementById('state-address');
      const stateCheckout = document.getElementById('state-checkout');
      const sumHdr = document.getElementById('sumHdr');
            
      
      // Open Drawers
      document.getElementById('sumHdr').onclick = () => { document.getElementById('drwBill').style.display='flex'; };
      document.getElementById('osCpnLink').onclick = () => { document.getElementById('drwCoupon').style.display='flex'; };

      let availableCoupons = [];
      let appliedCoupon = null;
      let currentCouponDiscount = 0;

      const fetchCoupons = async () => {
         try {
           const res = await fetch(`${apiBaseUrl}/api/widget/coupons?shop=${shop}`);
           const data = await res.json();
           if(data.success) {
              availableCoupons = data.coupons;
              autoApplyCoupon();
              renderCoupons();
           }
         } catch(e){}
      };
      fetchCoupons();

      const autoApplyCoupon = () => {
         const subtotal = basePrice * currentQuantity;
         
         const validAuto = availableCoupons.filter(c => c.isAuto && currentQuantity >= c.minItems && subtotal >= c.minCartValue);
         if(validAuto.length > 0 && !appliedCoupon) {
            appliedCoupon = validAuto[0];
            if(window.launchConfetti) window.launchConfetti();
            updatePricing();
            renderCoupons();
         }
      };

      const renderCoupons = () => {
         const subtotal = basePrice * currentQuantity;
         const container = document.getElementById('cpn-list-container');
         let html = '<div style="font-weight:600; font-size:15px; margin-bottom:8px;">Applicable coupons</div>';
         
         const applicable = availableCoupons.filter(c => currentQuantity >= c.minItems && subtotal >= c.minCartValue);
         const unlockable = availableCoupons.filter(c => currentQuantity < c.minItems || subtotal < c.minCartValue);

         if(applicable.length === 0 && unlockable.length === 0) {
            container.innerHTML = '<div style="color:var(--text3); font-size:13px;">No coupons available right now.</div>';
            return;
         }

         applicable.forEach(c => {
            const isActive = appliedCoupon && appliedCoupon.id === c.id;
            const cls = isActive ? 'active' : '';
            const valTxt = c.type === 'percentage' ? `${c.value}% OFF` : `₹${c.value} OFF`;
            const actTxt = isActive ? '<span class="cpn-applied-txt">Applied</span>' : `<span class="cpn-action" onclick="window.cfApplyCoupon('${c.id}')">Apply</span>`;
            
            html += `
               <div class="cpn-item ${cls}">
                 <div class="cpn-item-header">
                    <div class="cpn-code">${isActive ? '<svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>' : '<svg viewBox="0 0 24 24" style="stroke:var(--text3);fill:none;stroke-width:2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>'} ${c.code}</div>
                    ${actTxt}
                 </div>
                 <div class="cpn-save-box">${valTxt}</div>
                 ${c.description ? `<div class="cpn-desc">${c.description}</div>` : ''}
               </div>
            `;
         });

         if(unlockable.length > 0) {
            html += '<div style="font-weight:600; font-size:15px; margin:20px 0 8px;">Unlock Coupons</div>';
            unlockable.forEach(c => {
               html += `
                  <div class="cpn-item disabled">
                    <div class="cpn-item-header">
                       <div class="cpn-code" style="color:var(--text3)"><svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> ${c.code}</div>
                       <span style="color:var(--text3); font-size:13px; font-weight:600;">Apply</span>
                    </div>
                    <div class="cpn-err">Applicable only on ${c.minCartValue > 0 ? `₹${c.minCartValue} orders` : `${c.minItems} or more items`}.</div>
                    ${c.description ? `<div class="cpn-desc">${c.description}</div>` : ''}
                  </div>
               `;
            });
         }
         container.innerHTML = html;
      };

      window.cfApplyCoupon = (id) => {
         appliedCoupon = availableCoupons.find(c => c.id === id);
         if(window.launchConfetti) window.launchConfetti();
         document.getElementById('drwCoupon').style.display = 'none';
         updatePricing();
         renderCoupons();
      };

      // Handle manual input
      document.getElementById('cpn-manual-btn').onclick = () => {
         const code = document.getElementById('cpn-manual-input').value.trim().toUpperCase();
         const err = document.getElementById('cpn-manual-err');
         if(!code) return;
         const subtotal = basePrice * currentQuantity;
         const c = availableCoupons.find(x => x.code.toUpperCase() === code);
         
         if(!c) {
            err.style.display = 'block'; err.innerText = 'Invalid coupon code.'; return;
         }
         if(currentQuantity < c.minItems || subtotal < c.minCartValue) {
            err.style.display = 'block'; err.innerText = 'Requirements not met for this coupon.'; return;
         }
         
         err.style.display = 'none';
         appliedCoupon = c;
         if(window.launchConfetti) window.launchConfetti();
         document.getElementById('cpn-manual-input').value = '';
         document.getElementById('drwCoupon').style.display = 'none';
         updatePricing();
         renderCoupons();
      };



      // --- DYNAMIC PRICING ---
      let currentPaymentMethod = null;
      
      const updatePricing = (method = null) => {
        if (method) currentPaymentMethod = method;
        
        const subtotal = basePrice * currentQuantity;
        let couponDiscount = 0;
        
        if (appliedCoupon) {
           if(appliedCoupon.type === 'percentage') {
              couponDiscount = subtotal * (appliedCoupon.value / 100);
              if(appliedCoupon.maxDiscount && couponDiscount > appliedCoupon.maxDiscount) couponDiscount = appliedCoupon.maxDiscount;
           } else {
              couponDiscount = appliedCoupon.value;
           }
        }

        let prepaidDiscount = 0;
        let codFee = 0;
        
        if (currentPaymentMethod === 'COD') {
           codFee = widgetConfig.codFeeAmount || 0;
        } else if (currentPaymentMethod !== null && widgetConfig.isPrepaidDiscountEnabled) {
           prepaidDiscount = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
        }
        
        currentCouponDiscount = couponDiscount;
        const totalDiscount = couponDiscount + prepaidDiscount;
        const grandTotal = Math.max(0, subtotal - totalDiscount) + codFee;

        document.getElementById('hFinal').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        document.getElementById('osFinalPrice').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        document.getElementById('osItemCount').innerText = `${currentQuantity} item${currentQuantity>1?'s':''}`;
        
        // Original price in header
        if(totalDiscount > 0) {
           document.getElementById('osOrigPrice').style.display = 'inline';
           document.getElementById('osOrigPrice').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        } else {
           document.getElementById('osOrigPrice').style.display = 'none';
        }

        // Green Save Banner
        if(couponDiscount > 0) {
           document.getElementById('osSaveBanner').style.display = 'block';
           document.getElementById('osSaveAmt').innerText = `₹${Math.round(couponDiscount).toLocaleString('en-IN')}`;
        } else {
           document.getElementById('osSaveBanner').style.display = 'none';
        }

        // Coupon Box in Order Summary Bar
        if(appliedCoupon) {
           document.getElementById('osCpnEmpty').style.display = 'none';
           document.getElementById('osCpnActive').style.display = 'inline-flex';
           document.getElementById('osCpnCode').innerText = appliedCoupon.code;
           document.getElementById('osCpnSave').innerText = `Save ₹${Math.round(couponDiscount).toLocaleString('en-IN')}`;
           document.getElementById('osCpnLink').innerText = 'Change >';
        } else {
           document.getElementById('osCpnEmpty').style.display = 'block';
           document.getElementById('osCpnActive').style.display = 'none';
           document.getElementById('osCpnLink').innerText = 'Enter a Coupon >';
        }

        // Drawer values
        document.getElementById('tSub').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('tGrand').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        document.getElementById('q1').innerText = currentQuantity;
        document.getElementById('p1').innerText = `₹${subtotal.toLocaleString('en-IN')}`;

        const discRow = document.getElementById('trDisc');
        if (totalDiscount > 0) {
           discRow.style.display = 'flex';
           document.getElementById('tDisc').innerText = `-₹${Math.round(totalDiscount).toLocaleString('en-IN')}`;
        } else {
           discRow.style.display = 'none';
        }

        const codRow = document.getElementById('trCod');
        if (codFee > 0) {
           codRow.style.display = 'flex';
           document.getElementById('tCodFee').innerText = `₹${codFee.toLocaleString('en-IN')}`;
        } else {
           codRow.style.display = 'none';
        }

        ['UPI','Card','Wallet','Netbanking'].forEach(m => {
           const el = document.getElementById(`pp${m}`);
           if(el) {
              let mDisc = couponDiscount;
              if (widgetConfig.isPrepaidDiscountEnabled) {
                 mDisc += widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
              }
              el.innerText = `₹${Math.round(Math.max(0, subtotal - mDisc)).toLocaleString('en-IN')}`;
           }
        });
        const elCod = document.getElementById('ppCOD');
        if(elCod) elCod.innerText = `₹${Math.round(subtotal - couponDiscount + (widgetConfig.codFeeAmount || 0)).toLocaleString('en-IN')}`;

        const elCodBtn = document.getElementById('cod-confirm-btn');
        if(elCodBtn) elCodBtn.innerText = `Confirm COD (₹${Math.round(subtotal - couponDiscount + codFee).toLocaleString('en-IN')})`;

        const elOnlineBtn = document.getElementById('cod-save-btn');
        if(elOnlineBtn) {
            let mDisc = 0;
            if (widgetConfig.isPrepaidDiscountEnabled) {
               mDisc = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
            }
            if (mDisc > 0) {
                elOnlineBtn.innerHTML = `Pay Online <span style="background:rgba(255,255,255,0.25); padding:4px 8px; border-radius:20px; font-size:12px; margin-left:6px; font-weight:600;">Save ₹${Math.round(mDisc).toLocaleString('en-IN')}</span>`;
            } else {
                elOnlineBtn.innerHTML = `Pay Online`;
            }
        }
      };

      document.getElementById('qty-plus').onclick = () => { currentQuantity++; updatePricing(); };
      document.getElementById('qty-minus').onclick = () => { if(currentQuantity > 1) { currentQuantity--; updatePricing(); } };

      // --- PHONE LOGIC ---
      let otpStepActive = false;
      const phoneIn = document.getElementById('cf-phone-in');
      const otpIn = document.getElementById('cf-otp-in');
      const phoneBtn = document.getElementById('cf-phone-btn');
      
      phoneBtn.onclick = async () => {
        if (!otpStepActive) {
          const phone = phoneIn.value;
          if(phone.length !== 10) return;
          phoneBtn.innerText = 'Sending...';
          try {
            const res = await fetch(`${apiBaseUrl}/api/otp/send`, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ shop, phone })
            });
            const data = await res.json();
            if (data.success) {
              verifiedPhone = phone;
              document.getElementById('cf-otp-box').style.display = 'block';
              otpStepActive = true;
              phoneBtn.innerText = 'Verify & Continue';
            } else {
              phoneBtn.innerText = 'Continue';
            }
          } catch(err) { phoneBtn.innerText = 'Continue'; }
        } else {
          const code = otpIn.value;
          phoneBtn.innerText = 'Verifying...';
          try {
            const res = await fetch(`${apiBaseUrl}/api/otp/verify`, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ shop, phone: verifiedPhone, code })
            });
            const data = await res.json();
            if (data.success || data.valid) {
              localStorage.setItem('checkoutflow_verified_phone', verifiedPhone);
              checkCustomer();
            } else {
              phoneBtn.innerText = 'Verify & Continue';
            }
          } catch(err) { phoneBtn.innerText = 'Verify & Continue'; }
        }
      };

      const checkCustomer = async () => {
        statePhone.style.display = 'none';
        try {
          const res = await fetch(`${apiBaseUrl}/api/customer/lookup?shop=${shop}&phone=${verifiedPhone}`);
          const data = await res.json();
          if (data.success && data.customer) {
            customerData = data.customer;
            document.getElementById('disp-name').innerText = customerData.name;
            document.getElementById('disp-addr').innerText = `${customerData.address}, ${customerData.city}`;
            document.getElementById('disp-phone').innerText = verifiedPhone;
            document.getElementById('disp-email').innerText = customerData.email || '';
            
            document.getElementById('cf-addr-name').value = customerData.name || '';
            document.getElementById('cf-addr-email').value = customerData.email || '';
            document.getElementById('cf-addr-street').value = customerData.address || '';
            document.getElementById('cf-addr-city').value = customerData.city || '';
            document.getElementById('cf-addr-state').value = customerData.state || '';
            document.getElementById('cf-addr-pin').value = customerData.pincode || '';

            renderPaymentMethods();
            stateCheckout.style.display = 'block';
          } else {
            stateAddress.style.display = 'block';
          }
        } catch(e) { stateAddress.style.display = 'block'; }
      };

      document.getElementById('cf-addr-btn').onclick = () => {
        const name = document.getElementById('cf-addr-name').value;
        const email = document.getElementById('cf-addr-email').value;
        const addr = document.getElementById('cf-addr-street').value;
        const city = document.getElementById('cf-addr-city').value;
        if(!name || !addr || !city) return;
        
        document.getElementById('disp-name').innerText = name;
        document.getElementById('disp-addr').innerText = `${addr}, ${city}`;
        document.getElementById('disp-phone').innerText = verifiedPhone;
        document.getElementById('disp-email').innerText = email;
        
        stateAddress.style.display = 'none';
        renderPaymentMethods();
        stateCheckout.style.display = 'block';
      };

      document.getElementById('cf-edit-addr').onclick = () => {
        stateCheckout.style.display = 'none';
        stateAddress.style.display = 'block';
      };

      if (verifiedPhone) {
        checkCustomer();
      }

      // --- PAYMENT DRAWERS & METHODS ---
      const renderPaymentMethods = () => {
         const container = document.getElementById('pay-methods-container');
         const dContainer = document.getElementById('drawers-container');
         let html = '';
         let dHtml = '';

                  
         const methods = [
            { id: 'UPI', name: 'Pay via UPI', sub: 'GPay · PhonePe · Paytm', icon: '<img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" style="height:14px;"/>' },
            { id: 'Card', name: 'Debit / Credit cards', sub: 'Visa · Mastercard · RuPay', icon: '<svg viewBox="0 0 24 24" style="height:18px;stroke:var(--p2);fill:none;stroke-width:2;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' },
            { id: 'Wallet', name: 'Wallets', sub: 'Paytm · PhonePe', icon: '<svg viewBox="0 0 24 24" style="height:18px;stroke:var(--p2);fill:none;stroke-width:2;"><path d="M20 12V22H4V12"/><path d="M12 22V7M12 7a5 5 0 01-5-5 5 5 0 005 5z"/></svg>' },
            { id: 'Netbanking', name: 'Net banking', sub: 'All Indian banks', icon: '<svg viewBox="0 0 24 24" style="height:18px;stroke:var(--p1);fill:none;stroke-width:2;"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>' },
            { id: 'COD', name: 'Cash on Delivery', sub: `Pay at doorstep · ₹${widgetConfig.codFeeAmount || 0} fee`, icon: '<svg viewBox="0 0 24 24" style="height:18px;stroke:#d97706;fill:none;stroke-width:2;"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>' }
         ];

         methods.forEach(m => {
            if (m.id !== 'COD' && !widgetConfig.hasRazorpay) return; // Skip online methods if RP disabled

            // Drawer
            if (m.id === 'COD') {
              dHtml += `
                <div class="cf-payment-overlay" id="drw${m.id}" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:200; align-items:flex-end;" onclick="this.style.display='none'">
                  <div class="cf-payment-drawer" style="width:100%; max-width:400px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                     <div style="font-size:18px; font-weight:600; margin-bottom:16px;">${m.name}</div>
                     <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="cf-btn" onclick="document.getElementById('drw${m.id}').style.display='none'; window.cfExecutePayment('UPI')" id="cod-save-btn" style="background:var(--green);">Pay Online (Save)</button>
                        <button class="cf-btn" onclick="window.cfExecutePayment('${m.id}')" id="cod-confirm-btn" style="background:var(--surface); color:var(--text1); border:1.5px solid var(--border2); box-shadow:none;">Confirm COD</button>
                     </div>
                  </div>
                </div>
              `;
            }

            // Row
            let offerTxt = '';
            if (m.id !== 'COD' && widgetConfig.isPrepaidDiscountEnabled) {
                offerTxt = `<div style="font-size:11px; font-weight:500; color:var(--green); margin-top:4px;">Discount Applied</div>`;
            }

            const clickAction = m.id === 'COD' 
                ? `window.cfUpdatePricing('${m.id}'); document.getElementById('drw${m.id}').style.display='flex'`
                : `window.cfUpdatePricing('${m.id}'); window.cfExecutePayment('${m.id}')`;

            html += `
              <div class="pay-row" onclick="${clickAction}" style="display:flex; align-items:center; gap:12px; padding:14px; border-top:1px solid var(--border); cursor:pointer;">
                <div style="width:40px; height:40px; border-radius:10px; border:1px solid var(--border2); display:flex; align-items:center; justify-content:center;">
                  ${m.icon}
                </div>
                <div style="flex:1;">
                  <div style="font-size:14px; font-weight:500;">${m.name}</div>
                  <div style="font-size:11px; color:var(--text3);">${m.sub}</div>
                  ${offerTxt}
                </div>
                <div style="font-weight:600; font-size:15px;" id="pp${m.id}"></div>
              </div>
            `;
         });
         
         container.innerHTML = html;
         
         let dynD = document.getElementById('dynamic-drawers');
         if(!dynD) { dynD = document.createElement('div'); dynD.id = 'dynamic-drawers'; dContainer.appendChild(dynD); }
         dynD.innerHTML = dHtml;

         updatePricing();
      };

      // --- PAYMENT EXECUTION ---
      window.cfUpdatePricing = updatePricing;
      window.cfExecutePayment = async (method) => {
         const btn = document.getElementById(`paybtn-${method}`) || document.getElementById('cod-save-btn');
         if (btn) btn.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><svg style="width:18px;height:18px;animation:cf-spin 1s linear infinite;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="31.4" stroke-linecap="round"></circle></svg> Processing...</div>';
         
         let prepaidDiscount = 0;
         const subtotal = basePrice * currentQuantity;
         if (widgetConfig.isPrepaidDiscountEnabled && method !== 'COD') {
            prepaidDiscount = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
         }

         const payload = {
            shop, variantId, quantity: currentQuantity, productTitle, price,
            customerName: document.getElementById('cf-addr-name').value,
            customerPhone: verifiedPhone,
            customerEmail: document.getElementById('cf-addr-email').value,
            address: document.getElementById('cf-addr-street').value,
            city: document.getElementById('cf-addr-city').value,
            state: document.getElementById('cf-addr-state').value,
            pincode: document.getElementById('cf-addr-pin').value,
            paymentMethod: method,
            prepaidDiscount,
            appliedCoupon: appliedCoupon ? { code: appliedCoupon.code, amount: Math.round(currentCouponDiscount) } : undefined
         };

         const createFinalOrder = async () => {
             try {
                const res = await fetch(`${apiBaseUrl}/api/create-order`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if(data.success) {
                   if (data.orderStatusUrl) {
                       window.location.href = data.orderStatusUrl;
                   } else {
                       const drw = document.getElementById(`drw${method}`);
                       if (drw) drw.style.display = 'none';
                       document.getElementById('state-checkout').style.display='none';
                       document.getElementById('successScr').style.display='flex';
                       if(window.launchConfetti) window.launchConfetti();
                       setTimeout(() => { if(window.launchConfetti) window.launchConfetti(); }, 600);
                   }
                } else {
                   if (btn) btn.innerText = 'Failed';
                   alert("Failed to create order: " + (data.error || 'Unknown error'));
                }
             } catch(e) {
                if (btn) btn.innerText = 'Error';
                alert("Network error: " + e.message);
             }
         };

         if (method !== 'COD') {
           try {
             const rzpAmount = Math.max(0, subtotal - prepaidDiscount);
             const rzpOrderRes = await fetch(`${apiBaseUrl}/api/checkout/create-razorpay-order`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ shop, amount: rzpAmount })
             });
             const rzpOrderData = await rzpOrderRes.json();
             
             if (!rzpOrderData.success) {
               alert('Failed to initialize payment gateway: ' + rzpOrderData.error);
               if (btn) btn.innerText = `Pay ${method}`;
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
                 const verifyRes = await fetch(`${apiBaseUrl}/api/checkout/verify-payment`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     shop, razorpay_order_id: response.razorpay_order_id,
                     razorpay_payment_id: response.razorpay_payment_id,
                     razorpay_signature: response.razorpay_signature
                   })
                 });
                 const verifyData = await verifyRes.json();
                 if (verifyData.success) {
                   payload.paymentId = response.razorpay_payment_id;
                   await createFinalOrder();
                 } else {
                   alert('Payment verification failed.');
                   if (btn) btn.innerText = `Pay ${method}`;
                 }
               },
               prefill: {
                 name: payload.customerName,
                 email: payload.customerEmail,
                 contact: payload.customerPhone
               },
               theme: { color: primaryColor }
             };
             
             const rzp = new window.Razorpay(options);
             rzp.on('payment.failed', function (response){
               alert('Payment failed. Reason: ' + response.error.description);
               if (btn) btn.innerText = `Pay ${method}`;
             });
             rzp.open();
             
           } catch(e) {
             alert('Error initiating payment.');
             if (btn) btn.innerText = `Pay ${method}`;
           }
         } else {
            await createFinalOrder();
         }
      };

      document.getElementById('close-success-btn').onclick = closeWidget;

    },

    autoInject: function() {
      window.addEventListener('DOMContentLoaded', () => {
        const cartForms = document.querySelectorAll('form[action="/cart/add"]');
        cartForms.forEach(form => {
          const fastCheckoutBtn = document.createElement('button');
          fastCheckoutBtn.type = 'button';
          fastCheckoutBtn.innerText = 'Buy Now (CheckoutFlow)';
          fastCheckoutBtn.style.cssText = 'width: 100%; padding: 15px; margin-top: 10px; background-color: #10b981; color: white; border: none; font-weight: bold; font-size: 16px; border-radius: 6px; cursor: pointer;';
          
          fastCheckoutBtn.onclick = (e) => {
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
              price = window.meta.product.variants[0].price / 100;
              if (window.meta.product.variants[0].featured_image) {
                productImage = window.meta.product.variants[0].featured_image.src;
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
              variantId: variantId,
              quantity: quantity,
              productTitle: productTitle,
              productImage: productImage,
              price: price
            });
          };
          form.appendChild(fastCheckoutBtn);
        });
      });
    }
  };

  window.CheckoutFlow.autoInject();
})();
