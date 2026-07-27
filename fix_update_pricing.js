const fs = require('fs');
let content = fs.readFileSync('template_v3.js', 'utf8');

// Replace Original price in header logic
const origOld = `        // Original price in header
        if(totalDiscount > 0) {
           widgetRoot.getElementById('osOrigPrice').style.display = 'inline';
           widgetRoot.getElementById('osOrigPrice').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        } else {
           widgetRoot.getElementById('osOrigPrice').style.display = 'none';
        }`;

const origNew = `        // Original price in header
        const osOrigPrice = widgetRoot.getElementById('osOrigPrice');
        if(osOrigPrice) {
           if(totalDiscount > 0) {
              osOrigPrice.style.display = 'inline';
              osOrigPrice.innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
           } else {
              osOrigPrice.style.display = 'none';
           }
        }`;
content = content.replace(origOld, origNew);

// Replace Green Save Banner logic
const saveOld = `        // Green Save Banner
        if(couponDiscount > 0) {
           widgetRoot.getElementById('osSaveBanner').style.display = 'block';
           widgetRoot.getElementById('osSaveAmt').innerText = \`₹\${Math.round(couponDiscount).toLocaleString('en-IN')}\`;
        } else {
           widgetRoot.getElementById('osSaveBanner').style.display = 'none';
        }`;

const saveNew = `        // Green Save Banner
        const osSaveBanner = widgetRoot.getElementById('osSaveBanner');
        const osSaveAmt = widgetRoot.getElementById('osSaveAmt');
        if(osSaveBanner) {
           if(couponDiscount > 0) {
              osSaveBanner.style.display = 'block';
              if(osSaveAmt) osSaveAmt.innerText = \`₹\${Math.round(couponDiscount).toLocaleString('en-IN')}\`;
           } else {
              osSaveBanner.style.display = 'none';
           }
        }`;
content = content.replace(saveOld, saveNew);

// Replace Coupon Box in Order Summary Bar logic
const cpnOld = `        // Coupon Box in Order Summary Bar
        if(appliedCoupon) {
           widgetRoot.getElementById('osCpnEmpty').style.display = 'none';
           widgetRoot.getElementById('osCpnActive').style.display = 'inline-flex';
           widgetRoot.getElementById('osCpnCode').innerText = appliedCoupon.code;
           widgetRoot.getElementById('osCpnSave').innerText = \`Save ₹\${Math.round(couponDiscount).toLocaleString('en-IN')}\`;
           const _t = widgetRoot.getElementById('osCpnLinkText'); if(_t) _t.innerText = 'Change >';
        } else {
           widgetRoot.getElementById('osCpnEmpty').style.display = 'block';
           widgetRoot.getElementById('osCpnActive').style.display = 'none';
           const _t2 = widgetRoot.getElementById('osCpnLinkText'); if(_t2) _t2.innerText = 'Enter a Coupon >';
        }`;

const cpnNew = `        // Coupon Box in Order Summary Bar
        const osCpnEmpty = widgetRoot.getElementById('osCpnEmpty');
        const osCpnActive = widgetRoot.getElementById('osCpnActive');
        const osCpnCode = widgetRoot.getElementById('osCpnCode');
        const osCpnSave = widgetRoot.getElementById('osCpnSave');
        if(appliedCoupon) {
           if(osCpnEmpty) osCpnEmpty.style.display = 'none';
           if(osCpnActive) osCpnActive.style.display = 'inline-flex';
           if(osCpnCode) osCpnCode.innerText = appliedCoupon.code;
           if(osCpnSave) osCpnSave.innerText = \`Save ₹\${Math.round(couponDiscount).toLocaleString('en-IN')}\`;
           const _t = widgetRoot.getElementById('osCpnLinkText'); if(_t) _t.innerText = 'Change >';
        } else {
           if(osCpnEmpty) osCpnEmpty.style.display = 'block';
           if(osCpnActive) osCpnActive.style.display = 'none';
           const _t2 = widgetRoot.getElementById('osCpnLinkText'); if(_t2) _t2.innerText = 'Enter a Coupon >';
        }`;
content = content.replace(cpnOld, cpnNew);

fs.writeFileSync('template_v3.js', content);
console.log('Fixed DOM null references in updatePricing');
