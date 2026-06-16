const fs = require('fs');

let content = fs.readFileSync('rewrite_ui.js', 'utf8');

// Remove appliedDiscounts array
content = content.replace(/let appliedDiscounts = \[\];\n/g, '');

// Remove autoDiscounts logic
content = content.replace(
  /if \(widgetConfig\.autoDiscounts && widgetConfig\.autoDiscounts\.length > 0[\s\S]*?\}\n          \}/g,
  ''
);

// Remove the input UI
content = content.replace(
  /<div style="display:flex; gap:8px; margin-bottom:16px;">[\s\S]*?id="cf-discount-tags"[\s\S]*?<\/div>/g,
  ''
);

// Remove summary discount row HTML
content = content.replace(
  /<div id="cf-summary-discount-row"[\s\S]*?<\/div>/g,
  ''
);

// Remove internalUpdatePricing logic for discountAmount
content = content.replace(
  /let discountAmount = 0;\s*for \(const ad of appliedDiscounts\) \{[\s\S]*?\}\s*\}\s*const tagsContainer = document\.getElementById\('cf-discount-tags'\);[\s\S]*?\}\s*\n/g,
  'let discountAmount = 0;'
);

// Replace finalTotal logic
content = content.replace(
  /const finalTotal = Math\.max\(0, subtotal - discountAmount\);/g,
  'const finalTotal = Math.max(0, subtotal);'
);

content = content.replace(
  /const freebies = appliedDiscounts\.filter[\s\S]*?document\.getElementById\('cf-summary-discount-row'\)\.style\.display = 'none';\n        \}/g,
  ''
);

// Remove the click handler completely
content = content.replace(
  /\/\/ Discount logic\s*document\.getElementById\('cf-apply-discount'\)\.onclick = async \(\) => \{[\s\S]*?\}\s*\}\s*catch\(e\) \{\s*btn\.innerText = 'Apply';\s*\}\s*\};\n/g,
  ''
);

// Remove appliedDiscounts from create order
content = content.replace(/,\s*appliedDiscounts: appliedDiscounts/g, '');

// Save
fs.writeFileSync('rewrite_ui.js', content);
console.log('UI script cleaned of discounts');
