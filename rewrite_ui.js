const fs = require('fs');

const content = fs.readFileSync('public/widget.js', 'utf8');

const openStartStr = 'open: function(options) {';
const openStartIdx = content.indexOf(openStartStr);
const autoInjectIdx = content.indexOf('autoInject: function() {');

const newOpenFunction = `open: async function(options) {
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
        const configRes = await fetch(\`\${apiBaseUrl}/api/widget/config?shop=\${shop}\`);
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
      overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
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
      sheet.style.boxShadow = '0 -4px 20px rgba(0,0,0,0.1)';
      sheet.style.transform = 'translateY(100%)';
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      sheet.style.overflow = 'hidden';
      sheet.style.display = 'flex';
      sheet.style.flexDirection = 'column';

      let currentQuantity = quantity;
      let basePrice = price;
      let total = basePrice * currentQuantity;
      let appliedDiscount = null;
      let verifiedPhone = localStorage.getItem('checkoutflow_verified_phone') || '';
      let customerData = null;

      const phosphorScript = document.createElement('script');
      phosphorScript.src = 'https://unpkg.com/@phosphor-icons/web';
      document.head.appendChild(phosphorScript);

      sheet.innerHTML = \`
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          #cf-sheet * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
          .cf-card { background: #fff; border: 1px solid #f3f4f6; border-radius: 12px; margin-bottom: 12px; }
          .cf-input { width: 100%; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; outline: none; transition: border 0.2s; }
          .cf-input:focus { border-color: \${primaryColor}; }
          .cf-btn-primary { width: 100%; padding: 16px; background: \${primaryColor}; color: #fff; border: none; border-radius: 12px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
          .cf-btn-primary:hover { opacity: 0.9; }
          .cf-badge { color: #9ca3af; font-size: 0.65rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
          .cf-payment-option-label:hover { background: #f9fafb !important; }
        </style>
        
        <div id="cf-sheet" style="display:flex; flex-direction:column; height:100%;">
          <!-- Header -->
          <div style="background:#fff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-top-left-radius:24px; border-top-right-radius:24px; border-bottom:1px solid #f3f4f6;">
            <button id="cf-close" style="background:none; border:none; cursor:pointer; padding:0; display:flex;">
              <i class="ph ph-arrow-left" style="font-size: 24px; color: #374151;"></i>
            </button>
            <div style="border: 1px solid #e5e7eb; padding:4px 10px; border-radius:8px; font-weight:700; font-size:0.7rem; letter-spacing:1px; color:#111; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; top:-6px; left:-6px; width:12px; height:12px; border-right:1px solid #e5e7eb; border-bottom:1px solid #e5e7eb; transform: rotate(-45deg); background:#fff;"></div>
              <div style="position:absolute; bottom:-6px; right:-6px; width:12px; height:12px; border-left:1px solid #e5e7eb; border-top:1px solid #e5e7eb; transform: rotate(-45deg); background:#fff;"></div>
              \${(widgetConfig.storeName || shop.split('.')[0]).substring(0,2).toUpperCase()}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700; font-size:1rem; color:#111;" id="cf-header-total">₹\${total}</div>
            </div>
          </div>

          <!-- Dynamic Banner -->
          <div id="cf-promo-banner" style="background:\${widgetConfig.preLoginBannerBg}; color:\${widgetConfig.preLoginBannerColor}; text-align:center; padding:8px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px;">
            \${widgetConfig.preLoginBannerText}
          </div>

          <!-- Main Scrollable Area -->
          <div style="flex:1; overflow-y:auto; padding:16px; background:#f9fafb;">
            
            <!-- Order Summary Accordion -->
            <div class="cf-card" style="margin-bottom: 12px;">
              <div id="cf-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i class="ph ph-shopping-cart" style="font-size: 20px; color: #4b5563;"></i>
                  <span style="font-weight:500; color:#374151; font-size:0.95rem;">Order summary</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; color:#6b7280; font-size:0.85rem;">
                  <span id="cf-summary-qty-header">\${quantity} item</span>
                  <i id="cf-accordion-icon" class="ph ph-caret-down" style="font-size: 16px; transition: transform 0.2s;"></i>
                </div>
              </div>

              <!-- Expanded Details -->
              <div id="cf-accordion-body" style="padding:0 16px 16px 16px; display:none; border-top:1px solid #f3f4f6;">
                <div style="display:flex; gap:16px; align-items:flex-start; margin-top:16px;">
                  \${productImage ? \`<img src="\${productImage}" style="width:64px; height:64px; border-radius:8px; object-fit:cover; border:1px solid #e5e7eb;" />\` : \`<div style="width:64px; height:64px; border-radius:8px; background:#e5e7eb;"></div>\`}
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                      <div style="font-size:0.85rem; color:#111827; font-weight:500; padding-right:12px; line-height:1.4;">\${productTitle || 'Product'}</div>
                      <div style="text-align:right;">
                        <div style="font-weight:700; font-size:0.9rem; color:#111827;" id="cf-item-total">₹\${total}</div>
                      </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
                      <button type="button" id="cf-delete-item" style="background:none; border:1px solid #e5e7eb; border-radius:6px; padding:4px; cursor:pointer; color:#9ca3af; display:flex;">
                        <i class="ph ph-trash" style="font-size: 16px;"></i>
                      </button>
                      <div style="display:flex; align-items:center; border:1px solid #e5e7eb; border-radius:20px; overflow:hidden;">
                        <button type="button" id="cf-qty-minus" style="background:#fff; border:none; padding:2px 10px; cursor:pointer; font-size:1.1rem; color:#9ca3af;">-</button>
                        <div id="cf-qty-display" style="padding:2px 8px; font-size:0.85rem; font-weight:600; color:#111827;">\${quantity}</div>
                        <button type="button" id="cf-qty-plus" style="background:#fff; border:none; padding:2px 10px; cursor:pointer; font-size:1.1rem; color:#9ca3af;">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:16px; font-size:0.85rem; color:#4b5563;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span>Subtotal</span>
                    <span id="cf-summary-subtotal">₹\${total}</span>
                  </div>
                  <div id="cf-summary-discount-row" style="display:none; justify-content:space-between; margin-bottom:8px; color:#059669; font-weight:500;">
                    <span>Discount</span>
                    <span id="cf-summary-discount-value">-₹0</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <span>Shipping</span>
                    <span style="color:#9ca3af;">Free</span>
                  </div>
                  <div style="border-top:1px dashed #e5e7eb; margin:12px 0;"></div>
                  <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.95rem; color:#111827;">
                    <span>Total</span>
                    <span id="cf-summary-total">₹\${total}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Deliver To / Address Step -->
            <div id="cf-deliver-to-card" class="cf-card" style="display:none; padding:12px 16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i class="ph ph-map-pin" style="font-size: 18px; color: #4b5563;"></i>
                  <span style="font-weight:500; color:#374151; font-size:0.95rem;">Deliver to <span style="background:#f3f4f6; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:4px;">Home</span></span>
                </div>
                <button type="button" id="cf-edit-address-btn" style="background:none; border:none; color:\${primaryColor}; font-size:0.85rem; font-weight:600; cursor:pointer;">Edit</button>
              </div>
              <div style="font-size:0.85rem; color:#6b7280; line-height:1.4;">
                <span id="cf-display-name" style="font-weight:600; color:#111827;"></span>, <span id="cf-display-address"></span><br/>
                <div style="margin-top:4px; display:flex; gap:16px;">
                  <span style="display:flex; align-items:center; gap:4px;"><i class="ph ph-phone" style="font-size: 14px;"></i> <span id="cf-display-phone"></span></span>
                </div>
              </div>
            </div>

            <!-- Offers & Rewards -->
            <div id="cf-offers-section">
              <div class="cf-card" style="padding:6px; display:flex; align-items:center; padding-left:12px; margin-bottom:12px;">
                <i class="ph ph-tag" style="font-size: 18px; color: #9ca3af;"></i>
                <input type="text" id="cf-discount" class="cf-input" placeholder="Enter coupon code" style="border:none; box-shadow:none; padding:8px; flex:1; background:transparent;" />
                <button type="button" id="cf-apply-discount" style="background:transparent; color:\${primaryColor}; border:none; padding:0 12px; font-weight:600; cursor:pointer;">Apply</button>
              </div>
              <div id="cf-discount-msg" style="color:#059669; font-size:0.75rem; margin-top:-8px; margin-bottom:12px; padding-left:8px; display:none;">Discount code applied!</div>
            </div>

            <!-- Pre-Verification: Phone & Add Address -->
            <div id="cf-phone-step">
              <div class="cf-card" style="display:flex; align-items:center; padding:0 12px; height:48px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:6px; border-right:1px solid #e5e7eb; padding-right:12px; height:100%;">
                  <span style="font-size:1.1rem;">🇮🇳</span>
                  <span style="color:#111; font-size:0.95rem;">+91</span>
                </div>
                <input type="tel" id="cf-login-phone" style="border:none; padding:0 12px; font-size:0.95rem; flex:1; outline:none; height:100%; background:transparent;" placeholder="Mobile Number" maxlength="10" />
              </div>

              <div id="cf-otp-step" style="display:none; margin-bottom:12px;">
                <input type="text" id="cf-login-otp" class="cf-input" placeholder="Enter 4-digit OTP" style="text-align:center; letter-spacing:8px;" maxlength="4" />
                <p id="cf-otp-error" style="color:#ef4444; font-size:0.8rem; margin-top:8px; text-align:center; display:none;"></p>
              </div>

              <button type="button" id="cf-add-address-btn" class="cf-btn-primary" style="margin-bottom:16px;">Continue</button>
              <p id="cf-login-error" style="color:#ef4444; font-size:0.8rem; margin-top:-8px; margin-bottom:16px; text-align:center; display:none;"></p>
              
              <!-- Badges -->
              <div style="display:flex; justify-content:space-between; margin-top:24px; padding:0 10px;">
                <div class="cf-badge"><i class="ph ph-star" style="font-size: 24px;"></i>Top Rated<br/>Products</div>
                <div class="cf-badge"><i class="ph ph-lock-key" style="font-size: 24px;"></i>Secured<br/>Checkout</div>
                <div class="cf-badge"><i class="ph ph-truck" style="font-size: 24px;"></i>Fast<br/>Shipping</div>
                <div class="cf-badge"><i class="ph ph-smiley" style="font-size: 24px;"></i>100k+ Happy<br/>customers</div>
              </div>
            </div>

            <!-- Pre-Verification: Address Form Modal (Hidden by default) -->
            <div id="cf-address-form-modal" style="display:none;">
              <h3 style="font-size:0.95rem; font-weight:600; color:#374151; margin-bottom:12px;">Add Shipping Address</h3>
              <div style="display:flex; flex-direction:column; gap:12px;">
                <input type="text" id="cf-name" class="cf-input" placeholder="Full Name" required />
                <input type="email" id="cf-email" class="cf-input" placeholder="Email Address" required />
                <input type="text" id="cf-address" class="cf-input" placeholder="Street Address" required />
                <div style="display:flex; gap:12px;">
                  <input type="text" id="cf-city" class="cf-input" placeholder="City" required />
                  <input type="text" id="cf-state" class="cf-input" placeholder="State" required />
                </div>
                <input type="text" id="cf-pincode" class="cf-input" placeholder="Pincode" required />
              </div>
              <button type="button" id="cf-save-address-btn" class="cf-btn-primary" style="margin-top:16px;">Save Address</button>
            </div>

            <!-- Post-Verification: Payment Options -->
            <form id="cf-checkout-form" style="display:none; margin-top:8px;">
              <div style="font-size:0.85rem; font-weight:500; color:#4b5563; margin-bottom:8px;">Payment methods</div>
              <div id="cf-payment-options" class="cf-card" style="overflow:hidden;">
                <div style="padding:20px; text-align:center; color:#6b7280; font-size:0.9rem;">Loading payment options...</div>
              </div>

              <!-- Footer -->
              <div style="margin-top:24px; text-align:center;">
                <div style="display:flex; justify-content:center; align-items:center; gap:4px; color:#9ca3af; font-size:0.75rem; font-weight:500;">
                  <i class="ph ph-lock-key" style="font-size: 14px;"></i>
                  Secured by CheckoutFlow
                </div>
              </div>
            </form>

          </div>
        </div>
      \`;

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);

      setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 10);

      const closeWidget = () => {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => overlay.remove(), 300);
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
        const val = e.target.value.replace(/\\D/g, '');
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
            const res = await fetch(\`\${apiBaseUrl}/api/otp/send\`, {
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
            const res = await fetch(\`\${apiBaseUrl}/api/otp/verify\`, {
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
          const lookupRes = await fetch(\`\${apiBaseUrl}/api/customer/lookup?shop=\${shop}&phone=\${verifiedPhone}\`);
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
            document.getElementById('cf-display-address').innerText = \`\${customerData.address}, \${customerData.city}\`;
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
           document.getElementById('cf-display-address').innerText = \`\${addr}, \${city}\`;
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
          const txt = widgetConfig.prepaidDiscountType === 'percentage' ? \`\${widgetConfig.prepaidDiscountValue}%\` : \`₹\${widgetConfig.prepaidDiscountValue}\`;
          return \`<span style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; background:#ecfdf5; color:#059669; font-size:0.75rem; font-weight:600; padding:4px 8px; border-radius:12px;"><i class="ph ph-tag" style="font-size: 12px;"></i> Get \${txt} off</span>\`;
        };

        // Render card with class .cf-payment-option-label and data-payment-method
        const renderOption = (val, title, subtitle, iconHtml, isFirst, isPrepaid) => {
          return \`
            <div class="cf-payment-option-label" data-payment-method="\${val}" style="display:flex; align-items:center; justify-content:space-between; padding:16px; cursor:pointer; border-bottom:\${isFirst ? '1px solid #e5e7eb' : '1px solid #e5e7eb'}; background:#fff; transition: background 0.2s;">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:40px; height:40px; border-radius:12px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; background:#fff;">
                  \${iconHtml}
                </div>
                <div>
                  <div style="display:flex; align-items:center;">
                    <span style="font-weight:600; color:#1f2937; font-size:0.95rem;">\${title}</span>
                  </div>
                  \${isPrepaid ? getDiscountTag() : \`<div style="color:#6b7280; font-size:0.8rem; margin-top:2px;">\${subtitle}</div>\`}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span id="cf-price-\${val}" style="font-weight:600; color:#111827; font-size:0.95rem;"></span>
                <i class="ph ph-caret-right" style="font-size: 16px; color:#9ca3af;"></i>
              </div>
            </div>
          \`;
        };

        const icons = {
          upi: \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>\`,
          card: \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>\`,
          wallet: \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-8H6a2 2 0 0 0-2 2z"/></svg>\`,
          net: \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>\`,
          cod: \`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>\`
        };

        if (widgetConfig.hasRazorpay) {
          html += renderOption('UPI', 'Pay via UPI', 'Use any registered UPI ID', icons.upi, true, true);
          html += renderOption('Card', 'Debit/Credit cards', 'Visa, Mastercard, RuPay', icons.card, false, true);
          html += renderOption('Wallet', 'Wallets', 'Paytm, PhonePe', icons.wallet, false, true);
          html += renderOption('Netbanking', 'Netbanking', 'Select from all banks', icons.net, false, true);
        }
        
        if (widgetConfig.isPartialCodEnabled) {
          html += renderOption('PartialCOD', 'Partial COD', \`Pay ₹\${widgetConfig.partialCodAmount} now\`, icons.cod, false, false);
        }
        
        html += renderOption('COD', 'Cash on Delivery', 'Pay when you receive', icons.cod, false, false);
        
        container.innerHTML = html;
        
        // Attach onclick handlers for ONE-CLICK PAYMENT
        const optionCards = container.querySelectorAll('.cf-payment-option-label');
        optionCards.forEach(card => {
          card.onclick = async (e) => {
            e.preventDefault();
            const val = card.getAttribute('data-payment-method');
            // Show a tiny spinner or loading state on the card clicked
            const priceEl = card.querySelector(\`#cf-price-\${val}\`);
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
            el.innerText = \`₹\${Math.max(0, subtotal - discountAmount - pd).toLocaleString('en-IN')}\`;
          } else if (val === 'PartialCOD') {
            el.innerText = \`₹\${widgetConfig.partialCodAmount}\`;
          } else {
            el.innerText = \`₹\${Math.max(0, subtotal - discountAmount).toLocaleString('en-IN')}\`;
          }
        });

        const finalTotal = Math.max(0, subtotal - discountAmount);
        document.getElementById('cf-item-total').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-qty-display').innerText = currentQuantity;
        document.getElementById('cf-summary-qty-header').innerText = \`\${currentQuantity} item\`;
        document.getElementById('cf-summary-subtotal').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        
        if (discountAmount > 0) {
          document.getElementById('cf-summary-discount-row').style.display = 'flex';
          document.getElementById('cf-summary-discount-value').innerText = \`-₹\${discountAmount.toLocaleString('en-IN')}\`;
        } else {
          document.getElementById('cf-summary-discount-row').style.display = 'none';
        }
        
        document.getElementById('cf-summary-total').innerText = \`₹\${finalTotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-header-total').innerText = \`₹\${finalTotal.toLocaleString('en-IN')}\`;
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
        try {
          const res = await fetch(\`\${apiBaseUrl}/api/discounts/validate\`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, code })
          });
          const data = await res.json();
          if (data.success && data.valid) {
            appliedDiscount = data.discount;
            const msgEl = document.getElementById('cf-discount-msg');
            msgEl.innerText = "Discount applied!";
            msgEl.style.display = 'block';
            window.internalUpdatePricing();
          } else {
            alert("Invalid or expired code");
          }
        } catch(e) {}
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
          appliedDiscount: appliedDiscount ? appliedDiscount.code : null,
          prepaidDiscount: prepaidDiscount
        };

        const createFinalOrder = async () => {
          try {
            const res = await fetch(\`\${apiBaseUrl}/api/create-order\`, {
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
                sheet.innerHTML = \`
                  <div style="text-align:center; padding: 40px 20px;">
                    <div style="font-size:3rem; color:#10b981; margin-bottom:20px;">✓</div>
                    <h2 style="margin:0 0 10px 0; color:#111;">Order Confirmed!</h2>
                    <p style="color:#666;">Your order has been placed successfully.</p>
                    <button onclick="document.getElementById('checkoutflow-overlay').remove()" style="margin-top:20px; padding:10px 20px; background:#000; color:#fff; border:none; border-radius:8px; cursor:pointer;">Close</button>
                  </div>
                \`;
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
            const rzpOrderRes = await fetch(\`\${apiBaseUrl}/api/checkout/create-razorpay-order\`, {
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
                const verifyRes = await fetch(\`\${apiBaseUrl}/api/checkout/verify-payment\`, {
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
`;

const finalContent = content.substring(0, openStartIdx) + newOpenFunction + '\n    ' + content.substring(autoInjectIdx);
fs.writeFileSync('public/widget.js', finalContent, 'utf8');
console.log('Rewrite complete!');
