const fs = require('fs');

const gokwikHtml = fs.readFileSync('gokwik-checkout-v2.html', 'utf8');
const jsMatch = gokwikHtml.match(/<script>([\s\S]*?)<\/script>/);
const js = jsMatch ? jsMatch[1] : '';
const confettiStart = js.indexOf('/* ── CONFETTI');
const confettiEnd = js.indexOf('/* ── RECALC');
let confettiJs = '';
if (confettiStart !== -1 && confettiEnd !== -1) {
  confettiJs = js.substring(confettiStart, confettiEnd);
}

const css = fs.readFileSync('new_styles.css', 'utf8');

let oldWidget = fs.readFileSync('old_widget_utf8.js', 'utf8');

const openStartStr = 'open: async function(options) {';
const openStartIdx = oldWidget.indexOf(openStartStr);
const autoInjectIdx = oldWidget.indexOf('autoInject: function() {');

let newOpenFunction = fs.readFileSync('template_v3.js', 'utf8');

newOpenFunction = newOpenFunction.replace('/*__CSS__*/', css);
newOpenFunction = newOpenFunction.replace('/*__JS__*/', confettiJs);

const finalJs = oldWidget.substring(0, openStartIdx) + newOpenFunction + '\n    ' + oldWidget.substring(autoInjectIdx);

fs.writeFileSync('public/widget.js', finalJs);
console.log('public/widget.js successfully generated using proper logic!');
