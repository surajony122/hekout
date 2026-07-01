const fs = require('fs');
let content = fs.readFileSync('template_v3.js', 'utf8');

// 1. Add id="osCpnLinkText" to Coupon card title
content = content.replace(
  '<div class="card-title" style="color: #f97316;">Apply Coupon</div>',
  '<div class="card-title" style="color: #f97316;" id="osCpnLinkText">Apply Coupon</div>'
);

// 2. Add onclick to the coupon card directly (since id might be used elsewhere)
content = content.replace(
  '<div class="design-card solid-border" id="osCpnLink" style="margin-bottom: 24px;">',
  '<div class="design-card solid-border" id="osCpnLink" style="margin-bottom: 24px;" onclick="widgetRoot.getElementById(\'drwCoupon\').style.display=\'flex\'">'
);

// 3. Fix sumHdr JS error (safeguard)
content = content.replace(
  "widgetRoot.getElementById('sumHdr').onclick = () => { widgetRoot.getElementById('drwBill').style.display='flex'; };",
  "const sumHdr = widgetRoot.getElementById('sumHdr'); if (sumHdr) sumHdr.onclick = () => { widgetRoot.getElementById('drwBill').style.display='flex'; };"
);

// 4. Fix osCpnLink JS error (safeguard)
content = content.replace(
  "widgetRoot.getElementById('osCpnLink').onclick = () => { widgetRoot.getElementById('drwCoupon').style.display='flex'; };",
  "const cpnL = widgetRoot.getElementById('osCpnLink'); if(cpnL) cpnL.onclick = () => { widgetRoot.getElementById('drwCoupon').style.display='flex'; };"
);

// 5. Update osCpnLink text assignments to use osCpnLinkText
content = content.replace(
  "widgetRoot.getElementById('osCpnLink').innerText = 'Change >';",
  "const _t = widgetRoot.getElementById('osCpnLinkText'); if(_t) _t.innerText = 'Change >';"
);
content = content.replace(
  "widgetRoot.getElementById('osCpnLink').innerText = 'Enter a Coupon >';",
  "const _t2 = widgetRoot.getElementById('osCpnLinkText'); if(_t2) _t2.innerText = 'Enter a Coupon >';"
);

fs.writeFileSync('template_v3.js', content);
console.log('Fixed JS bindings in template_v3.js');
