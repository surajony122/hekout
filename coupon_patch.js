const fs = require('fs');
let file = fs.readFileSync('template_v3.js', 'utf8');

// Update autoApplyCoupon to handle clearing invalid coupons
const newAutoApply = `
      const autoApplyCoupon = () => {
         const subtotal = basePrice * currentQuantity;
         
         // 1. Check if currently applied coupon is still valid
         if (appliedCoupon) {
             if (currentQuantity < appliedCoupon.minItems || subtotal < appliedCoupon.minCartValue) {
                 appliedCoupon = null; // Clear it if invalid
             }
         }
         
         // 2. Try to find a valid auto-apply coupon if none applied
         if (!appliedCoupon) {
             const validAuto = availableCoupons.filter(c => c.isAuto && currentQuantity >= c.minItems && subtotal >= c.minCartValue);
             if(validAuto.length > 0) {
                // Sort by value (descending) to apply the best one
                validAuto.sort((a,b) => {
                   let aVal = a.type === 'percentage' ? subtotal * (a.value/100) : a.value;
                   let bVal = b.type === 'percentage' ? subtotal * (b.value/100) : b.value;
                   if(a.maxDiscount) aVal = Math.min(aVal, a.maxDiscount);
                   if(b.maxDiscount) bVal = Math.min(bVal, b.maxDiscount);
                   return bVal - aVal;
                });
                appliedCoupon = validAuto[0];
                if(window.launchConfetti) window.launchConfetti();
             }
         }
      };
`;

file = file.replace(
  /const autoApplyCoupon = \(\) => \{[\s\S]*?\};/, 
  newAutoApply.trim()
);

// Inject autoApplyCoupon and renderCoupons inside updatePricing
file = file.replace(
  /const updatePricing = \(method = null\) => \{/,
  "const updatePricing = (method = null) => {\n        autoApplyCoupon();\n        renderCoupons();\n"
);

fs.writeFileSync('template_v3.js', file);
console.log('Coupon logic patched successfully!');
