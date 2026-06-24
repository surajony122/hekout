const fs = require('fs');
let js = fs.readFileSync('template_v3.js', 'utf8');

// 1. Remove drwBill and drwCoupon from renderPaymentMethods
// The string we want to remove starts with `// --- BILL SUMMARY DRAWER ---` and ends before `const methods = [`

const drawerLogicRegex = /\/\/ \-\-\- BILL SUMMARY DRAWER \-\-\-[\s\S]*?\/\/ \-\-\- COUPON DRAWER \-\-\-[\s\S]*?<\/div>\n\s+`;\n/;
const match = js.match(drawerLogicRegex);

if (match) {
  let extractedDrawers = match[0]
    .replace('// --- BILL SUMMARY DRAWER ---', '')
    .replace('// --- COUPON DRAWER ---', '')
    .replace(/dHtml \+\= `/g, '')
    .replace(/`;/g, '');

  js = js.replace(drawerLogicRegex, '');

  // 2. Inject extractedDrawers into sheet.innerHTML where <div id="drawers-container"></div> is
  js = js.replace(/<div id="drawers-container"><\/div>/, `<div id="drawers-container">\n${extractedDrawers}\n</div>`);
} else {
  console.log("Could not find drawer logic in renderPaymentMethods!");
}

// 3. Remove sumBody since we deleted it from HTML but kept the variable reference
js = js.replace(/const sumBody = document\.getElementById\('sumBody'\);\n/, '');

fs.writeFileSync('template_v3.js', js);
console.log('Fixed Drawers location');
