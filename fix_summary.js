const fs = require('fs');

let content = fs.readFileSync('public/widget.js', 'utf8');

// I need to update the summary box to show prepaid discount
const oldSummaryLogic = `
        document.getElementById('cf-summary-subtotal').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        if (appliedDiscount && appliedDiscount.type !== 'freebie_product') {
          document.getElementById('cf-summary-discount-value').innerText = \`-₹\${discountAmount.toLocaleString('en-IN')}\`;
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = \`₹\${discountAmount.toLocaleString('en-IN')}\`;
        } else if (appliedDiscount && appliedDiscount.type === 'freebie_product') {
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = 'a Free Gift';
        } else {
          document.getElementById('cf-savings-banner').style.display = 'none';
        }
        
        document.getElementById('cf-summary-total').innerText = \`₹\${finalTotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-submit-order').innerHTML = \`Complete Order &bull; ₹\${finalTotal.toLocaleString('en-IN')}\`;
`;

const newSummaryLogic = `
        document.getElementById('cf-summary-subtotal').innerText = \`₹\${subtotal.toLocaleString('en-IN')}\`;
        
        let totalSavings = discountAmount + prepaidDiscount;
        
        if (totalSavings > 0) {
          // Check if discount row exists, if not we reuse the existing one or just display the total savings banner
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = \`₹\${totalSavings.toLocaleString('en-IN')}\`;
          
          if (document.getElementById('cf-summary-discount-value')) {
             document.getElementById('cf-summary-discount-value').innerText = \`-₹\${totalSavings.toLocaleString('en-IN')}\`;
          }
        } else if (appliedDiscount && appliedDiscount.type === 'freebie_product') {
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = 'a Free Gift';
        } else {
          document.getElementById('cf-savings-banner').style.display = 'none';
          if (document.getElementById('cf-summary-discount-value')) {
             document.getElementById('cf-summary-discount-value').innerText = \`-₹0\`;
          }
        }
        
        document.getElementById('cf-summary-total').innerText = \`₹\${finalTotal.toLocaleString('en-IN')}\`;
        document.getElementById('cf-submit-order').innerHTML = \`Complete Order &bull; ₹\${finalTotal.toLocaleString('en-IN')}\`;
`;

content = content.replace(oldSummaryLogic, newSummaryLogic);

fs.writeFileSync('public/widget.js', content, 'utf8');
console.log('Fixed summary display');
