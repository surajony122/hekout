const fs = require('fs');
let content = fs.readFileSync('rewrite_ui.js', 'utf8');

// The exact HTML to remove
const targetHtml = `            <!-- Offers & Rewards -->
            <div id="cf-offers-section">
              <div class="cf-card" style="padding:8px; display:flex; align-items:center; padding-left:16px; margin-bottom:16px;">
                <i class="ph ph-tag" style="font-size: 20px; color: #9ca3af;"></i>
                <input type="text" id="cf-discount" class="cf-input" placeholder="Enter coupon code" style="border:none; box-shadow:none; padding:10px 12px; flex:1; background:transparent; font-size:1rem;" value="" />
                <button type="button" id="cf-apply-discount" style="background:\${primaryColor}15; color:\${primaryColor}; border-radius:8px; border:none; padding:8px 16px; font-weight:600; cursor:pointer; transition:all 0.2s;">Apply</button>
              </div>
              <div id="cf-discount-msg" style="color:#059669; font-size:0.85rem; font-weight:500; margin-top:-10px; margin-bottom:16px; padding-left:8px; display:none;"></div>
   <div id="cf-discount-tags" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;"></div>
            </div>`;

content = content.replace(targetHtml, '');

// The summary row to remove
const summaryRowHtml = `                  <div id="cf-summary-discount-row" style="display:none; justify-content:space-between; margin-bottom:10px; color:#059669; font-weight:600;">
                    <span>Discount</span>
                    <span id="cf-summary-discount-value">-₹0</span>
                  </div>`;
                  
content = content.replace(summaryRowHtml, '');

// Clean appliedDiscounts from create-order post
content = content.replace(/,\s*appliedDiscounts: appliedDiscounts/g, '');

fs.writeFileSync('rewrite_ui.js', content, 'utf8');
console.log('HTML cleanup done');
