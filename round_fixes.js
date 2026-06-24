const fs = require('fs');

let js = fs.readFileSync('template_v3.js', 'utf8');

// 1. Math.round everything to remove decimals
js = js.replace(/\\\${total\.toLocaleString\('en-IN'\)}/g, "\\${Math.round(total).toLocaleString('en-IN')}");
js = js.replace(/\\\${grandTotal\.toLocaleString\('en-IN'\)}/g, "\\${Math.round(grandTotal).toLocaleString('en-IN')}");
js = js.replace(/\\\${subtotal\.toLocaleString\('en-IN'\)}/g, "\\${Math.round(subtotal).toLocaleString('en-IN')}");
js = js.replace(/\\\${totalDiscount\.toLocaleString\('en-IN'\)}/g, "\\${Math.round(totalDiscount).toLocaleString('en-IN')}");
js = js.replace(/\\\${codFee\.toLocaleString\('en-IN'\)}/g, "\\${Math.round(codFee).toLocaleString('en-IN')}");
js = js.replace(/Math\.max\(0, subtotal - mDisc\)\.toLocaleString\('en-IN'\)/g, "Math.round(Math.max(0, subtotal - mDisc)).toLocaleString('en-IN')");

// 2. Add confetti logic
const confettiCode = `
      window.launchConfetti = () => {
         const canvas = document.getElementById('confetti-canvas');
         if (!canvas || !window.confetti) return;
         const myConfetti = window.confetti.create(canvas, { resize: true, useWorker: true });
         myConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      };
`;
js = js.replace(/\/\*__JS__\*\//, confettiCode);

// 3. Fix prepaid discount label
js = js.replace(/<div class="m-disc">Discount Applied<\/div>/g, "<div class=\"m-disc\">Extra ${widgetConfig.prepaidDiscountType === 'percentage' ? widgetConfig.prepaidDiscountValue + '%' : '₹' + widgetConfig.prepaidDiscountValue} OFF</div>");

fs.writeFileSync('template_v3.js', js);
console.log('Round fixes, confetti, and labels applied.');
