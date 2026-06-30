const fs = require('fs');
let file = fs.readFileSync('template_v3.js', 'utf8');

// We need to add shippingFee logic to updatePricing.
// First, find the pricing calculation block
const oldCalc = `
        let prepaidDiscount = 0;
        let codFee = 0;
        
        if (currentPaymentMethod === 'COD') {
           codFee = widgetConfig.codFeeAmount || 0;
        } else if (currentPaymentMethod !== null && widgetConfig.isPrepaidDiscountEnabled) {
           prepaidDiscount = widgetConfig.prepaidDiscountType === 'percentage' ? subtotal * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
        }
        
        currentCouponDiscount = couponDiscount;
        const totalDiscount = couponDiscount + prepaidDiscount;
        const grandTotal = Math.max(0, subtotal - totalDiscount) + codFee;
`;

const newCalc = `
        let prepaidDiscount = 0;
        let codFee = 0;
        let shippingFee = 0;
        
        const threshold = widgetConfig.freeShippingThreshold || 999;
        if (subtotal < threshold) {
            shippingFee = widgetConfig.shippingFeeAmount || 0;
        }
        
        if (currentPaymentMethod === 'COD') {
           codFee = widgetConfig.codFeeAmount || 0;
        } else if (currentPaymentMethod !== null && widgetConfig.isPrepaidDiscountEnabled) {
           prepaidDiscount = widgetConfig.prepaidDiscountType === 'percentage' ? (subtotal - couponDiscount) * (widgetConfig.prepaidDiscountValue/100) : widgetConfig.prepaidDiscountValue;
        }
        
        currentCouponDiscount = couponDiscount;
        const totalDiscount = couponDiscount + prepaidDiscount;
        const grandTotal = Math.max(0, subtotal - totalDiscount) + codFee + shippingFee;
`;

file = file.replace(oldCalc.trim(), newCalc.trim());

// We also need to update the Drawer and Payment Method buttons to include shippingFee
const oldDrawer1 = `document.getElementById('tGrand').innerText = \\\`₹\${grandTotal.toLocaleString('en-IN')}\\\`;`;
const newDrawer1 = `document.getElementById('tGrand').innerText = \`₹\${grandTotal.toLocaleString('en-IN')}\`;
        const shipRow = document.getElementById('trShip');
        if (shipRow) {
           if (shippingFee > 0) {
              shipRow.style.display = 'flex';
              document.getElementById('tShipFee').innerText = \`₹\${shippingFee.toLocaleString('en-IN')}\`;
           } else {
              shipRow.style.display = 'none';
           }
        }`;
file = file.replace(oldDrawer1, newDrawer1);

// We need to inject the Shipping Row HTML into the drawer
const drawerHtmlOld = `<div class="tr discount" id="trDisc" style="display:none;"><span class="l">Discount on MRP</span><span class="v" id="tDisc">-₹0</span></div>
                <div class="tr" id="trCod" style="display:none;"><span class="l">COD Fee</span><span class="v" id="tCodFee">₹\${widgetConfig.codFeeAmount}</span></div>`;

const drawerHtmlNew = `<div class="tr discount" id="trDisc" style="display:none;"><span class="l">Discount on MRP</span><span class="v" id="tDisc">-₹0</span></div>
                <div class="tr" id="trShip" style="display:none;"><span class="l">Shipping Fee</span><span class="v" id="tShipFee">₹0</span></div>
                <div class="tr" id="trCod" style="display:none;"><span class="l">COD Fee</span><span class="v" id="tCodFee">₹\${widgetConfig.codFeeAmount}</span></div>`;
file = file.replace(drawerHtmlOld, drawerHtmlNew);

// Payment method button text logic:
const oldBtn1 = `el.innerText = \\\`₹\${Math.round(Math.max(0, subtotal - mDisc)).toLocaleString('en-IN')}\\\`;`;
const newBtn1 = `el.innerText = \`₹\${Math.round(Math.max(0, subtotal - mDisc) + shippingFee).toLocaleString('en-IN')}\`;`;
file = file.replace(oldBtn1, newBtn1);

const oldBtn2 = `elCod.innerText = \\\`₹\${Math.round(subtotal - couponDiscount + (widgetConfig.codFeeAmount || 0)).toLocaleString('en-IN')}\\\`;`;
const newBtn2 = `elCod.innerText = \`₹\${Math.round(subtotal - couponDiscount + shippingFee + (widgetConfig.codFeeAmount || 0)).toLocaleString('en-IN')}\`;`;
file = file.replace(oldBtn2, newBtn2);

const oldBtn3 = `elCodBtn.innerText = \\\`Confirm COD (₹\${Math.round(subtotal - couponDiscount + codFee).toLocaleString('en-IN')})\\\`;`;
const newBtn3 = `elCodBtn.innerText = \`Confirm COD (₹\${Math.round(subtotal - couponDiscount + shippingFee + codFee).toLocaleString('en-IN')})\`;`;
file = file.replace(oldBtn3, newBtn3);

fs.writeFileSync('template_v3.js', file);
console.log('Template v3 patched successfully!');
