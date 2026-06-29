const fs = require('fs');
let file = fs.readFileSync('template_v3.js', 'utf8');

// Inject the progress bar UI exactly after the Deliver To block and before Payment Methods block
// We can actually just put it right above the 'Deliver to' or right inside 'Shipping'
// Let's replace the existing Shipping Card
const shippingCardRegex = /<!-- SHIPPING CARD -->[\s\S]*?<\/div>[\s\S]*?<\/div>/;
const dynamicShippingBox = `
            <!-- DYNAMIC SHIPPING TIER BAR -->
            <div class="card" style="padding:16px; margin-top:16px;" id="cf-shipping-tier-box">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <div style="font-size:13px; font-weight:600; color:var(--text1);" id="cf-shipping-msg">Calculating shipping...</div>
                  <div style="font-size:13px; font-weight:700; color:var(--text1);" id="cf-shipping-status"></div>
               </div>
               <div style="width:100%; height:6px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                  <div id="cf-shipping-bar" style="height:100%; width:0%; background:var(--green); transition:width 0.4s ease;"></div>
               </div>
            </div>
`;
file = file.replace(shippingCardRegex, dynamicShippingBox);

// Add the update logic inside `calculateTotals()`
const totalsLogic = `
         // Update Free Shipping Progress Bar
         const threshold = widgetConfig.freeShippingThreshold || 999;
         const remaining = threshold - subtotal;
         const bar = document.getElementById('cf-shipping-bar');
         const msg = document.getElementById('cf-shipping-msg');
         const status = document.getElementById('cf-shipping-status');
         
         if (bar && msg && status) {
            if (remaining > 0) {
               msg.innerHTML = \`Add <span style="color:var(--green)">₹\${remaining.toLocaleString('en-IN')}</span> more to get <b>Free Shipping!</b>\`;
               bar.style.width = \`\${(subtotal / threshold) * 100}%\`;
               status.innerText = "Standard";
            } else {
               msg.innerHTML = \`🎉 <b>You've unlocked Free Shipping!</b>\`;
               bar.style.width = '100%';
               status.innerHTML = \`<span style="color:var(--green)">FREE</span>\`;
            }
         }
`;
file = file.replace(/const calculateTotals = \(\) => \{[\s\S]*?let subtotal = total;[\s\S]*?\n/, match => match + totalsLogic + '\n');

fs.writeFileSync('template_v3.js', file);
console.log('Free Shipping progress bar injected!');
