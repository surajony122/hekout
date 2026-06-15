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

      // Fetch config immediately to apply branding and banners
      const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
      let widgetConfig = { 
        isPrepaidDiscountEnabled: false, prepaidDiscountType: 'percentage', prepaidDiscountValue: 0, 
        isPartialCodEnabled: false, partialCodAmount: 0, hasRazorpay: false,
        primaryColor: '#111827',
        preLoginBannerText: '🎉 FREE SHIPPING ON ALL ORDERS TODAY!', preLoginBannerBg: '#000000', preLoginBannerColor: '#ffffff',
        postLoginBannerText: '⚡ EXTRA 2% OFF ON UPI/CARDS', postLoginBannerBg: '#ecfdf5', postLoginBannerColor: '#059669'
      };

      try {
        const configRes = await fetch(`${apiBaseUrl}/api/widget/config?shop=${shop}`);
        const configData = await configRes.json();
        if (configData.success) widgetConfig = configData.config;
      } catch (e) {}

      const primaryColor = widgetConfig.primaryColor || '#111827';

      const overlay = document.createElement('div');
      overlay.id = 'checkoutflow-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'flex-end';
      overlay.style.justifyContent = 'center';

      const sheet = document.createElement('div');
      sheet.id = 'checkoutflow-sheet';
      sheet.style.width = '100%';
      sheet.style.maxWidth = '480px';
      sheet.style.height = '85vh';
      sheet.style.backgroundColor = '#f9fafb';
      sheet.style.borderTopLeftRadius = '24px';
      sheet.style.borderTopRightRadius = '24px';
      sheet.style.boxShadow = '0 -10px 40px rgba(0,0,0,0.2)';
      sheet.style.transform = 'translateY(100%)';
      sheet.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      sheet.style.overflow = 'hidden';
      sheet.style.display = 'flex';
      sheet.style.flexDirection = 'column';

      let currentQuantity = quantity;
      let basePrice = price;
      let total = basePrice * currentQuantity;
      let appliedDiscount = null;
      let verifiedPhone = localStorage.getItem('checkoutflow_verified_phone') || '';
      let customerData = null;

      // Extract Product Image Fallback
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

      sheet.innerHTML = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          #cf-sheet * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
          .cf-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
          .cf-input { width: 100%; padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; font-size: 1rem; outline: none; transition: all 0.2s; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); }
          .cf-input:focus { border-color: ${primaryColor}; box-shadow: 0 0 0 1px ${primaryColor}; }
          .cf-btn-primary { width: 100%; padding: 18px; background: ${primaryColor}; color: #fff; border: none; border-radius: 14px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .cf-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
          .cf-badge { color: #6b7280; font-size: 0.7rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight:500; }
          .cf-payment-option-label:hover { background: #f9fafb !important; }
        </style>
        
        <div id="cf-sheet" style="display:flex; flex-direction:column; height:100%;">
          <!-- Header -->
          <div style="background:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-top-left-radius:24px; border-top-right-radius:24px; border-bottom:1px solid #f3f4f6;">
            <button id="cf-close" style="background:none; border:none; cursor:pointer; padding:0; display:flex;">
              <i class="ph ph-arrow-left" style="font-size: 26px; color: #374151;"></i>
            </button>
            <div style="border: 1px solid #e5e7eb; padding:6px 12px; border-radius:8px; font-weight:700; font-size:0.8rem; letter-spacing:1px; color:#111; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
              ${(widgetConfig.storeName || shop.split('.')[0]).substring(0,3).toUpperCase()}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700; font-size:1.1rem; color:#111;" id="cf-header-total">₹${total}</div>
            </div>
          </div>

          <!-- Dynamic Banner -->
          <div id="cf-promo-banner" style="background:${widgetConfig.preLoginBannerBg}; color:${widgetConfig.preLoginBannerColor}; text-align:center; padding:10px; font-size:0.85rem; font-weight:700; letter-spacing:0.5px;">
            ${widgetConfig.preLoginBannerText}
          </div>

          <!-- Main Scrollable Area -->
          <div style="flex:1; overflow-y:auto; padding:20px; background:#f9fafb;">
            
            <!-- Order Summary Accordion -->
            <div class="cf-card" style="margin-bottom: 16px;">
              <div id="cf-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <i class="ph ph-shopping-cart" style="font-size: 22px; color: #4b5563;"></i>
                  <span style="font-weight:600; color:#1f2937; font-size:1rem;">Order summary</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; color:#6b7280; font-size:0.9rem; font-weight:500;">
                  <span id="cf-summary-qty-header">${quantity} item</span>
                  <i id="cf-accordion-icon" class="ph ph-caret-down" style="font-size: 18px; transition: transform 0.2s;"></i>
                </div>
              </div>

              <!-- Expanded Details -->
              <div id="cf-accordion-body" style="padding:0 20px 20px 20px; display:none; border-top:1px solid #f3f4f6;">
                <div style="display:flex; gap:16px; align-items:flex-start; margin-top:20px;">
                  ${finalProductImage ? `<img src="${finalProductImage}" style="width:72px; height:72px; border-radius:10px; object-fit:cover; border:1px solid #e5e7eb;" />` : `<div style="width:72px; height:72px; border-radius:10px; background:#e5e7eb; display:flex; align-items:center; justify-content:center;"><i class="ph ph-image" style="color:#9ca3af; font-size:24px;"></i></div>`}
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                      <div style="font-size:0.95rem; color:#111827; font-weight:500; padding-right:12px; line-height:1.4;">${productTitle || 'Product'}</div>
                      <div style="text-align:right;">
                        <div style="font-weight:700; font-size:1rem; color:#111827;" id="cf-item-total">₹${total}</div>
                      </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:12px; margin-top:12px;">
                      <button type="button" id="cf-delete-item" style="background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px; cursor:pointer; color:#9ca3af; display:flex; transition:all 0.2s;">
                        <i class="ph ph-trash" style="font-size: 18px;"></i>
                      </button>
                      <div style="display:flex; align-items:center; border:1px solid #e5e7eb; border-radius:24px; overflow:hidden;">
                        <button type="button" id="cf-qty-minus" style="background:#fff; border:none; padding:4px 12px; cursor:pointer; font-size:1.2rem; font-weight:500; color:#6b7280;">-</button>
                        <div id="cf-qty-display" style="padding:4px 10px; font-size:0.95rem; font-weight:600; color:#111827;">${quantity}</div>
                        <button type="button" id="cf-qty-plus" style="background:#fff; border:none; padding:4px 12px; cursor:pointer; font-size:1.2rem; font-weight:500; color:#6b7280;">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:20px; font-size:0.95rem; color:#4b5563;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span>Subtotal</span>
                    <span id="cf-summary-subtotal" style="font-weight:500;">₹${total}</span>
                  </div>
                  <div id="cf-summary-discount-row" style="display:none; justify-content:space-between; margin-bottom:10px; color:#059669; font-weight:600;">
                    <span>Discount</span>
                    <span id="cf-summary-discount-value">-₹0</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                    <span>Shipping</span>
                    <span style="color:#10b981; font-weight:600;">FREE</span>
                  </div>
                  <div style="border-top:1px dashed #d1d5db; margin:16px 0;"></div>
                  <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; color:#111827;">
                    <span>Total</span>
                    <span id="cf-summary-total">₹${total}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Deliver To / Address Step -->
            <div id="cf-deliver-to-card" class="cf-card" style="display:none; padding:16px 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i class="ph ph-map-pin" style="font-size: 20px; color: #4b5563;"></i>
                  <span style="font-weight:600; color:#1f2937; font-size:1rem;">Deliver to <span style="background:#f3f4f6; padding:4px 10px; border-radius:12px; font-size:0.75rem; margin-left:6px; font-weight:600;">Home</span></span>
                </div>
                <button type="button" id="cf-edit-address-btn" style="background:none; border:none; color:${primaryColor}; font-size:0.9rem; font-weight:600; cursor:pointer;">Edit</button>
              </div>
              <div style="font-size:0.95rem; color:#4b5563; line-height:1.5;">
                <span id="cf-display-name" style="font-weight:600; color:#111827;"></span>, <span id="cf-display-address"></span><br/>
                <div style="margin-top:6px; display:flex; gap:16px; font-weight:500;">
                  <span style="display:flex; align-items:center; gap:6px;"><i class="ph ph-phone" style="font-size: 16px;"></i> <span id="cf-display-phone"></span></span>
                </div>
              </div>
            </div>

            <!-- Offers & Rewards -->
            <div id="cf-offers-section">
              <div class="cf-card" style="padding:8px; display:flex; align-items:center; padding-left:16px; margin-bottom:16px;">
                <i class="ph ph-tag" style="font-size: 20px; color: #9ca3af;"></i>
                <input type="text" id="cf-discount" class="cf-input" placeholder="Enter coupon code" style="border:none; box-shadow:none; padding:10px 12px; flex:1; background:transparent; font-size:1rem;" />
                <button type="button" id="cf-apply-discount" style="background:${primaryColor}15; color:${primaryColor}; border-radius:8px; border:none; padding:8px 16px; font-weight:600; cursor:pointer; transition:all 0.2s;">Apply</button>
              </div>
              <div id="cf-discount-msg" style="color:#059669; font-size:0.85rem; font-weight:500; margin-top:-10px; margin-bottom:16px; padding-left:8px; display:none;">Discount code applied!</div>
            </div>

            <!-- Pre-Verification: Phone & Add Address -->
            <div id="cf-phone-step">
              <div class="cf-card" style="display:flex; align-items:center; padding:0 16px; height:56px; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:8px; border-right:1px solid #e5e7eb; padding-right:16px; height:100%;">
                  <span style="font-size:1.2rem;">🇮🇳</span>
                  <span style="color:#111; font-size:1rem; font-weight:500;">+91</span>
                </div>
                <input type="tel" id="cf-login-phone" style="border:none; padding:0 16px; font-size:1.05rem; font-weight:500; flex:1; outline:none; height:100%; background:transparent;" placeholder="Mobile Number" maxlength="10" />
              </div>

              <div id="cf-otp-step" style="display:none; margin-bottom:16px;">
                <input type="text" id="cf-login-otp" class="cf-input" placeholder="Enter 4-digit OTP" style="text-align:center; letter-spacing:12px; font-size:1.2rem; font-weight:600;" maxlength="4" />
                <p id="cf-otp-error" style="color:#ef4444; font-size:0.85rem; font-weight:500; margin-top:8px; text-align:center; display:none;"></p>
              </div>

              <button type="button" id="cf-add-address-btn" class="cf-btn-primary" style="margin-bottom:20px;">Continue</button>
              <p id="cf-login-error" style="color:#ef4444; font-size:0.85rem; font-weight:500; margin-top:-10px; margin-bottom:16px; text-align:center; display:none;"></p>
              
              <!-- Badges -->
              <div style="display:flex; justify-content:space-between; margin-top:32px; padding:0 10px;">
                <div class="cf-badge"><i class="ph ph-star" style="font-size: 26px; color:#4b5563;"></i>Top Rated<br/>Products</div>
                <div class="cf-badge"><i class="ph ph-lock-key" style="font-size: 26px; color:#4b5563;"></i>Secured<br/>Checkout</div>
                <div class="cf-badge"><i class="ph ph-truck" style="font-size: 26px; color:#4b5563;"></i>Fast<br/>Shipping</div>
                <div class="cf-badge"><i class="ph ph-smiley" style="font-size: 26px; color:#4b5563;"></i>100k+ Happy<br/>customers</div>
              </div>
            </div>

            <!-- Pre-Verification: Address Form Modal (Hidden by default) -->
            <div id="cf-address-form-modal" style="display:none;">
              <h3 style="font-size:1.1rem; font-weight:700; color:#1f2937; margin-bottom:16px;">Add Shipping Address</h3>
              <div style="display:flex; flex-direction:column; gap:16px;">
                <input type="text" id="cf-name" class="cf-input" placeholder="Full Name" required />
                <input type="email" id="cf-email" class="cf-input" placeholder="Email Address" required />
                <input type="text" id="cf-address" class="cf-input" placeholder="Street Address" required />
                <div style="display:flex; gap:16px;">
                  <input type="text" id="cf-city" class="cf-input" placeholder="City" required />
                  <input type="text" id="cf-state" class="cf-input" placeholder="State" required />
                </div>
                <input type="text" id="cf-pincode" class="cf-input" placeholder="Pincode" required />
              </div>
              <button type="button" id="cf-save-address-btn" class="cf-btn-primary" style="margin-top:20px;">Save Address</button>
            </div>

            <!-- Post-Verification: Payment Options -->
            <form id="cf-checkout-form" style="display:none; margin-top:12px;">
              <div style="font-size:0.95rem; font-weight:600; color:#374151; margin-bottom:12px;">Payment methods</div>
              <div id="cf-payment-options" class="cf-card" style="overflow:hidden;">
                <div style="padding:24px; text-align:center; color:#6b7280; font-size:1rem; font-weight:500;">Loading secure options...</div>
              </div>

              <!-- Footer -->
              <div style="margin-top:32px; text-align:center;">
                <div style="display:flex; justify-content:center; align-items:center; gap:6px; color:#9ca3af; font-size:0.85rem; font-weight:600;">
                  <i class="ph ph-shield-check" style="font-size: 18px;"></i>
                  100% Secured by CheckoutFlow
                </div>
              </div>
            </form>

          </div>
        </div>
      `;

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);

      setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 10);

      const closeWidget = () => {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => overlay.remove(), 400);
      };
      document.getElementById('cf-close').onclick = closeWidget;
      overlay.onclick = (e) => { if(e.target === overlay) closeWidget(); };

      const rzpScript = document.createElement('script');
      rzpScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.head.appendChild(rzpScript);

      // Accordion Logic
      const header = document.getElementById('cf-accordion-header');
      const body = document.getElementById('cf-accordion-body');
      const icon = document.getElementById('cf-accordion-icon');
      let isExpanded = false;
      header.onclick = () => {
        isExpanded = !isExpanded;
        body.style.display = isExpanded ? 'block' : 'none';
        icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0)';
      };

      // ======== SCREEN 1 LOGIC ========
      const phoneInput = document.getElementById('cf-login-phone');
      const addAddressBtn = document.getElementById('cf-add-address-btn');
      const otpInput = document.getElementById('cf-login-otp');
      const loginError = document.getElementById('cf-login-error');
      const otpError = document.getElementById('cf-otp-error');
      let otpStepActive = false;

      phoneInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
      });

      addAddressBtn.onclick = async () => {
        if (!otpStepActive) {
          const phone = phoneInput.value;
          if(phone.length !== 10) {
             loginError.innerText = "Enter valid 10 digit number";
             loginError.style.display = 'block';
             return;
          }
          addAddressBtn.innerText = 'Sending...';
          addAddressBtn.style.opacity = '0.7';
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
              document.getElementById('cf-otp-step').style.display = 'block';
              otpStepActive = true;
              addAddressBtn.innerText = 'Verify & Continue';
              addAddressBtn.style.opacity = '1';
            } else {
              loginError.innerText = data.error || 'Failed to send OTP';
              loginError.style.display = 'block';
              addAddressBtn.innerText = 'Continue';
              addAddressBtn.style.opacity = '1';
            }
          } catch(err) {
            loginError.innerText = 'Network error. Try again.';
            loginError.style.display = 'block';
            addAddressBtn.innerText = 'Continue';
            addAddressBtn.style.opacity = '1';
          }
        } else {
          // VERIFY OTP
          const code = otpInput.value;
          addAddressBtn.innerText = 'Verifying...';
          addAddressBtn.style.opacity = '0.7';
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
              addAddressBtn.innerText = 'Verify & Continue';
              addAddressBtn.style.opacity = '1';
            }
          } catch(err) {
            otpError.innerText = 'Network error. Try again.';
            otpError.style.display = 'block';
            addAddressBtn.innerText = 'Verify & Continue';
            addAddressBtn.style.opacity = '1';
          }
        }
      };

      const goToCheckoutScreen = async () => {
        // Change Banner to Post-Login State
        const promoBanner = document.getElementById('cf-promo-banner');
        promoBanner.innerText = widgetConfig.postLoginBannerText || '⚡ EXTRA 2% OFF ON UPI/CARDS';
        promoBanner.style.backgroundColor = widgetConfig.postLoginBannerBg || '#ecfdf5';
        promoBanner.style.color = widgetConfig.postLoginBannerColor || '#059669';
        
        // Hide Phone step, collapse summary
        document.getElementById('cf-phone-step').style.display = 'none';
        isExpanded = false;
        body.style.display = 'none';
        icon.style.transform = 'rotate(0)';

        // Fetch Customer
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
            
            document.getElementById('cf-display-name').innerText = customerData.name || 'User';
            document.getElementById('cf-display-address').innerText = `${customerData.address}, ${customerData.city}`;
            document.getElementById('cf-display-phone').innerText = verifiedPhone;
            
            document.getElementById('cf-deliver-to-card').style.display = 'block';
            showPaymentStep();
          } else {
            // Show address form
            document.getElementById('cf-address-form-modal').style.display = 'block';
          }
        } catch(e) {
            document.getElementById('cf-address-form-modal').style.display = 'block';
        }
      };

      document.getElementById('cf-save-address-btn').onclick = () => {
        const name = document.getElementById('cf-name').value;
        const addr = document.getElementById('cf-address').value;
        const city = document.getElementById('cf-city').value;
        if(name && addr && city) {
           document.getElementById('cf-address-form-modal').style.display = 'none';
           document.getElementById('cf-display-name').innerText = name;
           document.getElementById('cf-display-address').innerText = `${addr}, ${city}`;
           document.getElementById('cf-display-phone').innerText = verifiedPhone;
           document.getElementById('cf-deliver-to-card').style.display = 'block';
           showPaymentStep();
        } else {
           alert("Please fill all required address fields.");
        }
      };
      
      document.getElementById('cf-edit-address-btn').onclick = () => {
         document.getElementById('cf-deliver-to-card').style.display = 'none';
         document.getElementById('cf-address-form-modal').style.display = 'block';
         document.getElementById('cf-checkout-form').style.display = 'none';
      };

      const showPaymentStep = () => {
         document.getElementById('cf-checkout-form').style.display = 'block';
         renderPaymentOptions();
      };

      // ======== PAYMENT LOGIC ========
      const renderPaymentOptions = () => {
        const container = document.getElementById('cf-payment-options');
        if (!container) return;
        
        let html = '';
        
        const getDiscountTag = () => {
          if (!widgetConfig.isPrepaidDiscountEnabled) return '';
          const txt = widgetConfig.prepaidDiscountType === 'percentage' ? `${widgetConfig.prepaidDiscountValue}%` : `₹${widgetConfig.prepaidDiscountValue}`;
          return `<span style="display:inline-flex; align-items:center; gap:6px; margin-top:6px; background:#ecfdf5; color:#059669; font-size:0.75rem; font-weight:700; padding:6px 10px; border-radius:12px;"><i class="ph ph-tag" style="font-size: 14px;"></i> Get ${txt} off</span>`;
        };

        const renderOption = (val, title, subtitle, iconHtml, isFirst, isPrepaid) => {
          return `
            <div class="cf-payment-option-label" data-payment-method="${val}" style="display:flex; align-items:center; justify-content:space-between; padding:20px; cursor:pointer; border-bottom:${isFirst ? '1px solid #e5e7eb' : '1px solid #e5e7eb'}; background:#fff; transition: all 0.2s;">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:48px; height:48px; border-radius:12px; border:1px solid #f3f4f6; display:flex; align-items:center; justify-content:center; background:#f9fafb;">
                  ${iconHtml}
                </div>
                <div>
                  <div style="display:flex; align-items:center;">
                    <span style="font-weight:700; color:#111827; font-size:1.05rem;">${title}</span>
                  </div>
                  ${isPrepaid ? getDiscountTag() : `<div style="color:#6b7280; font-size:0.85rem; margin-top:4px; font-weight:500;">${subtitle}</div>`}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span id="cf-price-${val}" style="font-weight:700; color:#111827; font-size:1.05rem;"></span>
                <i class="ph ph-caret-right" style="font-size: 18px; color:#9ca3af;"></i>
              </div>
            </div>
          `;
        };

        const icons = {
          upi: `<img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" style="height:20px;" />`,
          card: `<div style="display:flex;gap:4px;"><img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" style="height:14px;" /><img src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg" style="height:14px;" /></div>`,
          wallet: `<img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" style="height:16px;" />`,
          net: `<i class="ph ph-bank" style="font-size:24px; color:#10b981;"></i>`,
          cod: `<i class="ph ph-money" style="font-size:24px; color:#64748b;"></i>`
        };

        if (widgetConfig.hasRazorpay) {
          html += renderOption('UPI', 'Pay via UPI', 'GPay, PhonePe, Paytm', icons.upi, true, true);
          html += renderOption('Card', 'Debit / Credit cards', 'Visa, Mastercard, RuPay', icons.card, false, true);
          html += renderOption('Wallet', 'Wallets', 'Paytm, PhonePe', icons.wallet, false, true);
          html += renderOption('Netbanking', 'Netbanking', 'All Indian banks', icons.net, false, true);
        }
        
        if (widgetConfig.isPartialCodEnabled) {
          html += renderOption('PartialCOD', 'Partial COD', `Pay ₹${widgetConfig.partialCodAmount} now`, icons.cod, false, false);
        }
        
        html += renderOption('COD', 'Cash on Delivery', 'Pay when you receive', icons.cod, false, false);
        
        container.innerHTML = html;
        
        // Attach onclick handlers for ONE-CLICK PAYMENT
        const optionCards = container.querySelectorAll('.cf-payment-option-label');
        optionCards.forEach(card => {
          card.onclick = async (e) => {
            e.preventDefault();
            const val = card.getAttribute('data-payment-method');
            const priceEl = card.querySelector(`#cf-price-${val}`);
            const originalText = priceEl.innerText;
            priceEl.innerText = 'Wait...';
            
            await processPayment(val);
            
            priceEl.innerText = originalText;
          };
        });

        window.cfUpdatePricing();
      };
      
      window.cfUpdatePricing = () => { if(typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing(); };

      window.internalUpdatePricing = () => {
        const subtotal = basePrice * currentQuantity;
        let discountAmount = 0;

        if (appliedDiscount) {
          if (appliedDiscount.type === 'percentage') {
            discountAmount = subtotal * (appliedDiscount.value / 100);
          } else if (appliedDiscount.type === 'fixed_amount') {
            discountAmount = appliedDiscount.value;
          }
        }
        
        const priceEls = document.querySelectorAll('[id^="cf-price-"]');
        priceEls.forEach(el => {
          const val = el.id.replace('cf-price-', '');
          if (['UPI', 'Card', 'Wallet', 'Netbanking'].includes(val) && widgetConfig.isPrepaidDiscountEnabled) {
            let pd = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
            el.innerText = `₹${Math.max(0, subtotal - discountAmount - pd).toLocaleString('en-IN')}`;
          } else if (val === 'PartialCOD') {
            el.innerText = `₹${widgetConfig.partialCodAmount}`;
          } else {
            el.innerText = `₹${Math.max(0, subtotal - discountAmount).toLocaleString('en-IN')}`;
          }
        });

        const finalTotal = Math.max(0, subtotal - discountAmount);
        document.getElementById('cf-item-total').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('cf-qty-display').innerText = currentQuantity;
        document.getElementById('cf-summary-qty-header').innerText = `${currentQuantity} item`;
        document.getElementById('cf-summary-subtotal').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        
        if (discountAmount > 0) {
          document.getElementById('cf-summary-discount-row').style.display = 'flex';
          document.getElementById('cf-summary-discount-value').innerText = `-₹${discountAmount.toLocaleString('en-IN')}`;
        } else {
          document.getElementById('cf-summary-discount-row').style.display = 'none';
        }
        
        document.getElementById('cf-summary-total').innerText = `₹${finalTotal.toLocaleString('en-IN')}`;
        document.getElementById('cf-header-total').innerText = `₹${finalTotal.toLocaleString('en-IN')}`;
      };

      window.internalUpdatePricing();

      if (verifiedPhone) {
        goToCheckoutScreen();
      }

      // Quantity buttons
      document.getElementById('cf-qty-plus').onclick = () => {
        currentQuantity++;
        window.internalUpdatePricing();
      };
      document.getElementById('cf-qty-minus').onclick = () => {
        if(currentQuantity > 1) {
          currentQuantity--;
          window.internalUpdatePricing();
        }
      };

      // Discount logic
      document.getElementById('cf-apply-discount').onclick = async () => {
        const code = document.getElementById('cf-discount').value;
        if(!code) return;
        
        const btn = document.getElementById('cf-apply-discount');
        btn.innerText = '...';
        
        try {
          const res = await fetch(`${apiBaseUrl}/api/validate-discount`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, code })
          });
          const data = await res.json();
          btn.innerText = 'Apply';
          
          if (data.success && data.valid) {
            appliedDiscount = data.discount;
            const msgEl = document.getElementById('cf-discount-msg');
            msgEl.innerText = "🎉 Coupon Applied!";
            msgEl.style.display = 'block';
            window.internalUpdatePricing();
            
            // Confetti Burst
            if (window.confetti) {
               window.confetti({
                 particleCount: 150,
                 spread: 80,
                 origin: { y: 0.6 },
                 colors: [primaryColor, '#10b981', '#f59e0b', '#3b82f6'],
                 zIndex: 9999999
               });
            }
          } else {
            alert("Invalid or expired code");
          }
        } catch(e) {
            btn.innerText = 'Apply';
        }
      };

      // ONE-CLICK PAYMENT PROCESSOR
      const processPayment = async (paymentMethod) => {
        const isPrepaid = ['UPI', 'Card', 'Wallet', 'Netbanking'].includes(paymentMethod);
        const isPartialCod = paymentMethod === 'PartialCOD';

        const subtotal = basePrice * currentQuantity;
        let prepaidDiscount = 0;
        if (widgetConfig.isPrepaidDiscountEnabled && isPrepaid) {
          if (widgetConfig.prepaidDiscountType === 'percentage') {
             prepaidDiscount = subtotal * (widgetConfig.prepaidDiscountValue / 100);
          } else {
             prepaidDiscount = widgetConfig.prepaidDiscountValue;
          }
        }
        
        let discountAmount = 0;
        if (appliedDiscount) {
          if (appliedDiscount.type === 'percentage') {
            discountAmount = subtotal * (appliedDiscount.value / 100);
          } else if (appliedDiscount.type === 'fixed_amount') {
            discountAmount = appliedDiscount.value;
          }
        }
        
        const payload = {
          shop, variantId, quantity: currentQuantity, productTitle, price,
          customerName: document.getElementById('cf-name').value,
          customerPhone: verifiedPhone,
          customerEmail: document.getElementById('cf-email').value,
          address: document.getElementById('cf-address').value,
          city: document.getElementById('cf-city').value,
          state: document.getElementById('cf-state').value,
          pincode: document.getElementById('cf-pincode').value,
          paymentMethod: paymentMethod,
          appliedDiscount: appliedDiscount ? { code: appliedDiscount.code, type: appliedDiscount.type, value: appliedDiscount.value } : null,
          prepaidDiscount: prepaidDiscount
        };

        const createFinalOrder = async () => {
          try {
            const res = await fetch(`${apiBaseUrl}/api/create-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
              window.CheckoutFlow.trackEvent(shop, 'ORDER_COMPLETED');
              if (data.orderStatusUrl) {
                window.location.href = data.orderStatusUrl;
              } else {
                sheet.innerHTML = `
                  <div style="text-align:center; padding: 60px 20px;">
                    <div style="font-size:4rem; color:#10b981; margin-bottom:20px;">✓</div>
                    <h2 style="margin:0 0 10px 0; color:#111; font-size:1.5rem;">Order Confirmed!</h2>
                    <p style="color:#6b7280; font-size:1rem;">Your order has been placed successfully.</p>
                    <button onclick="document.getElementById('checkoutflow-overlay').remove()" style="margin-top:30px; padding:14px 24px; background:#111; color:#fff; border:none; border-radius:12px; cursor:pointer; font-size:1rem; font-weight:600;">Close Checkout</button>
                  </div>
                `;
              }
            } else {
              alert('Failed to place order: ' + (data.error || 'Unknown error'));
            }
          } catch(err) {
            alert('Network error. Please try again.');
          }
        };

        if (isPrepaid || isPartialCod) {
          try {
            const rzpAmount = Math.max(0, subtotal - discountAmount - prepaidDiscount);
            const rzpOrderRes = await fetch(`${apiBaseUrl}/api/checkout/create-razorpay-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shop, amount: isPartialCod ? widgetConfig.partialCodAmount : rzpAmount })
            });
            const rzpOrderData = await rzpOrderRes.json();
            
            if (!rzpOrderData.success) {
              alert('Failed to initialize payment gateway: ' + rzpOrderData.error);
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
                  payload.paymentMethod = isPartialCod ? 'Partial COD' : 'Prepaid Online';
                  payload.paymentId = response.razorpay_payment_id;
                  await createFinalOrder();
                } else {
                  alert('Payment verification failed.');
                }
              },
              prefill: {
                name: document.getElementById('cf-name').value,
                email: document.getElementById('cf-email').value,
                contact: verifiedPhone
              },
              theme: { color: primaryColor }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
              alert('Payment failed. Reason: ' + response.error.description);
            });
            rzp.open();
          } catch(e) {
            alert('Error initiating payment.');
          }
        } else {
          await createFinalOrder();
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
