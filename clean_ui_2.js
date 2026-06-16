const fs = require('fs');

let lines = fs.readFileSync('rewrite_ui.js', 'utf8').split('\n');
let out = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('let appliedDiscounts = [];') || line.includes('let appliedDiscount = null;')) continue;
  
  // discountAmount declaration
  if (line.includes('let discountAmount = 0;')) continue;
  if (line.includes('if (appliedDiscount) {') || line.includes('if (appliedDiscounts')) {
    // Skip this block until we find a closing brace that matches the indentation
    let indent = line.match(/^\s*/)[0].length;
    skip = true;
    while (skip && i < lines.length) {
      if (lines[i].trim() === '}' && lines[i].match(/^\s*/)[0].length === indent) {
        skip = false;
      }
      i++;
    }
    i--;
    continue;
  }

  // Remove finalTotal calculation with discount
  if (line.includes('const finalTotal = Math.max(0, subtotal - discountAmount);')) {
    out.push(line.replace(' - discountAmount', ''));
    continue;
  }
  
  if (line.includes('el.innerText = `₹${Math.max(0, subtotal - discountAmount - pd).toLocaleString(')) {
    out.push(line.replace(' - discountAmount', ''));
    continue;
  }
  if (line.includes('el.innerText = `₹${Math.max(0, subtotal - discountAmount).toLocaleString(')) {
    out.push(line.replace(' - discountAmount', ''));
    continue;
  }

  // Remove discount logic blocks entirely
  if (line.includes('// Discount logic')) {
    let indent = line.match(/^\s*/)[0].length;
    skip = true;
    i++; // skip '// Discount logic'
    while (skip && i < lines.length) {
      if (lines[i].includes('document.getElementById(\'cf-apply-discount\').onclick = async () => {')) {
        let nestedSkip = true;
        let nestedIndent = lines[i].match(/^\s*/)[0].length;
        i++;
        while (nestedSkip && i < lines.length) {
          if (lines[i].trim() === '};' && lines[i].match(/^\s*/)[0].length === nestedIndent) {
            nestedSkip = false;
          }
          i++;
        }
        skip = false;
      } else {
        i++;
      }
    }
    i--;
    continue;
  }
  
  // Remove freebies array filtering
  if (line.includes('const freebies = appliedDiscounts.filter')) {
    let indent = line.match(/^\s*/)[0].length;
    skip = true;
    while (skip && i < lines.length) {
      if (lines[i].trim() === '}' && lines[i].match(/^\s*/)[0].length === indent) {
        skip = false;
      }
      i++;
    }
    i--;
    continue;
  }
  
  // Remove else if (discountAmount > 0)
  if (line.includes('} else if (discountAmount > 0) {') || line.includes('if (discountAmount > 0) {')) {
    let indent = line.match(/^\s*/)[0].length;
    skip = true;
    while (skip && i < lines.length) {
      if (lines[i].trim() === '}' && lines[i].match(/^\s*/)[0].length === indent) {
        skip = false;
      }
      i++;
    }
    i--;
    continue;
  }

  // Remove razorpay amount discountAmount subtract
  if (line.includes('const rzpAmount = Math.max(0, subtotal - discountAmount - prepaidDiscount);')) {
    out.push(line.replace(' - discountAmount', ''));
    continue;
  }

  out.push(line);
}

fs.writeFileSync('rewrite_ui.js', out.join('\n'));
console.log('UI script cleaned line by line');
