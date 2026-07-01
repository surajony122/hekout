const fs = require('fs');
let c = fs.readFileSync('template_v3.js', 'utf8');

// Replace all document.getElementById with widgetRoot.querySelector (since getElementById is not always available on shadow root in all browsers, but querySelector('#id') is)
// Wait, shadowRoot.getElementById IS standard. Let's use widgetRoot.getElementById
c = c.replace(/document\.getElementById/g, 'widgetRoot.getElementById');

// Fix the initialization parts which need to refer to document
c = c.replace(/widgetRoot\.getElementById\('checkoutflow-overlay'\)/g, "document.getElementById('checkoutflow-host')");
c = c.replace(/widgetRoot\.getElementById\('checkoutflow-sheet'\)/g, "document.getElementById('checkoutflow-host')");

// Also replace document.querySelector if any
c = c.replace(/document\.querySelector/g, 'widgetRoot.querySelector');
c = c.replace(/widgetRoot\.querySelector\('body'\)/g, "document.querySelector('body')");
c = c.replace(/widgetRoot\.querySelector\('head'\)/g, "document.querySelector('head')");

fs.writeFileSync('template_v3.js', c);
console.log('Refactored template_v3.js');
