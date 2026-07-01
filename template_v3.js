open: async function(options) {
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

      // Remove any existing widget instances to prevent duplicate ID bugs
      const existingHost = document.getElementById('checkoutflow-host');
      if (existingHost) existingHost.remove();

      const host = document.createElement('div');
      host.id = 'checkoutflow-host';
      host.style.cssText = 'all: initial; position: relative; z-index: 2147483647;';
      const widgetRoot = host.attachShadow({ mode: 'open' });

      const overlay = document.createElement('div');
      overlay.id = 'checkoutflow-overlay';
      overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:flex-end; justify-content:center;';

      const sheet = document.createElement('div');
      sheet.id = 'checkoutflow-sheet';
      sheet.style.cssText = 'width:100%; max-width:400px; height:88vh; background:#f5f3ff; border-top-left-radius:24px; border-top-right-radius:24px; transform:translateY(100%); transition:transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); overflow:hidden; display:flex; flex-direction:column; position:relative; box-shadow:0 -10px 40px rgba(0,0,0,0.2);';

      let totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      let subtotalBase = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      let total = subtotalBase;
      
      let verifiedPhone = localStorage.getItem('checkoutflow_verified_phone') || '';
      let customerData = null;

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
          /*__CSS__*/
          :host { --p1: ${primaryColor}; }
          
          /* Custom form styles */
          .cf-input { width: 100%; height: 48px; padding: 0 16px; border: 1.5px solid var(--border2); border-radius: var(--radius-sm); font-size: 14px; font-family: var(--font); color: var(--text1); outline: none; transition: border-color 0.2s; margin-bottom: 12px; }
          .cf-input:focus { border-color: var(--p1); }
          .cf-btn { width: 100%; height: 52px; background: var(--p1); color: #fff; border: none; border-radius: var(--radius); font-size: 15px; font-weight: 600; cursor: pointer; font-family: var(--font); transition: transform 0.15s, box-shadow 0.15s; }
          .cf-btn:active { transform: scale(0.98); }
        </style>
        
        
        <canvas id="confetti-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1000;"></canvas>

        <div class="top-header">
          <div class="back-btn" id="cf-close-btn">
            <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </div>
          <div class="brand-center">
            ${widgetConfig.brandLogoUrl ? `<img src="${widgetConfig.brandLogoUrl}" alt="Logo" style="max-height:28px; object-fit:contain;"/>` : `<div class="brand-title">${(widgetConfig.storeName || shop.split('.')[0]).substring(0,18)}</div>`}
            <div class="brand-subtitle"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Secure Checkout</div>
          </div>
        </div>

        <div class="scroll-body">
          <div class="promo-banner" id="dynamic-banner">
            <svg viewBox="0 0 24 24"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="18.5" r="2.5"/></svg>
            <span class="promo-text">${widgetConfig.preLoginBannerText || '<strong>FREE SHIPPING</strong> on all orders today! 🎉'}</span>
          </div>

          <!-- STATE 1: PHONE -->
          <div id="state-phone" style="padding: 10px 0;">
             <h3 style="margin-bottom:16px; color:var(--text-main); font-size:16px; font-weight:600;">Enter mobile number</h3>
             <div class="design-card solid-border" style="flex-direction:column; align-items:stretch; padding:16px; margin-bottom:16px; cursor:default;">
               <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                 <span style="font-size:20px;">🇮🇳</span> <span style="font-weight:500;">+91</span>
                 <input type="tel" id="cf-phone-in" class="cf-input" style="margin-bottom:0; border:none; border-left:1.5px solid var(--border); border-radius:0; padding-left:12px;" placeholder="Mobile Number" maxlength="10" />
               </div>
               <div id="cf-otp-box" style="display:none; margin-top:16px; padding-top:16px; border-top:1.5px dashed var(--border);">
                 <input type="text" id="cf-otp-in" class="cf-input" placeholder="Enter 4-digit OTP" style="text-align:center; letter-spacing:8px; font-weight:500;" maxlength="4" />
                 <div id="cf-otp-err" style="color:var(--red); font-size:12px; font-weight:600; text-align:center; display:none;"></div>
               </div>
             </div>
             <button id="cf-phone-btn" class="cf-btn">Continue</button>
             <div id="cf-phone-err" style="color:var(--red); font-size:12px; font-weight:600; text-align:center; margin-top:10px; display:none;"></div>
          </div>

          <!-- STATE 2: ADDRESS -->
          <div id="state-address" style="display:none; padding: 10px 0;">
             <h3 style="margin-bottom:16px; color:var(--text-main); font-size:16px; font-weight:600;">Add shipping address</h3>
             <div class="design-card solid-border" style="flex-direction:column; align-items:stretch; cursor:default;">
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
          <div id="state-checkout" style="display:none;">
            
             <!-- Order Summary -->
             <div class="design-card solid-border" onclick="widgetRoot.getElementById('drwBill').style.display='flex'">
               <div class="icon-box purple"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg></div>
               <div class="card-content">
                  <div class="card-title">Order Summary (<span id="osItemCount">${totalQuantity}</span> Item) <svg class="chevron-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
                  <div class="card-subtitle">Total Amount</div>
               </div>
               <div class="card-price-col">
                  <div class="card-price" id="hFinal">₹${total.toLocaleString('en-IN')}</div>
                  <div class="card-price-sub" id="osFinalPrice">₹${total.toLocaleString('en-IN')}</div>
               </div>
             </div>

             <!-- Apply Coupon -->
             <div class="design-card solid-border" id="osCpnLink" style="margin-bottom: 24px;">
               <div class="icon-box orange"><svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></div>
               <div class="card-content">
                  <div class="card-title" style="color: #f97316;">Apply Coupon</div>
                  <div class="card-subtitle">Unlock extra savings on your order</div>
               </div>
               <svg class="chevron-icon" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
             </div>

             <!-- Delivered To -->
             <div class="design-card solid-border">
               <div class="icon-box purple"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
               <div class="card-content">
                  <div class="card-title" style="font-size:12px; font-weight:500; color:var(--text-main);">Delivered To</div>
                  <div class="card-title" style="margin-top:4px;"><span id="disp-name">Name</span> <span class="home-tag">Home</span></div>
                  <div class="card-subtitle" id="disp-addr">Address</div>
               </div>
               <div class="change-link" id="cf-edit-addr">Change <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
             </div>

             <div class="sec-lbl">PAYMENT METHODS</div>
             <div id="pay-methods-container">
               <!-- Injected -->
             </div>

             <div class="trust-footer">
               <div class="trust-item">
                 <div class="trust-icon purple"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                 <div class="trust-title">100% Secure</div>
                 <div class="trust-sub">SSL Encrypted</div>
               </div>
               <div class="trust-item">
                 <div class="trust-icon green"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                 <div class="trust-title">RBI Compliant</div>
                 <div class="trust-sub">Trusted Gateways</div>
               </div>
               <div class="trust-item">
                 <div class="trust-icon blue"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></div>
                 <div class="trust-title">Easy Returns</div>
                 <div class="trust-sub">Hassle Free</div>
               </div>
               <div class="trust-item">
                 <div class="trust-icon orange"><svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg></div>
                 <div class="trust-title">4.8/5 Rating</div>
                 <div class="trust-sub">18,000+ Customers</div>
               </div>
             </div>
          </div>
        </div>
        <!-- DRAWERS WRAPPER -->
        <div id="drawers-container">

         
            <div class="cf-payment-overlay" id="drwBill" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:300; align-items:flex-end;" onclick="this.style.display='none'">
              <div class="cf-payment-drawer" style="width:100%; max-width:400px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                   <div style="font-size:18px; font-weight:600;">Order Summary</div>
                   <svg viewBox="0 0 24 24" onclick="widgetRoot.getElementById('drwBill').style.display='none'" style="width:24px; height:24px; stroke:var(--text3); fill:none; stroke-width:2; cursor:pointer;"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </div>
                <div class="card" style="padding:16px;">
                   <div id="cart-items-container">
                     ${cartItems.map((item, index) => `
                     <div class="oi" id="oi${index}" style="${index === 0 ? 'padding-top:0;' : ''}">
                       <div class="oi-thumb">${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>` : '🛍️'}</div>
                       <div class="oi-info">
                         <div class="oi-name">${item.title || 'Product'}</div>
                         <div class="oi-ctrls">
                           <div class="qty-btn" onclick="window.cfUpdateQty(${index}, -1)" ${cartItems.length > 1 ? 'style="display:none;"' : ''}>−</div>
                           <span class="qty-n" id="q${index}">${item.quantity}</span>
                           <div class="qty-btn" onclick="window.cfUpdateQty(${index}, 1)" ${cartItems.length > 1 ? 'style="display:none;"' : ''}>+</div>
                         </div>
                       </div>
                       <div class="oi-price"><div class="pr" id="p${index}">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div></div>
                     </div>
                     `).join('')}
                   </div>
                </div>
                <div style="font-size:16px; font-weight:700; margin:20px 0 12px;">Bill summary</div>
                <div class="tr"><span class="l">Sub total</span><span class="v" id="tSub">₹${total.toLocaleString('en-IN')}</span></div>
                <div class="tr discount" id="trDisc" style="display:none;"><span class="l">Discount on MRP</span><span class="v" id="tDisc">-₹0</span></div>
                <div class="tr" id="trShip" style="display:none;"><span class="l">Shipping Fee</span><span class="v" id="tShipFee">₹0</span></div>
                <div class="tr" id="trCod" style="display:none;"><span class="l">COD Fee</span><span class="v" id="tCodFee">₹${widgetConfig.codFeeAmount}</span></div>
                <hr class="tr-div">
                <div class="tr grand" style="font-size:16px;"><span class="l">Total amount</span><span class="v" id="tGrand">₹${total.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
         

         
         
            <div class="cf-payment-overlay" id="drwCoupon" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:300; align-items:flex-end;" onclick="this.style.display='none'">
              <div class="cf-payment-drawer" style="width:100%; max-width:400px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                   <div style="font-size:18px; font-weight:600;">Apply Coupon</div>
                   <svg viewBox="0 0 24 24" onclick="widgetRoot.getElementById('drwCoupon').style.display='none'" style="width:24px; height:24px; stroke:var(--text3); fill:none; stroke-width:2; cursor:pointer;"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
      widgetRoot.appendChild(overlay);
      document.body.appendChild(host);
      document.body.style.overflow = 'hidden';

      setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 10);

      const closeWidget = () => {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; }, 400);
      };
      widgetRoot.getElementById('cf-close-btn').onclick = closeWidget;

      // Confetti Logic
      
      window.launchConfetti = () => {
         const canvas = widgetRoot.getElementById('confetti-canvas');
         if (!canvas || !window.confetti) return;
         const myConfetti = window.confetti.create(canvas, { resize: true, useWorker: true });
         myConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      };


      // --- STATE MANAGEMENT ---
      const statePhone = widgetRoot.getElementById('state-phone');
      const stateAddress = widgetRoot.getElementById('state-address');
      const stateCheckout = widgetRoot.getElementById('state-checkout');
      const sumHdr = widgetRoot.getElementById('sumHdr');
            
      
      // Open Drawers
      widgetRoot.getElementById('sumHdr').onclick = () => { widgetRoot.getElementById('drwBill').style.display='flex'; };
      widgetRoot.getElementById('osCpnLink').onclick = () => { widgetRoot.getElementById('drwCoupon').style.display='flex'; };

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

      
      const cfTrack = async (evt) => {
         try {
            await fetch(`${apiBaseUrl}/api/analytics`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ shop, eventName: evt })
            });
         } catch(e){}
      };

      
      const loadUpsell = async () => {
         try {
            const res = await fetch(`${apiBaseUrl}/api/upsell/active?shop=${shop}&variantId=${variantId}`);
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
                  updateTotals();
               });
            }
         } catch(e) {}
      };
      loadUpsell();

      const autoApplyCoupon = () => {
         const subtotal = subtotalBase;
         
         // 1. Check if currently applied coupon is still valid
         if (appliedCoupon) {
             if (totalQuantity < appliedCoupon.minItems || subtotal < appliedCoupon.minCartValue) {
                 appliedCoupon = null; // Clear it if invalid
             }
         }
         
         // 2. Try to find a valid auto-apply coupon if none applied
         if (!appliedCoupon) {
             const validAuto = availableCoupons.filter(c => c.isAuto && totalQuantity >= c.minItems && subtotal >= c.minCartValue);
             if(validAuto.length > 0) {
                // Sort by value (descending) to apply the best one
                validAuto.sort((a,b) => {
                   let aVal = a.type === 'percentage' ? subtotal * (a.value/100) : a.value;
                   let bVal = b.type === 'percentage' ? subtotal * (b.value/100) : b.value;
                   if(a.maxDiscount) aVal = Math.min(aVal, a.maxDiscount);
                   if(b.maxDiscount) bVal = Math.min(bVal, b.maxDiscount);
                   return bVal - aVal;
                });
                appliedCoupon = validAuto[0];
                if(window.launchConfetti) window.launchConfetti();
             }
         }
      };

      const renderCoupons = () => {
         const subtotal = subtotalBase;
         const container = widgetRoot.getElementById('cpn-list-container');
         let html = '<div style="font-weight:600; font-size:15px; margin-bottom:8px;">Applicable coupons</div>';
         
         const applicable = availableCoupons.filter(c => totalQuantity >= c.minItems && subtotal >= c.minCartValue);
         const unlockable = availableCoupons.filter(c => totalQuantity < c.minItems || subtotal < c.minCartValue);

         if(applicable.length === 0 && unlockable.length === 0) {
            html += '<div style="font-size:13px; color:var(--text3);">No coupons available at the moment.</div>';
         } else {
            applicable.forEach(c => {
               const isActive = appliedCoupon && appliedCoupon.id === c.id;
               const actTxt = isActive ? '<span class="cpn-applied-txt">Applied</span>' : `<span class="cpn-action" onclick="window.cfApplyCoupon('${c.id}')">Apply</span>`;
               html += `
                  <div class="cpn-card ${isActive ? 'cpn-active' : ''}">
                     <div class="cpn-header">
                        <div class="cpn-code">${c.code}</div>
                        ${actTxt}
                     </div>
                     <div class="cpn-title">${c.type === 'percentage' ? c.value+'% OFF' : '₹'+c.value+' OFF'}</div>
                     ${c.description ? `<div class="cpn-desc">${c.description}</div>` : ''}
                  </div>
               `;
            });

            if(unlockable.length > 0) {
               html += '<div style="font-weight:600; font-size:15px; margin:16px 0 8px;">More offers</div>';
               unlockable.forEach(c => {
                  html += `
                     <div class="cpn-card" style="opacity:0.6; pointer-events:none;">
                        <div class="cpn-header">
                           <div class="cpn-code">${c.code}</div>
                           <span style="color:var(--text3); font-size:13px; font-weight:600;">Apply</span>
                        </div>
                        <div class="cpn-err">Applicable only on ${c.minCartValue > 0 ? `₹${c.minCartValue} orders` : `${c.minItems} or more items`}.</div>
                        ${c.description ? `<div class="cpn-desc">${c.description}</div>` : ''}
                     </div>
                  `;
               });
            }
         }
         container.innerHTML = html;
      };

      window.cfApplyCoupon = (id) => {
         appliedCoupon = availableCoupons.find(c => c.id === id);
         if(window.launchConfetti) window.launchConfetti();
         widgetRoot.getElementById('drwCoupon').style.display = 'none';
         updatePricing();
         renderCoupons();
      };

      // Handle manual input
      widgetRoot.getElementById('cpn-manual-btn').onclick = () => {
         const code = widgetRoot.getElementById('cpn-manual-input').value.trim().toUpperCase();
         const err = widgetRoot.getElementById('cpn-manual-err');
         if(!code) return;
         const subtotal = subtotalBase;
         const c = availableCoupons.find(x => x.code.toUpperCase() === code);
         
         if(!c) {
            err.style.display = 'block'; err.innerText = 'Invalid coupon code.'; return;
         }
         if(totalQuantity < c.minItems || subtotal < c.minCartValue) {
            err.style.display = 'block'; err.innerText = 'Requirements not met for this coupon.'; return;
         }
         
         err.style.display = 'none';
         appliedCoupon = c;
         if(window.launchConfetti) window.launchConfetti();
         widgetRoot.getElementById('cpn-manual-input').value = '';
         widgetRoot.getElementById('drwCoupon').style.display = 'none';
         updatePricing();
         renderCoupons();
      };



      // --- DYNAMIC PRICING ---
      let currentPaymentMethod = null;
      
      const updatePricing = (method = null) => {
        autoApplyCoupon();
        renderCoupons();

        if (method) currentPaymentMethod = method;
        
        const subtotal = subtotalBase;
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
        let shippingFee = 0;
        
        if (widgetConfig.isShippingFeeEnabled) {
            const threshold = typeof widgetConfig.freeShippingThreshold === 'number' ? widgetConfig.freeShippingThreshold : 999;
            if (threshold === 0 || subtotal < threshold) {
                shippingFee = widgetConfig.shippingFeeAmount || 0;
            }
        }
        
        if (currentPaymentMethod === 'COD') {
           if (widgetConfig.isCodFeeEnabled !== false) {
               codFee = shippingFee > 0 ? 0 : (widgetConfig.codFeeAmount || 0);
           }
        } else if (currentPaymentMethod !== null && widgetConfig.isPrepaidDiscountEnabled) {
           prepaidDiscount = widgetConfig.prepaidDiscountType === 'percentage' ? (subtotal - couponDiscount) * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
        }
        
        currentCouponDiscount = couponDiscount;
        const totalDiscount = couponDiscount + prepaidDiscount;
        const grandTotal = Math.max(0, subtotal - totalDiscount) + codFee + shippingFee;

        widgetRoot.getElementById('hFinal').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        widgetRoot.getElementById('osFinalPrice').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        widgetRoot.getElementById('osItemCount').innerText = `${totalQuantity} item${totalQuantity>1?'s':''}`;
        
        // Original price in header
        if(totalDiscount > 0) {
           widgetRoot.getElementById('osOrigPrice').style.display = 'inline';
           widgetRoot.getElementById('osOrigPrice').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        } else {
           widgetRoot.getElementById('osOrigPrice').style.display = 'none';
        }

        // Green Save Banner
        if(couponDiscount > 0) {
           widgetRoot.getElementById('osSaveBanner').style.display = 'block';
           widgetRoot.getElementById('osSaveAmt').innerText = `₹${Math.round(couponDiscount).toLocaleString('en-IN')}`;
        } else {
           widgetRoot.getElementById('osSaveBanner').style.display = 'none';
        }

        // Coupon Box in Order Summary Bar
        if(appliedCoupon) {
           widgetRoot.getElementById('osCpnEmpty').style.display = 'none';
           widgetRoot.getElementById('osCpnActive').style.display = 'inline-flex';
           widgetRoot.getElementById('osCpnCode').innerText = appliedCoupon.code;
           widgetRoot.getElementById('osCpnSave').innerText = `Save ₹${Math.round(couponDiscount).toLocaleString('en-IN')}`;
           widgetRoot.getElementById('osCpnLink').innerText = 'Change >';
        } else {
           widgetRoot.getElementById('osCpnEmpty').style.display = 'block';
           widgetRoot.getElementById('osCpnActive').style.display = 'none';
           widgetRoot.getElementById('osCpnLink').innerText = 'Enter a Coupon >';
        }

        // Drawer values
        widgetRoot.getElementById('tSub').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        widgetRoot.getElementById('tGrand').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;

        const discRow = widgetRoot.getElementById('trDisc');
        if (totalDiscount > 0) {
           discRow.style.display = 'flex';
           widgetRoot.getElementById('tDisc').innerText = `-₹${Math.round(totalDiscount).toLocaleString('en-IN')}`;
        } else {
           discRow.style.display = 'none';
        }

        const shipRow = widgetRoot.getElementById('trShip');
        if (shippingFee > 0) {
           shipRow.style.display = 'flex';
           widgetRoot.getElementById('tShipFee').innerText = `₹${shippingFee.toLocaleString('en-IN')}`;
        } else {
           shipRow.style.display = 'none';
        }

        const codRow = widgetRoot.getElementById('trCod');
        if (codFee > 0) {
           codRow.style.display = 'flex';
           widgetRoot.getElementById('tCodFee').innerText = `₹${codFee.toLocaleString('en-IN')}`;
        } else {
           codRow.style.display = 'none';
        }

        ['UPI','Card','Wallet','Netbanking'].forEach(m => {
           const el = widgetRoot.getElementById(`pp${m}`);
           if(el) {
              let mDisc = couponDiscount;
              if (widgetConfig.isPrepaidDiscountEnabled) {
                 mDisc += widgetConfig.prepaidDiscountType === 'percentage' ? (subtotal - couponDiscount) * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
              }
              const finalVal = Math.max(0, subtotal - mDisc) + shippingFee;
              el.innerText = `₹${Number.isInteger(finalVal) ? finalVal : finalVal.toFixed(2)}`;
           }
        });
        const elCod = widgetRoot.getElementById('ppCOD');
        if(elCod) {
           const finalCod = Math.max(0, subtotal - couponDiscount) + shippingFee + codFee;
           elCod.innerText = `₹${Number.isInteger(finalCod) ? finalCod : finalCod.toFixed(2)}`;
        }

        const elCodBtn = widgetRoot.getElementById('cod-confirm-btn');
        if(elCodBtn) {
           const finalCodBtn = Math.max(0, subtotal - couponDiscount) + shippingFee + codFee;
           elCodBtn.innerText = `Confirm COD (₹${Number.isInteger(finalCodBtn) ? finalCodBtn : finalCodBtn.toFixed(2)})`;
        }

        const elOnlineBtn = widgetRoot.getElementById('cod-save-btn');
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
               
               updatePricing();
            }
         }
      };
      // --- PHONE LOGIC ---
      let otpStepActive = false;
      const phoneIn = widgetRoot.getElementById('cf-phone-in');
      const otpIn = widgetRoot.getElementById('cf-otp-in');
      const phoneBtn = widgetRoot.getElementById('cf-phone-btn');
      
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
              widgetRoot.getElementById('cf-otp-box').style.display = 'block';
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
              cfTrack('OTP_VERIFIED');
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
            widgetRoot.getElementById('disp-name').innerText = customerData.name;
            widgetRoot.getElementById('disp-addr').innerText = `${customerData.address}, ${customerData.city}`;
            widgetRoot.getElementById('disp-phone').innerText = verifiedPhone;
            widgetRoot.getElementById('disp-email').innerText = customerData.email || '';
            
            widgetRoot.getElementById('cf-addr-name').value = customerData.name || '';
            widgetRoot.getElementById('cf-addr-email').value = customerData.email || '';
            widgetRoot.getElementById('cf-addr-street').value = customerData.address || '';
            widgetRoot.getElementById('cf-addr-city').value = customerData.city || '';
            widgetRoot.getElementById('cf-addr-state').value = customerData.state || '';
            widgetRoot.getElementById('cf-addr-pin').value = customerData.pincode || '';

            renderPaymentMethods();
            stateCheckout.style.display = 'block';
          } else {
            stateAddress.style.display = 'block';
          }
        } catch(e) { stateAddress.style.display = 'block'; }
      };

      
      widgetRoot.getElementById('cf-addr-pin').addEventListener('keyup', async (e) => {
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

      widgetRoot.getElementById('cf-addr-btn').onclick = () => {
        const name = widgetRoot.getElementById('cf-addr-name').value;
        const email = widgetRoot.getElementById('cf-addr-email').value;
        const addr = widgetRoot.getElementById('cf-addr-street').value;
        const city = widgetRoot.getElementById('cf-addr-city').value;
        if(!name || !addr || !city) return;
        
        widgetRoot.getElementById('disp-name').innerText = name;
        widgetRoot.getElementById('disp-addr').innerText = `${addr}, ${city}`;
        widgetRoot.getElementById('disp-phone').innerText = verifiedPhone;
        widgetRoot.getElementById('disp-email').innerText = email;
        
        stateAddress.style.display = 'none';
        renderPaymentMethods();
        stateCheckout.style.display = 'block';
      };

      widgetRoot.getElementById('cf-edit-addr').onclick = () => {
        stateCheckout.style.display = 'none';
        stateAddress.style.display = 'block';
      };

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
            { id: 'UPI', name: 'Pay via UPI', sub: 'GPay · PhonePe · Paytm · BHIM', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:none;fill:var(--p1);"><path d="M16 11.5v-3h-3v3h-2v-5h7v5h-2zM5.5 13.5h3v-2h-3v2zm0-4h3v-2h-3v2zm9 4h3v-2h-3v2zm-4 0h3v-2h-3v2zm-5 4h5v-2h-5v2zm9 0h3v-2h-3v2zM22 2H2v20h20V2zm-2 18H4V4h16v16z"/></svg>' },
            { id: 'Card', name: 'Debit / Credit Cards', sub: 'Visa · Mastercard · RuPay', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:var(--p1);fill:none;stroke-width:2;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' },
            { id: 'Wallet', name: 'Wallets', sub: 'Paytm · PhonePe · Amazon Pay', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:var(--p1);fill:none;stroke-width:2;"><path d="M20 12V22H4V12"/><path d="M12 22V7M12 7a5 5 0 01-5-5 5 5 0 005 5z"/></svg>' },
            { id: 'Netbanking', name: 'Net Banking', sub: 'All Indian Banks', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:var(--p1);fill:none;stroke-width:2;"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>' },
            { id: 'COD', name: 'Cash on Delivery', sub: (widgetConfig.isCodFeeEnabled !== false && (widgetConfig.codFeeAmount || 0) > 0) ? `Pay ₹${widgetConfig.codFeeAmount} fee` : 'Pay at doorstep', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:#ea580c;fill:none;stroke-width:2;"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>' }
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
                        <button class="cf-btn" onclick="widgetRoot.getElementById('drw${m.id}').style.display='none'; window.cfExecutePayment('UPI')" id="cod-save-btn" style="background:var(--green);">Pay Online (Save)</button>
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
                ? `window.cfUpdatePricing('${m.id}'); widgetRoot.getElementById('drw${m.id}').style.display='flex'`
                : `window.cfUpdatePricing('${m.id}'); window.cfExecutePayment('${m.id}')`;

            html += `
              <div class="pay-card ${m.id==='UPI' ? 'active' : ''}" onclick="${clickAction}">
                ${m.id==='UPI' ? '<div class="recommended-tag"><svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> Recommended</div>' : ''}
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
                    <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
              </div>
            `;
         });
         container.innerHTML = html;
         
         let dynD = widgetRoot.getElementById('dynamic-drawers');
         if(!dynD) { dynD = document.createElement('div'); dynD.id = 'dynamic-drawers'; dContainer.appendChild(dynD); }
         dynD.innerHTML = dHtml;

         updatePricing();
      };

      // --- PAYMENT EXECUTION ---
      window.cfUpdatePricing = updatePricing;
      window.cfExecutePayment = async (method) => {
         const btn = widgetRoot.getElementById(`paybtn-${method}`) || widgetRoot.getElementById('cod-save-btn');
         if (btn) btn.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><svg style="width:18px;height:18px;animation:cf-spin 1s linear infinite;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="31.4" stroke-linecap="round"></circle></svg> Processing...</div>';
         
         let prepaidDiscount = 0;
         let shippingFee = 0;
         let codFee = 0;
         const subtotal = subtotalBase;
         
         if (widgetConfig.isShippingFeeEnabled) {
             const threshold = typeof widgetConfig.freeShippingThreshold === 'number' ? widgetConfig.freeShippingThreshold : 999;
             if (threshold === 0 || subtotal < threshold) {
                 shippingFee = widgetConfig.shippingFeeAmount || 0;
             }
         }
         
         if (method === 'COD') {
            if (widgetConfig.isCodFeeEnabled !== false) {
                codFee = shippingFee > 0 ? 0 : (widgetConfig.codFeeAmount || 0);
            }
         } else if (widgetConfig.isPrepaidDiscountEnabled) {
            prepaidDiscount = widgetConfig.prepaidDiscountType === 'percentage' ? (subtotal - currentCouponDiscount) * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
         }

         const payload = {
            shop, items: cartItems,
            customerName: widgetRoot.getElementById('cf-addr-name').value,
            customerPhone: verifiedPhone,
            customerEmail: widgetRoot.getElementById('cf-addr-email').value,
            address: widgetRoot.getElementById('cf-addr-street').value,
            city: widgetRoot.getElementById('cf-addr-city').value,
            state: widgetRoot.getElementById('cf-addr-state').value,
            pincode: widgetRoot.getElementById('cf-addr-pin').value,
            paymentMethod: method,
            prepaidDiscount,
            shippingFee,
            codFee,
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
                       const drw = widgetRoot.getElementById(`drw${method}`);
                       if (drw) drw.style.display = 'none';
                       widgetRoot.getElementById('state-checkout').style.display='none';
                       widgetRoot.getElementById('successScr').style.display='flex';
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
             const rzpAmount = Math.max(0, subtotal - currentCouponDiscount - prepaidDiscount) + shippingFee;
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

      widgetRoot.getElementById('close-success-btn').onclick = closeWidget;

    },
