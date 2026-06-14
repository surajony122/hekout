const fs = require('fs');
let content = fs.readFileSync('public/widget.js', 'utf8');

// We need to inject prepaidDiscount into the payload
content = content.replace(
  "appliedDiscount: appliedDiscount\n        };",
  "appliedDiscount: appliedDiscount,\n          prepaidDiscount: prepaidDiscount\n        };"
);

// We need to add the calculation before creating payload
content = content.replace(
  "const payload = {",
  `        const subtotal = basePrice * currentQuantity;
        let prepaidDiscount = 0;
        if (widgetConfig && widgetConfig.isPrepaidDiscountEnabled && isPrepaid) {
          if (widgetConfig.prepaidDiscountType === 'percentage') {
             prepaidDiscount = subtotal * (widgetConfig.prepaidDiscountValue / 100);
          } else {
             prepaidDiscount = widgetConfig.prepaidDiscountValue;
          }
        }
        
        const payload = {`
);

fs.writeFileSync('public/widget.js', content, 'utf8');
console.log('Widget payload updated with prepaidDiscount');
