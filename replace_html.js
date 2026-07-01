const fs = require('fs');

const newHtml = `
        <canvas id="confetti-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1000;"></canvas>

        <div class="top-header">
          <div class="back-btn" id="cf-close-btn">
            <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </div>
          <div class="brand-center">
            \${widgetConfig.brandLogoUrl ? \`<img src="\${widgetConfig.brandLogoUrl}" alt="Logo" style="max-height:28px; object-fit:contain;"/>\` : \`<div class="brand-title">\${(widgetConfig.storeName || shop.split('.')[0]).substring(0,18)}</div>\`}
            <div class="brand-subtitle"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Secure Checkout</div>
          </div>
        </div>

        <div class="scroll-body">
          <div class="promo-banner" id="dynamic-banner">
            <svg viewBox="0 0 24 24"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="18.5" r="2.5"/></svg>
            <span class="promo-text">\${widgetConfig.preLoginBannerText || '<strong>FREE SHIPPING</strong> on all orders today! 🎉'}</span>
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
                  <div class="card-title">Order Summary (<span id="osItemCount">\${totalQuantity}</span> Item) <svg class="chevron-icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div>
                  <div class="card-subtitle">Total Amount</div>
               </div>
               <div class="card-price-col">
                  <div class="card-price" id="hFinal">₹\${total.toLocaleString('en-IN')}</div>
                  <div class="card-price-sub" id="osFinalPrice">₹\${total.toLocaleString('en-IN')}</div>
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
`;

let content = fs.readFileSync('template_v3.js', 'utf8');

const startMarker = '<canvas id="confetti-canvas"';
const endMarker = '<!-- DRAWERS WRAPPER -->';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newHtml + '        ' + content.substring(endIndex);
  fs.writeFileSync('template_v3.js', content);
  console.log('Successfully updated HTML structure in template_v3.js');
} else {
  console.log('Markers not found!');
}
