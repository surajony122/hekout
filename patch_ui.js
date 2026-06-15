const fs = require('fs');

let content = fs.readFileSync('rewrite_ui.js', 'utf8');

// 1. Array declaration
content = content.replace(/let appliedDiscount = null;/g, 'let appliedDiscounts = [];');

// 2. Config autoDiscount handling
content = content.replace(
  /if \(widgetConfig\.autoDiscount && !appliedDiscount\) {\s*appliedDiscount = widgetConfig\.autoDiscount;\s*}/,
  `if (widgetConfig.autoDiscounts && widgetConfig.autoDiscounts.length > 0 && appliedDiscounts.length === 0) {
            const total = price * quantity;
            for (const ad of widgetConfig.autoDiscounts) {
              try {
                const valRes = await fetch(\`\${apiBaseUrl}/api/validate-discount\`, {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ shop, code: ad.code, cartTotal: total, variantId, appliedDiscounts })
                });
                const d = await valRes.json();
                if (d.success && d.valid) {
                  appliedDiscounts.push(d.discount);
                }
              } catch(e) {}
            }
          }`
);

// 3. UI section (Remove old appliedDiscount logic from input)
content = content.replace(
  /<input type="text" id="cf-discount".*?\/>/,
  `<input type="text" id="cf-discount" class="cf-input" placeholder="Enter coupon code" style="border:none; box-shadow:none; padding:10px 12px; flex:1; background:transparent; font-size:1rem;" value="" />`
);
content = content.replace(
  /<button type="button" id="cf-apply-discount".*?<\/button>/,
  `<button type="button" id="cf-apply-discount" style="background:\${primaryColor}15; color:\${primaryColor}; border-radius:8px; border:none; padding:8px 16px; font-weight:600; cursor:pointer; transition:all 0.2s;">Apply</button>`
);
content = content.replace(
  /<div id="cf-discount-msg".*?<\/div>/,
  `<div id="cf-discount-msg" style="color:#059669; font-size:0.85rem; font-weight:500; margin-top:-10px; margin-bottom:16px; padding-left:8px; display:none;"></div>
   <div id="cf-discount-tags" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;"></div>`
);

// 4. Update internalUpdatePricing
const oldUpdatePricingStart = `        if (appliedDiscount) {
          if (appliedDiscount.type === 'percentage') {
            discountAmount = subtotal * (appliedDiscount.value / 100);
          } else if (appliedDiscount.type === 'fixed_amount') {
            discountAmount = appliedDiscount.value;
          }
        }`;
const newUpdatePricingStart = `        for (const ad of appliedDiscounts) {
          if (ad.type === 'percentage') {
            discountAmount += subtotal * (ad.value / 100);
          } else if (ad.type === 'fixed_amount') {
            discountAmount += ad.value;
          }
        }
        
        // Render tags
        const tagsContainer = document.getElementById('cf-discount-tags');
        if (tagsContainer) {
          tagsContainer.innerHTML = appliedDiscounts.map(ad => 
            \`<div style="background:#ecfdf5; color:#059669; padding:4px 8px; border-radius:16px; font-size:0.75rem; font-weight:600; display:flex; align-items:center; gap:4px;">
              \${ad.code} \${ad.type === 'freebie_product' ? '(Free Gift)' : ''}
              <span class="cf-remove-tag" data-code="\${ad.code}" style="cursor:pointer; font-size:1rem; line-height:1;">&times;</span>
            </div>\`
          ).join('');
          
          document.querySelectorAll('.cf-remove-tag').forEach(el => {
            el.onclick = (e) => {
              const c = e.target.getAttribute('data-code');
              appliedDiscounts = appliedDiscounts.filter(d => d.code !== c);
              window.internalUpdatePricing();
            };
          });
        }
`;
content = content.replace(oldUpdatePricingStart, newUpdatePricingStart);

// 5. Update summary text
content = content.replace(
  /if \(appliedDiscount && appliedDiscount\.type === 'freebie_product'\) {([\s\S]*?)}/,
  `const freebies = appliedDiscounts.filter(d => d.type === 'freebie_product');
        if (freebies.length > 0) {
          document.getElementById('cf-summary-discount-text').innerText = 'Freebie Applied';
          document.getElementById('cf-summary-discount-value').innerText = freebies.map(f => f.freebieName).join(', ');
          document.getElementById('cf-summary-discount-row').style.display = 'flex';
        }`
);

// 6. cf-apply-discount logic
const oldApplyLogic = `        if (appliedDiscount) {
          appliedDiscount = null;
          inputEl.value = '';
          btn.innerText = 'Apply';
          msgEl.style.display = 'none';
          window.internalUpdatePricing();
          return;
        }

        const code = inputEl.value.trim();
        if(!code) return;
        
        btn.innerText = '...';
        
        try {
          const res = await fetch(\`\${apiBaseUrl}/api/validate-discount\`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, code })
          });
          const data = await res.json();
          
          if (data.success && data.valid) {
            appliedDiscount = data.discount;
            btn.innerText = 'Remove';
            msgEl.innerText = "🎉 Coupon Applied!";
            msgEl.style.display = 'block';
            msgEl.style.color = '#059669';
            window.internalUpdatePricing();
            if (window.confetti) {
              window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
          } else {
            btn.innerText = 'Apply';
            msgEl.innerText = data.error || "Invalid discount code";
            msgEl.style.display = 'block';
            msgEl.style.color = '#ef4444';
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
          }
        } catch(e) {
          btn.innerText = 'Apply';
        }`;

const newApplyLogic = `        const code = inputEl.value.trim();
        if(!code) return;
        btn.innerText = '...';
        try {
          const res = await fetch(\`\${apiBaseUrl}/api/validate-discount\`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ shop, code, cartTotal: (price * currentQuantity), variantId, appliedDiscounts })
          });
          const data = await res.json();
          btn.innerText = 'Apply';
          
          if (data.success && data.valid) {
            if (data.discount.isCombinable) {
               const hasNonCombinable = appliedDiscounts.some(d => !d.isCombinable);
               if (hasNonCombinable) appliedDiscounts = [data.discount];
               else if(!appliedDiscounts.find(d => d.code === data.discount.code)) appliedDiscounts.push(data.discount);
            } else {
               appliedDiscounts = [data.discount];
            }
            inputEl.value = '';
            msgEl.innerText = "🎉 Coupon Applied!";
            msgEl.style.display = 'block';
            msgEl.style.color = '#059669';
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
            window.internalUpdatePricing();
            if (window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
          } else {
            msgEl.innerText = data.error || "Invalid discount code";
            msgEl.style.display = 'block';
            msgEl.style.color = '#ef4444';
            setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
          }
        } catch(e) {
          btn.innerText = 'Apply';
        }`;

content = content.replace(oldApplyLogic, newApplyLogic);

// 7. create-order fetch
const oldCreateOrderPayload = `          appliedDiscount: appliedDiscount ? { code: appliedDiscount.code, type: appliedDiscount.type, value: appliedDiscount.value } : null,`;
const newCreateOrderPayload = `          appliedDiscounts: appliedDiscounts,`;
content = content.replace(oldCreateOrderPayload, newCreateOrderPayload);

fs.writeFileSync('rewrite_ui.js', content, 'utf8');
console.log('UI Patched Successfully');
