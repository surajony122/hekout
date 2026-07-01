const fs = require('fs');
let content = fs.readFileSync('template_v3.js', 'utf8');

const replacement = `
         const methods = [
            { id: 'UPI', name: 'Pay via UPI', sub: 'GPay · PhonePe · Paytm · BHIM', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:none;fill:var(--p1);"><path d="M16 11.5v-3h-3v3h-2v-5h7v5h-2zM5.5 13.5h3v-2h-3v2zm0-4h3v-2h-3v2zm9 4h3v-2h-3v2zm-4 0h3v-2h-3v2zm-5 4h5v-2h-5v2zm9 0h3v-2h-3v2zM22 2H2v20h20V2zm-2 18H4V4h16v16z"/></svg>' },
            { id: 'Card', name: 'Debit / Credit Cards', sub: 'Visa · Mastercard · RuPay', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:var(--p1);fill:none;stroke-width:2;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' },
            { id: 'Wallet', name: 'Wallets', sub: 'Paytm · PhonePe · Amazon Pay', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:var(--p1);fill:none;stroke-width:2;"><path d="M20 12V22H4V12"/><path d="M12 22V7M12 7a5 5 0 01-5-5 5 5 0 005 5z"/></svg>' },
            { id: 'Netbanking', name: 'Net Banking', sub: 'All Indian Banks', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:var(--p1);fill:none;stroke-width:2;"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>' },
            { id: 'COD', name: 'Cash on Delivery', sub: (widgetConfig.isCodFeeEnabled !== false && (widgetConfig.codFeeAmount || 0) > 0) ? \`Pay ₹\${widgetConfig.codFeeAmount} fee\` : 'Pay at doorstep', icon: '<svg viewBox="0 0 24 24" style="height:24px;stroke:#ea580c;fill:none;stroke-width:2;"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>' }
         ];

         methods.forEach(m => {
            if (m.id !== 'COD' && !widgetConfig.hasRazorpay) return; // Skip online methods if RP disabled

            // Drawer
            if (m.id === 'COD') {
              dHtml += \`
                <div class="cf-payment-overlay" id="drw\${m.id}" style="display:none; position:fixed; inset:0; background:rgba(30,27,75,0.5); z-index:200; align-items:flex-end;" onclick="this.style.display='none'">
                  <div class="cf-payment-drawer" style="width:100%; max-width:400px; margin:0 auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px;" onclick="event.stopPropagation()">
                     <div style="font-size:18px; font-weight:600; margin-bottom:16px;">\${m.name}</div>
                     <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="cf-btn" onclick="widgetRoot.getElementById('drw\${m.id}').style.display='none'; window.cfExecutePayment('UPI')" id="cod-save-btn" style="background:var(--green);">Pay Online (Save)</button>
                        <button class="cf-btn" onclick="window.cfExecutePayment('\${m.id}')" id="cod-confirm-btn" style="background:var(--surface); color:var(--text-main); border:1.5px solid var(--border); box-shadow:none;">Confirm COD</button>
                     </div>
                  </div>
                </div>
              \`;
            }

            // Row
            let offerTxt = '';
            if (m.id !== 'COD' && widgetConfig.isPrepaidDiscountEnabled && widgetConfig.prepaidDiscountValue > 0) {
                const discountText = widgetConfig.prepaidDiscountType === 'percentage' 
                    ? \`Extra \${widgetConfig.prepaidDiscountValue}% OFF\` 
                    : \`You save ₹\${widgetConfig.prepaidDiscountValue}\`;
                offerTxt = discountText;
            }

            const clickAction = m.id === 'COD' 
                ? \`window.cfUpdatePricing('\${m.id}'); widgetRoot.getElementById('drw\${m.id}').style.display='flex'\`
                : \`window.cfUpdatePricing('\${m.id}'); window.cfExecutePayment('\${m.id}')\`;

            html += \`
              <div class="pay-card \${m.id==='UPI' ? 'active' : ''}" onclick="\${clickAction}">
                \${m.id==='UPI' ? '<div class="recommended-tag"><svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> Recommended</div>' : ''}
                <div class="pay-icon-box">
                  \${m.icon}
                </div>
                <div class="pay-content">
                  <div class="pay-title">\${m.name}</div>
                  <div class="pay-subtitle">\${m.sub}</div>
                  \${offerTxt ? \`<div class="pay-savings">\${offerTxt}</div>\` : ''}
                </div>
                <div class="pay-right">
                  <div class="pay-price \${m.id==='COD' ? 'red' : ''}" id="pp\${m.id}"></div>
                  <div class="arrow-circle">
                    <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
              </div>
            \`;
         });`;

const startMarker = "const methods = [";
const endMarker = "container.innerHTML = html;";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + replacement + '\n         ' + content.substring(endIndex);
  fs.writeFileSync('template_v3.js', content);
  console.log('Successfully updated payment methods in template_v3.js');
} else {
  console.log('Markers not found for payment methods!');
}
