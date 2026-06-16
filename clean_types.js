const fs = require('fs');

let content = fs.readFileSync('src/app/api/dashboard/metrics/route.ts', 'utf8');

// 1. Remove couponDiscount from select
content = content.replace(/,\s*couponDiscount: true/g, '');

// 2. Remove totalCouponDiscount logic
content = content.replace(/const totalCouponDiscount = orders\.reduce[\s\S]*?\n/g, '');

// 3. Update totalDiscountsGiven
content = content.replace(
  /const totalDiscountsGiven = totalPrepaidDiscount \+ totalCouponDiscount;/g,
  'const totalDiscountsGiven = totalPrepaidDiscount;'
);

// 4. Remove totalCouponDiscount from JSON return
content = content.replace(/,\s*totalCouponDiscount/g, '');

fs.writeFileSync('src/app/api/dashboard/metrics/route.ts', content, 'utf8');
console.log('Metrics Route Cleaned');

let ordersContent = fs.readFileSync('src/app/orders/OrdersClient.tsx', 'utf8');

// Remove couponDiscount rendering logic
ordersContent = ordersContent.replace(
  /\{\(selectedOrder\.couponDiscount > 0\) && \([\s\S]*?\}\)/g,
  ''
);

fs.writeFileSync('src/app/orders/OrdersClient.tsx', ordersContent, 'utf8');
console.log('Orders Client Cleaned');
