const fs = require('fs');

// 1. Update CSS
let css = fs.readFileSync('new_styles.css', 'utf8');
if (!css.includes('@keyframes cf-spin')) {
  css += '\n@keyframes cf-spin { 100% { transform: rotate(360deg); } }\n';
  fs.writeFileSync('new_styles.css', css);
}

// 2. Update JS
let js = fs.readFileSync('template_v3.js', 'utf8');

// Fix global coupon discount state
js = js.replace(/let appliedCoupon = null;/, "let appliedCoupon = null;\n      let currentCouponDiscount = 0;");

// Fix updatePricing to store the value
js = js.replace(/const totalDiscount = couponDiscount \+ prepaidDiscount;/, "currentCouponDiscount = couponDiscount;\n        const totalDiscount = couponDiscount + prepaidDiscount;");

// Fix cfExecutePayment payload
js = js.replace(/appliedCoupon: appliedCoupon \? \{ code: appliedCoupon\.code, amount: Math\.round\(couponDiscount\) \} : undefined/, "appliedCoupon: appliedCoupon ? { code: appliedCoupon.code, amount: Math.round(currentCouponDiscount) } : undefined");

// Fix autoApplyCoupon throwing ReferenceError because I accidentally put it there earlier
js = js.replace(/let couponDiscount = 0;\s*if \(appliedCoupon\) \{\s*if\(appliedCoupon\.type === 'percentage'\) \{\s*couponDiscount = subtotal \* \(appliedCoupon\.value \/ 100\);\s*if\(appliedCoupon\.maxDiscount && couponDiscount > appliedCoupon\.maxDiscount\) couponDiscount = appliedCoupon\.maxDiscount;\s*\} else \{\s*couponDiscount = appliedCoupon\.value;\s*\}\s*\}/, "");

// Add spinner to button
js = js.replace(/if \(btn\) btn\.innerText = 'Processing\.\.\.';/, "if (btn) btn.innerHTML = '<div style=\"display:flex;align-items:center;justify-content:center;gap:8px;\"><svg style=\"width:18px;height:18px;animation:cf-spin 1s linear infinite;\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" stroke-width=\"4\" fill=\"none\" stroke-dasharray=\"31.4\" stroke-linecap=\"round\"></circle></svg> Processing...</div>';");

// Add confetti to autoApplyCoupon
js = js.replace(/appliedCoupon = validAuto\[0\];\s*updatePricing\(\);\s*renderCoupons\(\);/, "appliedCoupon = validAuto[0];\n            if(window.launchConfetti) window.launchConfetti();\n            updatePricing();\n            renderCoupons();");

// Add confetti to manual code
js = js.replace(/appliedCoupon = c;\s*document\.getElementById\('cpn-manual-input'\)\.value = '';\s*document\.getElementById\('drwCoupon'\)\.style\.display = 'none';\s*updatePricing\(\);\s*renderCoupons\(\);/, "appliedCoupon = c;\n         if(window.launchConfetti) window.launchConfetti();\n         document.getElementById('cpn-manual-input').value = '';\n         document.getElementById('drwCoupon').style.display = 'none';\n         updatePricing();\n         renderCoupons();");

// Add confetti to list apply
js = js.replace(/window\.cfApplyCoupon = \(id\) => \{\s*appliedCoupon = availableCoupons\.find\(c => c\.id === id\);\s*document\.getElementById\('drwCoupon'\)\.style\.display = 'none';\s*updatePricing\(\);\s*renderCoupons\(\);/, "window.cfApplyCoupon = (id) => {\n         appliedCoupon = availableCoupons.find(c => c.id === id);\n         if(window.launchConfetti) window.launchConfetti();\n         document.getElementById('drwCoupon').style.display = 'none';\n         updatePricing();\n         renderCoupons();");

fs.writeFileSync('template_v3.js', js);
console.log('Fixes applied successfully');
