const fs = require('fs');

let content = fs.readFileSync('public/widget.js', 'utf8');

// 1. Inject the renderPaymentOptions function right before updatePricingUI
const render_fn = `
      const renderPaymentOptions = () => {
        const container = document.getElementById('cf-payment-options');
        if (!container) return;
        
        let html = '';
        
        // Helper to format discount tag
        const getDiscountTag = () => {
          if (!widgetConfig.isPrepaidDiscountEnabled) return '';
          const txt = widgetConfig.prepaidDiscountType === 'percentage' ? \`\${widgetConfig.prepaidDiscountValue}%\` : \`₹\${widgetConfig.prepaidDiscountValue}\`;
          return \`<span style="display:inline-block; margin-left:8px; background:#ecfdf5; color:#059669; font-size:0.75rem; font-weight:600; padding:2px 6px; border-radius:4px;">% Get \${txt} off</span>\`;
        };

        const renderOption = (val, title, subtitle, iconHtml, isFirst, isPrepaid) => {
          return \`
            <label style="display:flex; align-items:center; justify-content:space-between; padding:16px; cursor:pointer; border-bottom:\${isFirst ? '1px solid #e5e7eb' : '1px solid #e5e7eb'}; background:#fff; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:36px; height:36px; border-radius:8px; border:1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; background:#f8fafc;">
                  \${iconHtml}
                </div>
                <div>
                  <div style="display:flex; align-items:center;">
                    <span style="font-weight:600; color:#1f2937; font-size:0.95rem;">\${title}</span>
                  </div>
                  <div style="color:#6b7280; font-size:0.8rem; margin-top:2px;">
                    \${subtitle}
                    \${isPrepaid ? getDiscountTag() : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span id="cf-price-\${val}" style="font-weight:600; color:#374151; font-size:0.95rem;"></span>
                <input type="radio" name="payment" value="\${val}" \${val==='UPI' ? 'checked' : ''} onchange="window.cfUpdatePricing()" style="width:18px; height:18px; accent-color:#10b981;" />
              </div>
            </label>
          \`;
        };

        const icons = {
          upi: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>\`,
          card: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>\`,
          wallet: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-8H6a2 2 0 0 0-2 2z"/></svg>\`,
          net: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>\`,
          cod: \`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>\`
        };

        if (widgetConfig.hasRazorpay) {
          html += renderOption('UPI', 'Pay via UPI', 'Google Pay, PhonePe & more', icons.upi, true, true);
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
          document.querySelector('input[name="payment"][value="COD"]').checked = true;
        }
        window.cfUpdatePricing();
      };
      
      // Global hook for radio buttons
      window.cfUpdatePricing = () => { if(typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing(); };

      // Fetch config earlier (we moved it here)
      fetch(\`\${apiBaseUrl}/api/widget/config?shop=\${shop}\`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            widgetConfig = data.config;
            renderPaymentOptions();
          }
        });
`;

content = content.replace("const updatePricingUI = () => {", render_fn + "\n      window.internalUpdatePricing = updatePricingUI;\n      const updatePricingUI = () => {");

// 2. Update updatePricingUI logic to handle prepaid discount
const pricing_logic = `
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
`;

content = content.replace("const finalTotal = Math.max(0, subtotal - discountAmount);", pricing_logic);

// Make internal hook available
content = content.replace("const updatePricingUI = () => {", "window.internalUpdatePricing = updatePricingUI;\n      const updatePricingUI = () => {");

fs.writeFileSync('public/widget.js', content, 'utf8');
console.log("Widget JS updated successfully.");
