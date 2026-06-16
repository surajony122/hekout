const fs = require('fs');
let content = fs.readFileSync('src/app/api/create-order/route.ts', 'utf8');

// 1. Remove appliedDiscounts from destructuring
content = content.replace(/appliedDiscounts, /g, '');

// 2. Remove couponDiscountAmount logic
const couponAmountLogic = `    let totalDiscount = 0;
    let couponDiscountAmount = 0;
    let couponCodeStr = null;
    
    if (appliedDiscounts && appliedDiscounts.length > 0) {
      couponCodeStr = appliedDiscounts.map((d: any) => d.code).join(', ');
      for (const d of appliedDiscounts) {
        if (d.type === 'percentage') {
          couponDiscountAmount += total * (d.value / 100);
        } else if (d.type === 'fixed_amount') {
          couponDiscountAmount += d.value;
        }
      }
      totalDiscount += couponDiscountAmount;
    }`;
content = content.replace(couponAmountLogic, `    let totalDiscount = 0;`);

// 3. Remove couponDiscount and couponCode from order creation
content = content.replace(/        couponDiscount: couponDiscountAmount,\n/g, '');
content = content.replace(/        couponCode: couponCodeStr,\n/g, '');

// 4. Remove freebie product logic
const freebieLogic = `    if (appliedDiscounts && appliedDiscounts.length > 0) {
      for (const d of appliedDiscounts) {
        if (d.type === 'freebie_product' && d.freebieName) {
          lineItems.push({
            title: d.freebieName,
            price: '0.00',
            quantity: 1,
            applied_discount: {
              description: d.code,
              value: '100.0',
              value_type: 'percentage',
              amount: '0.00'
            }
          });
        }
      }
    }`;
content = content.replace(freebieLogic, '');

// 5. Update draftPayload applied_discount
const oldAppliedDiscount = `        applied_discount: couponDiscountAmount > 0 ? {
          description: couponCodeStr || 'Discount',
          value_type: 'fixed_amount',
          value: couponDiscountAmount.toString()
        } : (prepaidDiscount ? {
          description: 'Prepaid Discount',
          value_type: 'fixed_amount',
          value: prepaidDiscount.toString()
        } : undefined),`;
const newAppliedDiscount = `        applied_discount: prepaidDiscount ? {
          description: 'Prepaid Discount',
          value_type: 'fixed_amount',
          value: prepaidDiscount.toString()
        } : undefined,`;
content = content.replace(oldAppliedDiscount, newAppliedDiscount);

// 6. Update tags and note
const oldNote = "        note: `Discounts applied. ${couponCodeStr ? 'Coupons: ' + couponCodeStr : ''}`";
const newNote = "        note: `Order via CheckoutFlow`";
content = content.replace(oldNote, newNote);

fs.writeFileSync('src/app/api/create-order/route.ts', content);
console.log('API Cleaned');
