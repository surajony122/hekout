const fs = require('fs');

let content = fs.readFileSync('src/app/api/create-order/route.ts', 'utf8');

// 1. Destructure appliedDiscounts
content = content.replace(
  /appliedDiscount,\s*prepaidDiscount/,
  'appliedDiscounts, prepaidDiscount'
);

// 2. Compute total discount amount
const oldDiscountAmount = `    let couponDiscountAmount = 0;
    let couponCodeStr = '';

    if (appliedDiscount) {
      if (appliedDiscount.type === 'percentage') {
        couponDiscountAmount = total * (appliedDiscount.value / 100);
      } else {
        couponDiscountAmount = appliedDiscount.value;
      }
      couponCodeStr = appliedDiscount.code;
    }`;

const newDiscountAmount = `    let couponDiscountAmount = 0;
    let couponCodeStr = '';

    if (appliedDiscounts && appliedDiscounts.length > 0) {
      couponCodeStr = appliedDiscounts.map((d: any) => d.code).join(', ');
      for (const d of appliedDiscounts) {
        if (d.type === 'percentage') {
          couponDiscountAmount += total * (d.value / 100);
        } else if (d.type === 'fixed_amount') {
          couponDiscountAmount += d.value;
        }
      }
    }`;
content = content.replace(oldDiscountAmount, newDiscountAmount);

// 3. Freebies
const oldFreebieLogic = `    if (appliedDiscount && appliedDiscount.type === 'freebie_product' && appliedDiscount.freebieName) {
      lineItems.push({
        title: appliedDiscount.freebieName,
        price: '0.00',
        quantity: 1,
        applied_discount: {
          description: appliedDiscount.code,
          value: '100.0',
          value_type: 'percentage',
          amount: '0.00'
        }
      });
    }`;
const newFreebieLogic = `    if (appliedDiscounts && appliedDiscounts.length > 0) {
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
content = content.replace(oldFreebieLogic, newFreebieLogic);

// 4. Draft order applied_discount
const oldDraftDiscount = `        applied_discount: (appliedDiscount && appliedDiscount.type !== 'freebie_product') ? {
          description: appliedDiscount.code,
          value_type: appliedDiscount.type,
          value: appliedDiscount.value.toString()
        } : undefined,`;
const newDraftDiscount = `        applied_discount: couponDiscountAmount > 0 ? {
          description: couponCodeStr,
          value_type: 'fixed_amount',
          value: couponDiscountAmount.toString(),
          amount: couponDiscountAmount.toString()
        } : undefined,`;
content = content.replace(oldDraftDiscount, newDraftDiscount);

// 5. Note
content = content.replace(
  /note: \`Discounts applied\. \$\{appliedDiscount \? 'Coupon: ' \+ appliedDiscount\.code : ''\}\`/,
  "note: `Discounts applied. ${couponCodeStr ? 'Coupons: ' + couponCodeStr : ''}`"
);

fs.writeFileSync('src/app/api/create-order/route.ts', content, 'utf8');
console.log('Create order API patched');
