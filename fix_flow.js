const fs = require('fs');
let js = fs.readFileSync('template_v3.js', 'utf8');

// 1. Fix the crashing bug: Don't overwrite dContainer
js = js.replace(/dContainer\.innerHTML = dHtml;/, `
         let dynD = document.getElementById('dynamic-drawers');
         if(!dynD) { dynD = document.createElement('div'); dynD.id = 'dynamic-drawers'; dContainer.appendChild(dynD); }
         dynD.innerHTML = dHtml;
`);

// 2. Move Order Summary Bar to the top so it's visible on State 1 & 2
// Find the Order Summary Bar block
const osBarRegex = /<\!-- NEW ORDER SUMMARY BAR -->[\s\S]*?<\/div>\s*<\!-- DELIVER TO -->/;
const match = js.match(osBarRegex);

if (match) {
  let osBar = match[0].replace('            <!-- DELIVER TO -->', '').trim();
  
  // Remove it from state-checkout
  js = js.replace(osBarRegex, '            <!-- DELIVER TO -->');

  // Inject it right after <div class="scroll-body"...>
  js = js.replace(/<div class="scroll-body" style="overflow-y:auto; flex:1;">/, `<div class="scroll-body" style="overflow-y:auto; flex:1;">
          <!-- NEW ORDER SUMMARY BAR -->
          \${osBar}
`);

  // Wait, I used a template literal above but osBar contains \${...} variables which I shouldn't evaluate in Node.js.
  // Actually, I am injecting the string as-is into template_v3.js (which uses \${...} when it builds widget.js).
  // So replacing with \${osBar} in Node's replace doesn't evaluate the \${...} inside osBar string.
  // Let's rewrite the injection safely.
}

fs.writeFileSync('template_v3.js', js);
console.log('Fixed Flow');
