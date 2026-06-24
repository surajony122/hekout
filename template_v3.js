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
          /*__CSS__*/
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
            
            <!-- ORDER SUMMARY -->
            <div class="card">
              <div class="summary-hdr" id="sumHdr">
                <svg class="icon" viewBox="0 0 24 24" style="stroke:var(--p2);"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                <span class="summary-hdr-text">Order summary</span>
                <div class="summary-hdr-right">
                  <span id="itemLbl">₹${total.toLocaleString('en-IN')} (${currentQuantity} item)</span>
                  <svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
              <div class="summary-body" id="sumBody">
                <div class="oi" id="oi1">
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
                <div class="totals-box">
                  <div class="tr"><span class="l">Subtotal</span><span class="v" id="tSub">₹${total.toLocaleString('en-IN')}</span></div>
                  <div class="tr discount" id="trDisc" style="display:none;"><span class="l">Discount</span><span class="v" id="tDisc">-₹0</span></div>
                  <div class="tr" id="trCod" style="display:none;"><span class="l">COD Fee</span><span class="v" id="tCodFee">₹${widgetConfig.codFeeAmount}</span></div>
                  <div class="tr free-sh"><span class="l">Shipping</span><span class="v">FREE</span></div>
                  <hr class="tr-div">
                  <div class="tr grand"><span class="l">Total</span><span class="v" id="tGrand">₹${total.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
            </div>

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
        <div id="drawers-container"></div>
        
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
      /*__JS__*/

      // --- STATE MANAGEMENT ---
      const statePhone = document.getElementById('state-phone');
      const stateAddress = document.getElementById('state-address');
      const stateCheckout = document.getElementById('state-checkout');
      const sumHdr = document.getElementById('sumHdr');
      const sumBody = document.getElementById('sumBody');
      
      sumHdr.onclick = () => {
         const open = sumBody.classList.toggle('show');
         sumHdr.classList.toggle('open', open);
      };

      // --- DYNAMIC PRICING ---
      let currentPaymentMethod = null;
      
      const updatePricing = (method = null) => {
        if (method) currentPaymentMethod = method;
        
        const subtotal = basePrice * currentQuantity;
        let discount = 0;
        let codFee = 0;
        
        if (currentPaymentMethod === 'COD') {
           codFee = widgetConfig.codFeeAmount || 0;
        } else if (currentPaymentMethod !== null && widgetConfig.isPrepaidDiscountEnabled) {
           discount = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
        }
        
        const grandTotal = Math.max(0, subtotal - discount) + codFee;

        document.getElementById('hFinal').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        document.getElementById('tSub').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('tGrand').innerText = `₹${grandTotal.toLocaleString('en-IN')}`;
        document.getElementById('itemLbl').innerText = `₹${grandTotal.toLocaleString('en-IN')} (${currentQuantity} item${currentQuantity>1?'s':''})`;
        document.getElementById('q1').innerText = currentQuantity;
        document.getElementById('p1').innerText = `₹${subtotal.toLocaleString('en-IN')}`;

        const discRow = document.getElementById('trDisc');
        if (discount > 0) {
           discRow.style.display = 'flex';
           document.getElementById('tDisc').innerText = `-₹${discount.toLocaleString('en-IN')}`;
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

        // Update drawer prices
        ['UPI','Card','Wallet','Netbanking'].forEach(m => {
           const el = document.getElementById(`pp${m}`);
           if(el) {
              let mDisc = 0;
              if (widgetConfig.isPrepaidDiscountEnabled) {
                 mDisc = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
              }
              el.innerText = `₹${Math.max(0, subtotal - mDisc).toLocaleString('en-IN')}`;
           }
        });
        
        const elCod = document.getElementById('ppCOD');
        if(elCod) elCod.innerText = `₹${(subtotal + (widgetConfig.codFeeAmount || 0)).toLocaleString('en-IN')}`;

        const elCodBtn = document.getElementById('cod-confirm-btn');
        if(elCodBtn) elCodBtn.innerText = `Confirm COD (₹${(subtotal + codFee).toLocaleString('en-IN')})`;

        const elOnlineBtn = document.getElementById('cod-save-btn');
        if(elOnlineBtn) {
            let mDisc = 0;
            if (widgetConfig.isPrepaidDiscountEnabled) {
               mDisc = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
            }
            if (mDisc > 0) {
                elOnlineBtn.innerText = `Pay Online (Save ₹${mDisc.toLocaleString('en-IN')})`;
            } else {
                elOnlineBtn.innerText = `Pay Online`;
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
         dContainer.innerHTML = dHtml;
         updatePricing();
      };

      // --- PAYMENT EXECUTION ---
      window.cfUpdatePricing = updatePricing;
      window.cfExecutePayment = async (method) => {
         const btn = document.getElementById(`paybtn-${method}`);
         btn.innerText = 'Processing...';
         
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
            prepaidDiscount
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
                   btn.innerText = 'Failed';
                   alert("Failed to create order: " + (data.error || 'Unknown error'));
                }
             } catch(e) {
                btn.innerText = 'Error';
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
               btn.innerText = `Pay ${method}`;
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
                 btn.innerText = 'Verifying...';
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
                   btn.innerText = `Pay ${method}`;
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
               btn.innerText = `Pay ${method}`;
             });
             rzp.open();
             
           } catch(e) {
             alert('Error initiating payment.');
             btn.innerText = `Pay ${method}`;
           }
         } else {
            await createFinalOrder();
         }
      };

      document.getElementById('close-success-btn').onclick = closeWidget;

    },
