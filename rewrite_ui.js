const fs = require('fs');

let content = fs.readFileSync('public/widget.js', 'utf8');

// The open function starts here
const openStartIdx = content.indexOf(`open: function(options) {`);
const autoInjectIdx = content.indexOf(`autoInject: function() {`);

if (openStartIdx === -1 || autoInjectIdx === -1) {
  console.error("Could not find open or autoInject");
  process.exit(1);
}

const newOpenFunction = `open: function(options) {
      const { shop, variantId, quantity, productTitle, productImage, price } = options;
      
      this.trackEvent(shop, 'WIDGET_OPENED');

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

      const sheet = document.createElement('div');
      sheet.style.width = '100%';
      sheet.style.maxWidth = '480px';
      sheet.style.backgroundColor = '#f3f4f6'; // Match the grey background of screenshot
      sheet.style.borderTopLeftRadius = '24px';
      sheet.style.borderTopRightRadius = '24px';
      sheet.style.transform = 'translateY(100%)';
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      sheet.style.height = '92vh';
      sheet.style.display = 'flex';
      sheet.style.flexDirection = 'column';
      sheet.style.overflow = 'hidden';

      let currentQuantity = parseInt(quantity) || 1;
      let basePrice = parseFloat(price) || 0;
      const total = basePrice * currentQuantity;
      let appliedDiscount = null;
      let verifiedPhone = localStorage.getItem('checkoutflow_verified_phone') || '';
      let customerData = null;

      sheet.innerHTML = \`
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          #cf-sheet * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
          .cf-card { background: #fff; border: 1px solid #f3f4f6; border-radius: 12px; margin-bottom: 16px; }
          .cf-input { width: 100%; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; outline: none; transition: border 0.2s; }
          .cf-input:focus { border-color: #111827; }
          .cf-btn-primary { width: 100%; padding: 16px; background: #f6efe6; color: #111827; border: none; border-radius: 16px; font-size: 1.05rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
          .cf-btn-primary:hover { opacity: 0.9; }
          .cf-btn-pay { background: #111; color: #fff; border-radius: 16px; }
          .cf-badge { color: #9ca3af; font-size: 0.65rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        </style>
        
        <div id="cf-sheet" style="display:flex; flex-direction:column; height:100%;">
          <!-- Header -->
          <div style="background:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; border-top-left-radius:24px; border-top-right-radius:24px;">
            <button id="cf-close" style="background:none; border:none; cursor:pointer; padding:0; display:flex;">
              <svg width="24" height="24" fill="none" stroke="#374151" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <div style="border: 1px solid #e5e7eb; padding:6px 12px; border-radius:8px; font-weight:700; font-size:0.7rem; letter-spacing:1px; color:#111; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; top:-6px; left:-6px; width:12px; height:12px; border-right:1px solid #e5e7eb; border-bottom:1px solid #e5e7eb; transform: rotate(-45deg); background:#fff;"></div>
              <div style="position:absolute; bottom:-6px; right:-6px; width:12px; height:12px; border-left:1px solid #e5e7eb; border-top:1px solid #e5e7eb; transform: rotate(-45deg); background:#fff;"></div>
              \${shop.split('.')[0].toUpperCase()}
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700; font-size:1rem; color:#111;" id="cf-header-total">₹\${total}</div>
              <div style="font-size:0.7rem; color:#9ca3af; text-decoration:line-through;">₹\${basePrice + 100}</div>
            </div>
          </div>

          <!-- Banner -->
          <div id="cf-promo-banner" style="background:#000; color:#fff; text-align:center; padding:10px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px;">
            FREE SHIPPING ON ABOVE RS 499/-
          </div>

          <!-- Main Scrollable Area -->
          <div style="flex:1; overflow-y:auto; padding:20px; background:#f9fafb;">
            
            <!-- Order Summary Accordion -->
            <div class="cf-card">
              <div id="cf-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <svg width="20" height="20" fill="none" stroke="#4b5563" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                  <span style="font-weight:500; color:#374151; font-size:1rem;">Order summary</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; color:#6b7280; font-size:0.9rem;">
                  <span id="cf-summary-qty-header">\${quantity} item</span>
                  <svg id="cf-accordion-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>

              <!-- Expanded Details -->
              <div id="cf-accordion-body" style="padding:0 16px 16px 16px; display:none; border-top:1px solid #f3f4f6;">
                <div style="display:flex; gap:16px; align-items:flex-start; margin-top:16px;">
                  \${productImage ? \`<img src="\${productImage}" style="width:72px; height:72px; border-radius:8px; object-fit:cover; border:1px solid #e5e7eb;" />\` : \`<div style="width:72px; height:72px; border-radius:8px; background:#e5e7eb;"></div>\`}
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                      <div style="font-size:0.9rem; color:#111827; font-weight:500; padding-right:12px; line-height:1.4;">\${productTitle || 'Product'}</div>
                      <div style="text-align:right;">
                        <div style="font-weight:700; font-size:0.95rem; color:#111827;" id="cf-item-total">₹\${total}</div>
                        <div style="font-size:0.7rem; color:#9ca3af; text-decoration:line-through;">₹\${basePrice + 100}</div>
                      </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:12px; margin-top:12px;">
                      <button type="button" id="cf-delete-item" style="background:none; border:1px solid #e5e7eb; border-radius:6px; padding:6px; cursor:pointer; color:#9ca3af;">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                      <div style="display:flex; align-items:center; border:1px solid #e5e7eb; border-radius:20px; overflow:hidden;">
                        <button type="button" id="cf-qty-minus" style="background:#fff; border:none; padding:4px 12px; cursor:pointer; font-size:1.1rem; color:#9ca3af;">-</button>
                        <div id="cf-qty-display" style="padding:4px 8px; font-size:0.85rem; font-weight:600; color:#111827;">\${quantity}</div>
                        <button type="button" id="cf-qty-plus" style="background:#fff; border:none; padding:4px 12px; cursor:pointer; font-size:1.1rem; color:#9ca3af;">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:20px; font-size:0.9rem; color:#4b5563;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <span>Subtotal</span>
                    <span id="cf-summary-subtotal">₹\${total}</span>
                  </div>
                  <div id="cf-summary-discount-row" style="display:none; justify-content:space-between; margin-bottom:12px; color:#059669; font-weight:500;">
                    <span>Discount on MRP</span>
                    <span id="cf-summary-discount-value">-₹0</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                    <span>Shipping</span>
                    <span style="color:#9ca3af;">Calculated at next step</span>
                  </div>
                  <div style="border-top:1px solid #e5e7eb; margin:16px 0;"></div>
                  <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1rem; color:#111827;">
                    <span>Total</span>
                    <span id="cf-summary-total">₹\${total}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Deliver To / Address Step -->
            <div id="cf-deliver-to-card" class="cf-card" style="display:none; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <svg width="18" height="18" fill="none" stroke="#4b5563" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span style="font-weight:500; color:#374151; font-size:1rem;">Deliver to <span style="background:#f3f4f6; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:4px;">Home</span></span>
                </div>
                <button type="button" id="cf-edit-address-btn" style="background:none; border:none; color:#4b5563; font-size:0.85rem; font-weight:500; cursor:pointer;">Edit ></button>
              </div>
              <div style="background:#f9fafb; padding:12px; border-radius:8px; font-size:0.85rem; color:#6b7280; line-height:1.5;">
                <span id="cf-display-name" style="font-weight:600; color:#111827;"></span>, <span id="cf-display-address"></span><br/>
                <div style="margin-top:8px; display:flex; gap:16px;">
                  <span style="display:flex; align-items:center; gap:4px;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg> <span id="cf-display-phone"></span></span>
                </div>
              </div>
            </div>

            <!-- Shipping Card (Post verification) -->
            <div id="cf-shipping-card" class="cf-card" style="display:none; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <svg width="20" height="20" fill="none" stroke="#4b5563" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  <span style="font-weight:500; color:#374151; font-size:1rem;">Shipping</span>
                </div>
                <div style="font-weight:600; color:#111;">₹0 <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:4px;"><path d="M19 9l-7 7-7-7"/></svg></div>
              </div>
            </div>

            <!-- Offers & Rewards -->
            <div style="font-size:0.85rem; color:#6b7280; margin-bottom:8px;">Offers & Rewards</div>
            <div class="cf-card" style="padding:6px; display:flex; align-items:center; padding-left:12px;">
              <svg width="18" height="18" fill="none" stroke="#9ca3af" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
              <input type="text" id="cf-discount" class="cf-input" placeholder="Enter coupon code" style="border:none; box-shadow:none; padding:10px; flex:1; background:transparent;" />
              <button type="button" id="cf-apply-discount" style="background:transparent; color:#111; border:none; padding:0 12px; font-weight:600; cursor:pointer;">Apply</button>
            </div>
            <div id="cf-discount-msg" style="color:#059669; font-size:0.75rem; margin-top:-8px; margin-bottom:16px; padding-left:8px; display:none;">Discount code applied!</div>

            <!-- Pre-Verification: Phone & Add Address -->
            <div id="cf-phone-step">
              <div class="cf-card" style="display:flex; align-items:center; padding:0 12px; height:50px;">
                <div style="display:flex; align-items:center; gap:6px; border-right:1px solid #e5e7eb; padding-right:12px; height:100%;">
                  <span style="font-size:1.1rem;">🇮🇳</span>
                  <span style="color:#111; font-size:0.95rem;">+91</span>
                </div>
                <input type="tel" id="cf-login-phone" style="border:none; padding:0 12px; font-size:0.95rem; flex:1; outline:none; height:100%; background:transparent;" placeholder="Mobile Number" maxlength="10" />
              </div>

              <div id="cf-otp-step" style="display:none; margin-bottom:16px;">
                <input type="text" id="cf-login-otp" class="cf-input" placeholder="Enter 4-digit OTP" style="text-align:center; letter-spacing:8px;" maxlength="4" />
                <p id="cf-otp-error" style="color:#ef4444; font-size:0.8rem; margin-top:8px; text-align:center; display:none;"></p>
              </div>

              <button type="button" id="cf-add-address-btn" class="cf-btn-primary">Add address</button>
              <p id="cf-login-error" style="color:#ef4444; font-size:0.8rem; margin-top:8px; text-align:center; display:none;"></p>
              
              <!-- Badges -->
              <div style="display:flex; justify-content:space-between; margin-top:32px; padding:0 10px;">
                <div class="cf-badge"><svg width="24" height="24" fill="none" stroke="#9ca3af" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Top Rated<br/>Products</div>
                <div class="cf-badge"><svg width="24" height="24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Secured<br/>Checkout</div>
                <div class="cf-badge"><svg width="24" height="24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Fast<br/>Shipping</div>
                <div class="cf-badge"><svg width="24" height="24" fill="none" stroke="#9ca3af" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>100k+ Happy<br/>customers</div>
              </div>
            </div>

            <!-- Pre-Verification: Address Form Modal (Hidden by default) -->
            <div id="cf-address-form-modal" style="display:none;">
              <h3 style="font-size:1rem; font-weight:600; color:#374151; margin-bottom:12px;">Add Shipping Address</h3>
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
            <form id="cf-checkout-form" style="display:none; margin-top:16px;">
              <div style="font-size:0.85rem; color:#6b7280; margin-bottom:8px;">Payment methods</div>
              <div id="cf-payment-options" class="cf-card" style="overflow:hidden;">
                <div style="padding:20px; text-align:center; color:#6b7280; font-size:0.9rem;">Loading payment options...</div>
              </div>

              <!-- Footer -->
              <div style="margin-top:24px; text-align:center;">
                <p style="color:#9ca3af; font-size:0.75rem; margin-bottom:8px;">By continuing, you agree to our Terms & Privacy Policy</p>
                <div style="display:flex; justify-content:center; align-items:center; gap:4px; color:#6b7280; font-size:0.75rem; font-weight:600;">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Secured by CheckoutFlow
                </div>
              </div>
            </form>

          </div>
          
          <!-- Sticky Bottom Bar for Pay Now button -->
          <div id="cf-bottom-bar" style="display:none; padding:16px 20px; background:#fff; border-top:1px solid #e5e7eb;">
            <button type="button" id="cf-submit-order" class="cf-btn-primary cf-btn-pay">
              Pay ₹\${total}
            </button>
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

      const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
      let widgetConfig = { isPrepaidDiscountEnabled: false, prepaidDiscountType: 'percentage', prepaidDiscountValue: 0, isPartialCodEnabled: false, partialCodAmount: 0, hasRazorpay: false };
      
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
              addAddressBtn.innerText = 'Add address';
              addAddressBtn.style.opacity = '1';
            }
          } catch(err) {
            loginError.innerText = 'Network error. Try again.';
            loginError.style.display = 'block';
            addAddressBtn.innerText = 'Add address';
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
        // Change Banner
        const promoBanner = document.getElementById('cf-promo-banner');
        promoBanner.innerText = 'EXTRA 1% DISCOUNT ON UPI';
        
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
         document.getElementById('cf-shipping-card').style.display = 'none';
         document.getElementById('cf-bottom-bar').style.display = 'none';
      };

      const showPaymentStep = () => {
         document.getElementById('cf-shipping-card').style.display = 'block';
         document.getElementById('cf-checkout-form').style.display = 'block';
         document.getElementById('cf-bottom-bar').style.display = 'block';
         fetchConfigAndRenderPayments();
      };

      // ======== PAYMENT LOGIC ========
      const renderPaymentOptions = () => {
        const container = document.getElementById('cf-payment-options');
        if (!container) return;
        
        let html = '';
        
        const getDiscountTag = () => {
          if (!widgetConfig.isPrepaidDiscountEnabled) return '';
          const txt = widgetConfig.prepaidDiscountType === 'percentage' ? \`\${widgetConfig.prepaidDiscountValue}%\` : \`₹\${widgetConfig.prepaidDiscountValue}\`;
          return \`<span style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; background:#ecfdf5; color:#059669; font-size:0.75rem; font-weight:600; padding:4px 8px; border-radius:12px;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6 6 1-4.5 4.5 1 6L12 16l-5.5 3 1-6L3 9l6-1 3-6z"/></svg> Get \${txt} off</span>\`;
        };

        const renderOption = (val, title, subtitle, iconHtml, isFirst, isPrepaid) => {
          return \`
            <label style="display:flex; align-items:flex-start; justify-content:space-between; padding:16px; cursor:pointer; border-bottom:\${isFirst ? '1px solid #e5e7eb' : '1px solid #e5e7eb'}; background:#fff; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'">
              <div style="display:flex; align-items:flex-start; gap:16px;">
                <div style="width:40px; height:40px; border-radius:12px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; background:#fff;">
                  \${iconHtml}
                </div>
                <div>
                  <div style="display:flex; align-items:center;">
                    <span style="font-weight:600; color:#1f2937; font-size:0.95rem;">\${title}</span>
                  </div>
                  <div style="color:#6b7280; font-size:0.8rem; margin-top:2px;">
                    \${subtitle}
                  </div>
                  \${isPrepaid ? getDiscountTag() : ''}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:12px; margin-top:4px;">
                <span id="cf-price-\${val}" style="font-weight:600; color:#374151; font-size:0.95rem;"></span>
                <svg width="16" height="16" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                <input type="radio" name="payment" value="\${val}" \${val==='UPI' ? 'checked' : ''} onchange="window.cfUpdatePricing()" style="display:none;" />
              </div>
            </label>
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
          html += renderOption('PartialCOD', 'Partial COD', \`Pay ₹\${widgetConfig.partialCodAmount} now, rest on delivery\`, icons.cod, false, false);
        }
        
        html += renderOption('COD', 'Cash on Delivery', 'Pay when you receive', icons.cod, false, false);
        
        container.innerHTML = html;
        if (!widgetConfig.hasRazorpay) {
          const codEl = document.querySelector('input[name="payment"][value="COD"]');
          if(codEl) codEl.checked = true;
        }
        window.cfUpdatePricing();
      };
      
      window.cfUpdatePricing = () => { if(typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing(); };

      const fetchConfigAndRenderPayments = () => {
        fetch(\`\${apiBaseUrl}/api/widget/config?shop=\${shop}\`)
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              widgetConfig = data.config;
              renderPaymentOptions();
            }
          });
      };

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
        
        const radios = document.querySelectorAll('input[name="payment"]');
        radios.forEach(radio => {
          const val = radio.value;
          const priceEl = document.getElementById(\`cf-price-\${val}\`);
          if (!priceEl) return;
          
          if (['UPI', 'Card', 'Wallet', 'Netbanking'].includes(val) && widgetConfig.isPrepaidDiscountEnabled) {
            let pd = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
            priceEl.innerText = \`₹\${Math.max(0, subtotal - discountAmount - pd).toLocaleString('en-IN')}\`;
          } else if (val === 'PartialCOD') {
            priceEl.innerText = \`₹\${widgetConfig.partialCodAmount}\`;
          } else {
            priceEl.innerText = \`₹\${Math.max(0, subtotal - discountAmount).toLocaleString('en-IN')}\`;
          }
        });

        document.getElementById('cf-item-total').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-qty-display').innerText = currentQuantity;
        document.getElementById('cf-summary-qty-header').innerText = \`\${currentQuantity} item\`;
        document.getElementById('cf-summary-subtotal').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        
        let totalSavings = discountAmount + prepaidDiscount;
        if (totalSavings > 0) {
          document.getElementById('cf-summary-discount-row').style.display = 'flex';
          document.getElementById('cf-summary-discount-value').innerText = \`-₹\${totalSavings.toLocaleString('en-IN')}\`;
        } else {
          document.getElementById('cf-summary-discount-row').style.display = 'none';
        }
        
        document.getElementById('cf-summary-total').innerText = \`₹\${finalTotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-header-total').innerText = \`₹\${finalTotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-submit-order').innerText = \`Pay ₹\${finalTotal.toLocaleString('en-IN')}\`;
      };

      // Apply initial styling check
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
            msgEl.innerText = "Discount code applied!";
            msgEl.style.display = 'block';
            window.internalUpdatePricing();
          } else {
            alert("Invalid or expired code");
          }
        } catch(e) {}
      };

      // FINAL SUBMIT (from force_rewrite.js logic)
      document.getElementById('cf-submit-order').onclick = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('cf-submit-order');
        submitBtn.innerText = 'Processing...';
        submitBtn.style.opacity = '0.7';
        submitBtn.disabled = true;

        const paymentMethodEl = document.querySelector('input[name="payment"]:checked');
        const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'COD';
        
        const isPrepaid = ['UPI', 'Card', 'Wallet', 'Netbanking'].includes(paymentMethod);
        const isPartialCod = paymentMethod === 'PartialCOD';

        const subtotal = basePrice * currentQuantity;
        let prepaidDiscount = 0;
        if (typeof widgetConfig !== 'undefined' && widgetConfig && widgetConfig.isPrepaidDiscountEnabled && isPrepaid) {
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
              submitBtn.innerText = 'Redirecting...';
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
              if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            }
          } catch(err) {
            alert('Network error. Please try again.');
            if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
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
              if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
              return;
            }

            const options = {
              key: rzpOrderData.keyId,
              amount: rzpOrderData.amount,
              currency: "INR",
              name: shop.split('.')[0].toUpperCase(),
              description: "Order Payment",
              order_id: rzpOrderData.orderId,
              handler: async function (response) {
                submitBtn.innerText = 'Verifying...';
                const verifyRes = await fetch(\`\${apiBaseUrl}/api/checkout/verify-payment\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    shop,
                    razorpay_order_id: response.razorpay_order_id,
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
                  if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
                  submitBtn.disabled = false;
                  submitBtn.style.opacity = '1';
                }
              },
              prefill: {
                name: document.getElementById('cf-name').value,
                email: document.getElementById('cf-email').value,
                contact: verifiedPhone
              },
              theme: { color: "#111827" },
              modal: {
                ondismiss: function() {
                  if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
                  submitBtn.disabled = false;
                  submitBtn.style.opacity = '1';
                }
              }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
              alert('Payment failed. Reason: ' + response.error.description);
              if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            });
            rzp.open();
          } catch(e) {
            alert('Error initiating payment.');
            if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
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
