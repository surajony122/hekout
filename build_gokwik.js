const fs = require('fs');

const htmlContent = fs.readFileSync('gokwik-checkout-v2.html', 'utf8');

// Extract CSS
const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
const css = styleMatch ? styleMatch[1] : '';

// Extract HTML body content (excluding scripts and body tags)
const bodyMatch = htmlContent.match(/<body>([\s\S]*?)<script>/);
let html = bodyMatch ? bodyMatch[1] : '';

// Remove the coupon card HTML
html = html.replace(/<!-- 4\. COUPON -->[\s\S]*?<!-- 5\. UPSELL PRODUCTS -->/, '<!-- 5. UPSELL PRODUCTS -->');

// Remove the hardcoded UPSells and just leave the container
// html = html.replace(/<div class="upsell-scroll" id="upsellScroll">[\s\S]*?<\/div>\s*<\/div>\s*<!-- 6\. PAYMENT METHODS -->/, '<div class="upsell-scroll" id="upsellScroll"></div>\n    </div>\n\n    <!-- 6. PAYMENT METHODS -->');

// Extract ONLY the Confetti logic from JS
const jsMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
let js = jsMatch ? jsMatch[1] : '';

const confettiStart = js.indexOf('/* ── CONFETTI');
const confettiEnd = js.indexOf('/* ── RECALC');
let confettiJs = '';
if (confettiStart !== -1 && confettiEnd !== -1) {
  confettiJs = js.substring(confettiStart, confettiEnd);
}

// Create widget js core
let widgetJs = fs.readFileSync('public/widget.js', 'utf8');

const openStartStr = 'open: async function(options) {';
const openStartIdx = widgetJs.indexOf(openStartStr);
const autoInjectIdx = widgetJs.indexOf('autoInject: function() {');

let newOpenFunction = fs.readFileSync('template_gokwik.js', 'utf8');

// inject the css, html, js into the template where markers exist
newOpenFunction = newOpenFunction.replace('/*__CSS__*/', css);
newOpenFunction = newOpenFunction.replace('<!--__HTML__-->', html);
newOpenFunction = newOpenFunction.replace('/*__JS__*/', confettiJs);

const finalContent = widgetJs.substring(0, openStartIdx) + newOpenFunction + '\n    ' + widgetJs.substring(autoInjectIdx);

fs.writeFileSync('rewrite_ui.js', finalContent);
console.log('rewrite_ui.js successfully generated using Gokwik UI!');
