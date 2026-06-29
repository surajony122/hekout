const fs = require('fs');
let file = fs.readFileSync('template_v3.js', 'utf8');

// 1. Add state variables at top of template
file = file.replace(/let checkoutFlowState = 'loading';/, "let checkoutFlowState = 'loading';\nlet activeUpsell = null;\nlet upsellAccepted = false;");

// 2. Add API fetch inside open() function
const fetchUpsellCode = `
      const loadUpsell = async () => {
         try {
            const res = await fetch(\`\${apiBaseUrl}/api/upsell/active?shop=\${shop}&variantId=\${variantId}\`);
            const data = await res.json();
            if (data && data.active && data.offer) {
               activeUpsell = data.offer;
               
               // Inject UI above payment methods
               const payContainer = document.getElementById('pay-methods-container');
               const upsellBox = document.createElement('div');
               upsellBox.innerHTML = \`
                  <div style="background:var(--bg); border:1px solid var(--green); border-radius:12px; padding:12px; margin-bottom:20px; display:flex; gap:12px; align-items:center;">
                     <div style="flex:1;">
                        <div style="color:var(--green); font-size:12px; font-weight:700; margin-bottom:4px;">🔥 SPECIAL OFFER</div>
                        <div style="font-size:14px; font-weight:600; color:var(--text1); line-height:1.2;">Add \${activeUpsell.title}</div>
                        <div style="font-size:13px; color:var(--text2); margin-top:4px;">
                           <span style="text-decoration:line-through; color:var(--text3); font-size:12px; margin-right:4px;">₹\${activeUpsell.originalPrice}</span>
                           <span style="font-weight:600; color:var(--text1);">₹\${activeUpsell.price}</span>
                        </div>
                     </div>
                     <div>
                        <label style="display:flex; align-items:center; cursor:pointer; background:var(--green); color:white; padding:6px 12px; border-radius:8px; font-size:13px; font-weight:600;">
                           <input type="checkbox" id="cf-upsell-check" style="margin-right:8px; width:16px; height:16px;"> Add
                        </label>
                     </div>
                  </div>
               \`;
               payContainer.parentNode.insertBefore(upsellBox, payContainer);
               
               document.getElementById('cf-upsell-check').addEventListener('change', (e) => {
                  upsellAccepted = e.target.checked;
                  updateTotals();
               });
            }
         } catch(e) {}
      };
      loadUpsell();
`;

file = file.replace(/const autoApplyCoupon = \(\) => \{/, fetchUpsellCode + "\n      const autoApplyCoupon = () => {");

// 3. Update Totals calculation
const totalsRegex = /const calculateTotals = \(\) => \{[\s\S]*?let subtotal = total;/;
file = file.replace(totalsRegex, `const calculateTotals = () => {
         let subtotal = total;
         if (upsellAccepted && activeUpsell) {
            subtotal += activeUpsell.price;
         }`);

// 4. Update cfExecutePayment payload
file = file.replace(/appliedCoupon: window.cfAppliedCoupon/g, "appliedCoupon: window.cfAppliedCoupon, upsellVariantId: (upsellAccepted && activeUpsell) ? activeUpsell.variantId : null");

fs.writeFileSync('template_v3.js', file);
console.log('Upsell UI injected successfully!');
