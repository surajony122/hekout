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

    open: function(options) {
      const { shop, variantId, quantity, productTitle, productImage, price } = options;
      
      this.trackEvent(shop, 'WIDGET_OPENED');

      // Create overlay
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'flex-end';
      overlay.style.justifyContent = 'center';
      overlay.style.fontFamily = 'sans-serif';
      overlay.id = 'checkoutflow-overlay';

      // Create bottom sheet
      const sheet = document.createElement('div');
      sheet.style.width = '100%';
      sheet.style.maxWidth = '500px';
      sheet.style.backgroundColor = '#fff';
      sheet.style.borderTopLeftRadius = '20px';
      sheet.style.borderTopRightRadius = '20px';
      sheet.style.padding = '24px 20px';
      sheet.style.boxSizing = 'border-box';
      sheet.style.transform = 'translateY(100%)';
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      sheet.style.maxHeight = '90vh';
      sheet.style.overflowY = 'auto';

      const total = parseFloat(price) * parseInt(quantity);
      let currentQuantity = parseInt(quantity) || 1;
      let basePrice = parseFloat(price) || 0;
      let appliedDiscount = null;
      let verifiedPhone = localStorage.getItem('checkoutflow_verified_phone') || '';
      let customerData = null;

      sheet.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
          <h2 id="cf-main-title" style="margin:0; font-size:1.4rem; font-weight:700; color:#111827;">Login to Continue</h2>
          <button id="cf-close" style="background:#f3f4f6; border:none; border-radius:50%; width:32px; height:32px; font-size:1.2rem; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#4b5563; transition:background 0.2s;">&times;</button>
        </div>

        <!-- SCREEN 1: PHONE LOGIN & OTP -->
        <div id="cf-login-screen">
          <div id="cf-phone-step">
            <p style="color:#4b5563; font-size:0.95rem; margin-bottom:16px;">Enter your mobile number to securely checkout.</p>
            <div style="display:flex; gap:10px; margin-bottom:20px;">
              <div style="background:#f3f4f6; padding:16px; border-radius:8px; font-weight:600; color:#374151;">+91</div>
              <input type="tel" id="cf-login-phone" placeholder="10-digit mobile number" style="flex:1; padding:16px; border:2px solid #e5e7eb; border-radius:8px; font-size:1.1rem; outline:none; transition:border 0.2s;" maxlength="10" />
            </div>
            <button type="button" id="cf-send-otp-btn" style="width:100%; padding:16px; background:#10b981; color:#fff; border:none; border-radius:8px; font-size:1.1rem; font-weight:bold; cursor:pointer; opacity:0.5; pointer-events:none; transition:opacity 0.2s;">
              Send OTP
            </button>
            <p id="cf-login-error" style="color:#ef4444; font-size:0.9rem; margin-top:12px; display:none;"></p>
          </div>

          <div id="cf-otp-step" style="display:none;">
            <p style="color:#4b5563; font-size:0.95rem; margin-bottom:20px;">We've sent an activation code to <b id="cf-otp-display-phone"></b>.</p>
            
            <div id="cf-simulator-box" style="display:none; background:#fef3c7; border:1px solid #f59e0b; padding:12px; border-radius:8px; margin-bottom:20px; text-align:left;">
              <span style="font-size:0.8rem; font-weight:bold; color:#b45309; text-transform:uppercase;">SMS Simulator</span><br/>
              <span style="font-size:0.95rem; color:#92400e;">Your verification code is: <b id="cf-simulated-code"></b></span>
            </div>

            <input type="text" id="cf-login-otp" placeholder="Enter 4-digit OTP" style="width:100%; padding:16px; border:2px solid #e5e7eb; border-radius:8px; font-size:1.2rem; text-align:center; letter-spacing:8px; margin-bottom:20px; outline:none;" maxlength="4" />
            
            <button type="button" id="cf-verify-otp-btn" style="width:100%; padding:16px; background:#10b981; color:#fff; border:none; border-radius:8px; font-size:1.1rem; font-weight:bold; cursor:pointer; opacity:0.5; pointer-events:none; transition:opacity 0.2s;">
              Verify & Proceed
            </button>
            <p id="cf-otp-error" style="color:#ef4444; font-size:0.9rem; margin-top:12px; display:none;"></p>
          </div>
        </div>

        <!-- SCREEN 2: CHECKOUT & ADDRESS (Hidden initially) -->
        <div id="cf-checkout-screen" style="display:none;">
          <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; margin-bottom:24px; overflow:hidden;">
            <!-- Accordion Header -->
            <div id="cf-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px; cursor:pointer; background:#f9fafb;">
              <div style="display:flex; align-items:center; gap:8px;">
                <svg width="20" height="20" fill="none" stroke="#374151" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                <span style="font-weight:600; color:#374151; font-size:1rem;">Order summary</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; color:#4b5563; font-size:0.9rem;">
                <span id="cf-summary-qty-header">${quantity} item</span>
                <svg id="cf-accordion-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="transition: transform 0.2s;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            
            <div id="cf-savings-banner" style="display:none; background:#dcfce7; color:#166534; padding:8px 16px; font-size:0.95rem; font-weight:500; text-align:center; border-top:1px solid #bbf7d0; border-bottom:1px solid #bbf7d0;">
              Yay! You've saved <span id="cf-savings-amount" style="font-weight:700;">₹0</span> so far 🥳
            </div>

            <!-- Accordion Body -->
            <div id="cf-accordion-body" style="padding:16px; display:none;">
              <div style="display:flex; gap:16px; align-items:flex-start;">
                ${productImage ? `<img src="${productImage}" style="width:80px; height:80px; border-radius:8px; object-fit:cover; border:1px solid #e5e7eb;" />` : `<div style="width:80px; height:80px; border-radius:8px; background:#e5e7eb; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:24px;">🛍️</div>`}
                <div style="flex:1;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div style="font-weight:500; font-size:0.95rem; color:#111827; line-height:1.4; padding-right:12px;">${productTitle || 'Product'}</div>
                    <div style="font-weight:700; font-size:1rem; color:#111827;" id="cf-item-total">₹${total.toLocaleString('en-IN')}</div>
                  </div>
                  
                  <div style="display:flex; align-items:center; gap:16px; margin-top:12px;">
                    <button type="button" id="cf-delete-item" style="background:none; border:1px solid #d1d5db; border-radius:6px; padding:6px; cursor:pointer; color:#ef4444; display:flex; align-items:center; justify-content:center; transition: background 0.2s;">
                      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <div style="display:flex; align-items:center; border:1px solid #d1d5db; border-radius:6px; overflow:hidden;">
                      <button type="button" id="cf-qty-minus" style="background:#f9fafb; border:none; border-right:1px solid #d1d5db; padding:6px 14px; cursor:pointer; font-size:1.1rem; color:#374151; display:flex; align-items:center; justify-content:center;">-</button>
                      <div id="cf-qty-display" style="padding:6px 16px; font-size:0.95rem; font-weight:600; color:#111827;">${quantity}</div>
                      <button type="button" id="cf-qty-plus" style="background:#f9fafb; border:none; border-left:1px solid #d1d5db; padding:6px 14px; cursor:pointer; font-size:1.1rem; color:#374151; display:flex; align-items:center; justify-content:center;">+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:24px;">
            <div style="display:flex; gap:8px;">
              <input type="text" id="cf-discount" placeholder="Enter coupon code" style="flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:0.9rem; outline:none;" />
              <button type="button" id="cf-apply-discount" style="background:#374151; color:white; border:none; border-radius:8px; padding:0 16px; font-size:0.9rem; font-weight:500; cursor:pointer;">Apply</button>
            </div>
            <div id="cf-discount-msg" style="color:#059669; font-size:0.8rem; margin-top:8px; display:none;">Discount code recorded.</div>
          </div>

          <form id="cf-checkout-form">
            <div style="margin-bottom:20px;">
              <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Shipping Address</h3>
              <div style="display:flex; flex-direction:column; gap:12px;">
                <input type="text" id="cf-name" placeholder="Full Name" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
                <input type="email" id="cf-email" placeholder="Email Address (Optional)" style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
                <input type="text" id="cf-address" placeholder="Street Address" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
                <div style="display:flex; gap:12px;">
                  <input type="text" id="cf-city" placeholder="City" required style="width:50%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
                  <input type="text" id="cf-state" placeholder="State" required style="width:50%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
                </div>
                <input type="text" id="cf-pincode" placeholder="Pincode" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
              </div>
            </div>

            <div style="margin-bottom:24px;">
              <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Order Summary</h3>
              <div style="background:#f9fafb; border:1px solid #d1d5db; border-radius:8px; padding:16px; font-size:0.95rem; color:#374151;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                  <span>Subtotal</span>
                  <span id="cf-summary-subtotal" style="font-weight:600;">₹${total.toLocaleString('en-IN')}</span>
                </div>
                <div id="cf-summary-discount-row" style="display:none; justify-content:space-between; margin-bottom:8px; color:#059669;">
                  <span>Coupon discount (<span id="cf-summary-discount-code"></span>)</span>
                  <span id="cf-summary-discount-value" style="font-weight:600;">-₹0</span>
                </div>
                <div id="cf-summary-freebie-row" style="display:none; justify-content:space-between; margin-bottom:8px; color:#059669;">
                  <span>Free Gift</span>
                  <span id="cf-summary-freebie-name" style="font-weight:600;"></span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                  <span>Shipping</span>
                  <span style="font-weight:600; color:#059669;">Free</span>
                </div>
                <div style="border-top:1px solid #d1d5db; margin:12px 0;"></div>
                <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; color:#111827;">
                  <span>Total</span>
                  <span id="cf-summary-total">₹${total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div id="cf-payment-methods-container" style="margin-bottom:24px;">
              <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Payment Method</h3>
              <div id="cf-payment-options" style="border:1px solid #d1d5db; border-radius:12px; overflow:hidden; background:#fff;">
                <div style="padding:20px; text-align:center; color:#6b7280;">Loading payment options...</div>
              </div>
            </div>

            <button type="submit" id="cf-submit-order" style="width:100%; padding:16px; background:#10b981; color:#fff; border:none; border-radius:8px; font-size:1.1rem; font-weight:bold; cursor:pointer; transition: opacity 0.2s; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
              Complete Order &bull; ₹${total.toLocaleString('en-IN')}
            </button>
          </form>
        </div>
      `;

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);

      // Animate up
      setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 10);

      const closeWidget = () => {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => overlay.remove(), 300);
      };
      document.getElementById('cf-close').onclick = closeWidget;
      overlay.onclick = (e) => { if(e.target === overlay) closeWidget(); };

      const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
      let widgetConfig = { isPrepaidDiscountEnabled: false, prepaidDiscountType: 'percentage', prepaidDiscountValue: 0, isPartialCodEnabled: false, partialCodAmount: 0, hasRazorpay: false };
      
      // Load Razorpay script
      const rzpScript = document.createElement('script');
      rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.head.appendChild(rzpScript);

      // ======== SCREEN 1 LOGIC ========
      const phoneInput = document.getElementById('cf-login-phone');
      const sendOtpBtn = document.getElementById('cf-send-otp-btn');
      const otpInput = document.getElementById('cf-login-otp');
      const verifyOtpBtn = document.getElementById('cf-verify-otp-btn');
      const loginError = document.getElementById('cf-login-error');
      const otpError = document.getElementById('cf-otp-error');

      phoneInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val.length === 10) {
          sendOtpBtn.style.opacity = '1';
          sendOtpBtn.style.pointerEvents = 'auto';
        } else {
          sendOtpBtn.style.opacity = '0.5';
          sendOtpBtn.style.pointerEvents = 'none';
        }
      });

      otpInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val.length === 4) {
          verifyOtpBtn.style.opacity = '1';
          verifyOtpBtn.style.pointerEvents = 'auto';
        } else {
          verifyOtpBtn.style.opacity = '0.5';
          verifyOtpBtn.style.pointerEvents = 'none';
        }
      });

      sendOtpBtn.onclick = async () => {
        const phone = phoneInput.value;
        sendOtpBtn.innerText = 'Sending...';
        sendOtpBtn.style.opacity = '0.7';
        loginError.style.display = 'none';

        try {
          window.CheckoutFlow.trackEvent(shop, 'PHONE_ENTERED');

          const res = await fetch(`${apiBaseUrl}/api/otp/send`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, phone })
          });
          const data = await res.json();
          
          if (data.success) {
            verifiedPhone = phone;
            document.getElementById('cf-phone-step').style.display = 'none';
            document.getElementById('cf-otp-step').style.display = 'block';
            document.getElementById('cf-otp-display-phone').innerText = phone;
            if (data.simulatedCode) {
              document.getElementById('cf-simulated-code').innerText = data.simulatedCode;
              document.getElementById('cf-simulator-box').style.display = 'block';
            } else {
              const simBox = document.getElementById('cf-simulator-box');
              if (simBox) simBox.style.display = 'none';
            }
          } else {
            loginError.innerText = data.error || 'Failed to send OTP';
            loginError.style.display = 'block';
            sendOtpBtn.innerText = 'Send OTP';
            sendOtpBtn.style.opacity = '1';
          }
        } catch(err) {
          loginError.innerText = 'Network error. Try again.';
          loginError.style.display = 'block';
          sendOtpBtn.innerText = 'Send OTP';
          sendOtpBtn.style.opacity = '1';
        }
      };

      verifyOtpBtn.onclick = async () => {
        const code = otpInput.value;
        verifyOtpBtn.innerText = 'Verifying...';
        verifyOtpBtn.style.opacity = '0.7';
        otpError.style.display = 'none';

        try {
          const res = await fetch(`${apiBaseUrl}/api/otp/verify`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, phone: verifiedPhone, code })
          });
          const data = await res.json();
          
          if (data.success || data.valid) {
            window.CheckoutFlow.trackEvent(shop, 'OTP_VERIFIED');
            localStorage.setItem('checkoutflow_verified_phone', verifiedPhone);
            goToCheckoutScreen();
          } else {
            otpError.innerText = data.error || 'Invalid OTP';
            otpError.style.display = 'block';
            verifyOtpBtn.innerText = 'Verify & Proceed';
            verifyOtpBtn.style.opacity = '1';
          }
        } catch(err) {
          otpError.innerText = 'Network error. Try again.';
          otpError.style.display = 'block';
          verifyOtpBtn.innerText = 'Verify & Proceed';
          verifyOtpBtn.style.opacity = '1';
        }
      };

      const goToCheckoutScreen = async () => {
        // Transition to Checkout Screen
        document.getElementById('cf-login-screen').style.display = 'none';
        document.getElementById('cf-main-title').innerText = 'Express Checkout';
        document.getElementById('cf-checkout-screen').style.display = 'block';
        
        // Add logout banner
        let phoneBanner = document.getElementById('cf-phone-banner');
        if (!phoneBanner) {
          phoneBanner = document.createElement('div');
          phoneBanner.id = 'cf-phone-banner';
          phoneBanner.style.cssText = "background:#f3f4f6; padding:12px 16px; margin-bottom:16px; border-radius:8px; font-size:0.95rem; color:#4b5563; display:flex; justify-content:space-between; align-items:center;";
          phoneBanner.innerHTML = `<span>Verified: <b>${verifiedPhone}</b></span> <button type="button" id="cf-logout-btn" style="background:none; border:none; color:#ef4444; font-weight:600; cursor:pointer;">Change</button>`;
          
          const checkoutScreen = document.getElementById('cf-checkout-screen');
          checkoutScreen.insertBefore(phoneBanner, checkoutScreen.firstChild);
          
          document.getElementById('cf-logout-btn').onclick = () => {
            localStorage.removeItem('checkoutflow_verified_phone');
            verifiedPhone = '';
            phoneBanner.remove();
            document.getElementById('cf-checkout-screen').style.display = 'none';
            document.getElementById('cf-main-title').innerText = 'Login to Continue';
            document.getElementById('cf-login-screen').style.display = 'block';
            document.getElementById('cf-phone-step').style.display = 'block';
            document.getElementById('cf-otp-step').style.display = 'none';
            document.getElementById('cf-login-phone').value = '';
            document.getElementById('cf-send-otp-btn').style.opacity = '0.5';
            document.getElementById('cf-send-otp-btn').style.pointerEvents = 'none';
          };
        }

        // Check for customer data
        try {
          const lookupRes = await fetch(`${apiBaseUrl}/api/customer/lookup?shop=${shop}&phone=${verifiedPhone}`);
          const lookupData = await lookupRes.json();
          if (lookupData.success && lookupData.customer) {
            customerData = lookupData.customer;
            document.getElementById('cf-name').value = customerData.name || '';
            document.getElementById('cf-email').value = customerData.email || '';
            document.getElementById('cf-address').value = customerData.address || '';
            document.getElementById('cf-city').value = customerData.city || '';
            document.getElementById('cf-state').value = customerData.state || '';
            document.getElementById('cf-pincode').value = customerData.pincode || '';
            
            // Toast
            const toast = document.createElement('div');
            toast.innerText = `Welcome back${customerData.name ? ', ' + customerData.name.split(' ')[0] : ''}!`;
            toast.style.cssText = 'position:absolute; top:20px; left:50%; transform:translateX(-50%); background:#10b981; color:#fff; padding:8px 16px; border-radius:20px; font-size:0.9rem; font-weight:500; z-index:999999; opacity:0; transition:opacity 0.3s; box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            sheet.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '1'; }, 10);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
          }
        } catch(e) {}

        // Check for auto-discounts
        try {
          const dRes = await fetch(`${apiBaseUrl}/api/discounts/auto?shop=${shop}`);
          const d = await dRes.json();
          if (d.success && d.discount) {
            document.getElementById('cf-discount').value = d.discount.code;
            applyDiscountToState({ valid: true, ...d.discount }, d.discount.code);
            const msgEl = document.getElementById('cf-discount-msg');
            msgEl.innerText = `Auto-applied discount: ${d.discount.code}`;
            msgEl.style.color = '#059669';
            msgEl.style.display = 'block';
          }
        } catch(e) {}
      };

      if (verifiedPhone) {
        goToCheckoutScreen();
      }

      // ======== SCREEN 2 LOGIC ========
      
      const renderPaymentOptions = () => {
        const container = document.getElementById('cf-payment-options');
        if (!container) return;
        
        let html = '';
        
        // Helper to format discount tag
        const getDiscountTag = () => {
          if (!widgetConfig.isPrepaidDiscountEnabled) return '';
          const txt = widgetConfig.prepaidDiscountType === 'percentage' ? `${widgetConfig.prepaidDiscountValue}%` : `₹${widgetConfig.prepaidDiscountValue}`;
          return `<span style="display:inline-block; margin-left:8px; background:#ecfdf5; color:#059669; font-size:0.75rem; font-weight:600; padding:2px 6px; border-radius:4px;">% Get ${txt} off</span>`;
        };

        const renderOption = (val, title, subtitle, iconHtml, isFirst, isPrepaid) => {
          return `
            <label style="display:flex; align-items:center; justify-content:space-between; padding:16px; cursor:pointer; border-bottom:${isFirst ? '1px solid #e5e7eb' : '1px solid #e5e7eb'}; background:#fff; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:36px; height:36px; border-radius:8px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; background:#f8fafc;">
                  ${iconHtml}
                </div>
                <div>
                  <div style="display:flex; align-items:center;">
                    <span style="font-weight:600; color:#1f2937; font-size:0.95rem;">${title}</span>
                  </div>
                  <div style="color:#6b7280; font-size:0.8rem; margin-top:2px;">
                    ${subtitle}
                    ${isPrepaid ? getDiscountTag() : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span id="cf-price-${val}" style="font-weight:600; color:#374151; font-size:0.95rem;"></span>
                <input type="radio" name="payment" value="${val}" ${val==='UPI' ? 'checked' : ''} onchange="window.cfUpdatePricing()" style="width:18px; height:18px; accent-color:#10b981;" />
              </div>
            </label>
          `;
        };

        const icons = {
          upi: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
          card: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
          wallet: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-8H6a2 2 0 0 0-2 2z"/></svg>`,
          net: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
          cod: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>`
        };

        if (widgetConfig.hasRazorpay) {
          html += renderOption('UPI', 'Pay via UPI', 'Google Pay, PhonePe & more', icons.upi, true, true);
          html += renderOption('Card', 'Debit/Credit cards', 'Visa, Mastercard, RuPay', icons.card, false, true);
          html += renderOption('Wallet', 'Wallets', 'Paytm, PhonePe', icons.wallet, false, true);
          html += renderOption('Netbanking', 'Netbanking', 'Select from all banks', icons.net, false, true);
        }
        
        if (widgetConfig.isPartialCodEnabled) {
          html += renderOption('PartialCOD', 'Partial COD', `Pay ₹${widgetConfig.partialCodAmount} now, rest on delivery`, icons.cod, false, false);
        }
        
        html += renderOption('COD', 'Cash on Delivery', 'Pay when you receive', icons.cod, false, false);
        
        container.innerHTML = html;
        if (!widgetConfig.hasRazorpay) {
          document.querySelector('input[name="payment"][value="COD"]').checked = true;
        }
        window.cfUpdatePricing();
      };
      
      // Global hook for radio buttons
      window.cfUpdatePricing = () => { if(typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing(); };

      // Fetch config earlier (we moved it here)
      fetch(`${apiBaseUrl}/api/widget/config?shop=${shop}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            widgetConfig = data.config;
            renderPaymentOptions();
          }
        });

      const updatePricingUI = () => {
        const subtotal = basePrice * currentQuantity;
        let discountAmount = 0;

        if (appliedDiscount) {
          if (appliedDiscount.type === 'percentage') {
            discountAmount = subtotal * (appliedDiscount.value / 100);
          } else if (appliedDiscount.type === 'fixed_amount') {
            discountAmount = appliedDiscount.value;
          }
        }

        
        const selectedPaymentEl = document.querySelector('input[name="payment"]:checked');
        const selectedPayment = selectedPaymentEl ? selectedPaymentEl.value : 'COD';
        let prepaidDiscount = 0;
        
        if (widgetConfig.isPrepaidDiscountEnabled && ['UPI', 'Card', 'Wallet', 'Netbanking'].includes(selectedPayment)) {
          if (widgetConfig.prepaidDiscountType === 'percentage') {
             prepaidDiscount = subtotal * (widgetConfig.prepaidDiscountValue / 100);
          } else {
             prepaidDiscount = widgetConfig.prepaidDiscountValue;
          }
        }
        
        const finalTotal = Math.max(0, subtotal - discountAmount - prepaidDiscount);
        
        // Update per-payment-option prices
        const radios = document.querySelectorAll('input[name="payment"]');
        radios.forEach(radio => {
          const val = radio.value;
          const priceEl = document.getElementById(`cf-price-${val}`);
          if (!priceEl) return;
          
          if (['UPI', 'Card', 'Wallet', 'Netbanking'].includes(val) && widgetConfig.isPrepaidDiscountEnabled) {
            let pd = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
            priceEl.innerText = `₹${Math.max(0, subtotal - discountAmount - pd).toLocaleString('en-IN')}`;
          } else if (val === 'PartialCOD') {
            priceEl.innerText = `₹${widgetConfig.partialCodAmount}`;
          } else {
            priceEl.innerText = `₹${Math.max(0, subtotal - discountAmount).toLocaleString('en-IN')}`;
          }
        });


        // Update Item Accordion
        document.getElementById('cf-item-total').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('cf-qty-display').innerText = currentQuantity;
        document.getElementById('cf-summary-qty-header').innerText = `${currentQuantity} item${currentQuantity !== 1 ? 's' : ''}`;

        // Update Order Summary Box
        document.getElementById('cf-summary-subtotal').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        
        let totalSavings = discountAmount + prepaidDiscount;
        
        if (totalSavings > 0) {
          // Check if discount row exists, if not we reuse the existing one or just display the total savings banner
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = `₹${totalSavings.toLocaleString('en-IN')}`;
          
          if (document.getElementById('cf-summary-discount-value')) {
             document.getElementById('cf-summary-discount-value').innerText = `-₹${totalSavings.toLocaleString('en-IN')}`;
          }
        } else if (appliedDiscount && appliedDiscount.type === 'freebie_product') {
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = 'a Free Gift';
        } else {
          document.getElementById('cf-savings-banner').style.display = 'none';
          if (document.getElementById('cf-summary-discount-value')) {
             document.getElementById('cf-summary-discount-value').innerText = `-₹0`;
          }
        }
        
        document.getElementById('cf-summary-total').innerText = `₹${finalTotal.toLocaleString('en-IN')}`;
        document.getElementById('cf-submit-order').innerHTML = `Complete Order &bull; ₹${finalTotal.toLocaleString('en-IN')}`;
      };

      window.internalUpdatePricing = updatePricingUI;

      // Accordion Toggle
      const accHeader = document.getElementById('cf-accordion-header');
      const accBody = document.getElementById('cf-accordion-body');
      const accIcon = document.getElementById('cf-accordion-icon');
      let isAccOpen = false;
      accHeader.onclick = () => {
        isAccOpen = !isAccOpen;
        accBody.style.display = isAccOpen ? 'block' : 'none';
        accIcon.style.transform = isAccOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      };

      document.getElementById('cf-qty-plus').onclick = () => { currentQuantity++; updatePricingUI(); };
      document.getElementById('cf-qty-minus').onclick = () => { if (currentQuantity > 1) { currentQuantity--; updatePricingUI(); } };
      document.getElementById('cf-delete-item').onclick = () => { if (confirm('Remove item from cart?')) closeWidget(); };

      const applyDiscountToState = (data, code) => {
        if (data.type === 'freebie_product') {
          appliedDiscount = { code, type: data.type, value: 0, freebieName: data.freebieName };
          document.getElementById('cf-summary-discount-row').style.display = 'none';
          document.getElementById('cf-summary-freebie-name').innerText = data.freebieName;
          document.getElementById('cf-summary-freebie-row').style.display = 'flex';
        } else {
          appliedDiscount = { code, type: data.type, value: data.value };
          document.getElementById('cf-summary-freebie-row').style.display = 'none';
          document.getElementById('cf-summary-discount-code').innerText = code;
          document.getElementById('cf-summary-discount-row').style.display = 'flex';
        }
        updatePricingUI();
      };

      document.getElementById('cf-apply-discount').onclick = async () => {
        const code = document.getElementById('cf-discount').value.trim();
        const msgEl = document.getElementById('cf-discount-msg');
        const btn = document.getElementById('cf-apply-discount');
        if (!code) return;

        btn.innerText = '...';
        btn.disabled = true;
        msgEl.style.display = 'none';
        msgEl.style.color = '#059669';

        try {
          const res = await fetch(`${apiBaseUrl}/api/validate-discount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop, code })
          });
          const data = await res.json();
          if (data.valid) {
            applyDiscountToState(data, code);
            msgEl.innerText = `Discount applied successfully!`;
            msgEl.style.color = '#059669';
            msgEl.style.display = 'block';
          } else {
            appliedDiscount = null;
            document.getElementById('cf-summary-discount-row').style.display = 'none';
            document.getElementById('cf-summary-freebie-row').style.display = 'none';
            updatePricingUI();
            msgEl.innerText = data.error || 'Invalid discount code';
            msgEl.style.color = '#dc2626';
            msgEl.style.display = 'block';
          }
        } catch (err) {
          msgEl.innerText = 'Failed to validate code. Try again.';
          msgEl.style.color = '#dc2626';
          msgEl.style.display = 'block';
        }
        btn.innerText = 'Apply';
        btn.disabled = false;
      };

      // Final Order Submit
      document.getElementById('cf-checkout-form').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('cf-submit-order');
        submitBtn.innerText = 'Processing...';
        submitBtn.style.opacity = '0.7';
        submitBtn.disabled = true;

                const subtotal = basePrice * currentQuantity;
        let prepaidDiscount = 0;
        if (widgetConfig && widgetConfig.isPrepaidDiscountEnabled && isPrepaid) {
          if (widgetConfig.prepaidDiscountType === 'percentage') {
             prepaidDiscount = subtotal * (widgetConfig.prepaidDiscountValue / 100);
          } else {
             prepaidDiscount = widgetConfig.prepaidDiscountValue;
          }
        }
        
        const payload = {
          shop,
          variantId,
          quantity: currentQuantity,
          productTitle,
          price,
          customerName: document.getElementById('cf-name').value,
          customerPhone: verifiedPhone,
          customerEmail: document.getElementById('cf-email').value,
          address: document.getElementById('cf-address').value,
          city: document.getElementById('cf-city').value,
          state: document.getElementById('cf-state').value,
          pincode: document.getElementById('cf-pincode').value,
          paymentMethod: document.querySelector('input[name="payment"]:checked').value,
          appliedDiscount: appliedDiscount,
          prepaidDiscount: prepaidDiscount
        };

        try {
          const res = await fetch(`${apiBaseUrl}/api/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const data = await res.json();
          if (data.success) {
            window.CheckoutFlow.trackEvent(shop, 'ORDER_COMPLETED');
            submitBtn.innerText = 'Redirecting...';
            if (data.orderStatusUrl) {
              window.location.href = data.orderStatusUrl;
            } else {
              sheet.innerHTML = `
                <div style="text-align:center; padding: 40px 20px;">
                  <div style="font-size:3rem; color:#10b981; margin-bottom:20px;">✓</div>
                  <h2 style="margin:0 0 10px 0; color:#111;">Order Confirmed!</h2>
                  <p style="color:#666;">Your order has been placed successfully.</p>
                  <button onclick="document.getElementById('checkoutflow-overlay').remove()" style="margin-top:20px; padding:10px 20px; background:#000; color:#fff; border:none; border-radius:8px; cursor:pointer;">Close</button>
                </div>
              `;
            }
          } else {
            alert('Failed to place order: ' + (data.error || 'Unknown error'));
            updatePricingUI();
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        } catch(err) {
          alert('Network error. Please try again.');
          updatePricingUI();
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
      };
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
