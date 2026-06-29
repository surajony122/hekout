const fs = require('fs');

// --- Patch API Create Order ---
let apiRoute = fs.readFileSync('src/app/api/create-order/route.ts', 'utf8');
apiRoute = apiRoute.replace(
  "const { shop, productTitle, variantId, quantity, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod, paymentId, appliedCoupon, upsellVariantId } = data;",
  "const { shop, productTitle, variantId, quantity, customerName, customerPhone, customerEmail, address, city, state, pincode, paymentMethod, paymentId, appliedCoupon, upsellVariantId, utmSource, utmMedium, utmCampaign } = data;"
);
apiRoute = apiRoute.replace(
  "orderStatus: 'Pending'",
  "orderStatus: 'Pending',\n        utmSource: utmSource || null,\n        utmMedium: utmMedium || null,\n        utmCampaign: utmCampaign || null"
);
fs.writeFileSync('src/app/api/create-order/route.ts', apiRoute);


// --- Patch template_v3.js ---
let template = fs.readFileSync('template_v3.js', 'utf8');

// 1. Inject FB Pixel and UTM Capture on Load
const fbAndUtmScript = `
      // --- UTM Tracking ---
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('utm_source')) localStorage.setItem('cf_utm_source', urlParams.get('utm_source'));
      if (urlParams.has('utm_medium')) localStorage.setItem('cf_utm_medium', urlParams.get('utm_medium'));
      if (urlParams.has('utm_campaign')) localStorage.setItem('cf_utm_campaign', urlParams.get('utm_campaign'));

      // --- FB Pixel Injection ---
      if (widgetConfig.fbPixelId) {
         !function(f,b,e,v,n,t,s)
         {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
         n.callMethod.apply(n,arguments):n.queue.push(arguments)};
         if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
         n.queue=[];t=b.createElement(e);t.async=!0;
         t.src=v;s=b.getElementsByTagName(e)[0];
         s.parentNode.insertBefore(t,s)}(window, document,'script',
         'https://connect.facebook.net/en_US/fbevents.js');
         fbq('init', widgetConfig.fbPixelId);
         fbq('track', 'PageView');
         
         // Fire InitiateCheckout when widget opens
         fbq('track', 'InitiateCheckout', { currency: 'INR', value: total });
      }
`;

template = template.replace(
  /document\.getElementById\('widget-overlay'\)\.style\.display = 'flex';/,
  "document.getElementById('widget-overlay').style.display = 'flex';\n" + fbAndUtmScript
);

// 2. Fire AddPaymentInfo
template = template.replace(
  /if\(currentState === 'contact'\)\s*\{\s*document.getElementById\('state-contact'\).style.display='none';/,
  "if(currentState === 'contact'){ if(typeof fbq === 'function') fbq('track', 'AddPaymentInfo'); document.getElementById('state-contact').style.display='none';"
);

// 3. Attach UTMs to cfExecutePayment
const utmPayload = `
                  utmSource: localStorage.getItem('cf_utm_source'),
                  utmMedium: localStorage.getItem('cf_utm_medium'),
                  utmCampaign: localStorage.getItem('cf_utm_campaign')
`;
template = template.replace(
  /upsellVariantId: \(upsellAccepted && activeUpsell\) \? activeUpsell.variantId : null/,
  "upsellVariantId: (upsellAccepted && activeUpsell) ? activeUpsell.variantId : null,\n" + utmPayload
);

// 4. Fire Purchase Event
template = template.replace(
  /document.getElementById\('success-message'\).style.display = 'block';/,
  "document.getElementById('success-message').style.display = 'block';\n                  if(typeof fbq === 'function') fbq('track', 'Purchase', { currency: 'INR', value: calculateTotals().finalTotal });"
);

fs.writeFileSync('template_v3.js', template);
console.log('Marketing Attribution injected successfully!');
