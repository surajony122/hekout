const fs = require('fs');

let content = fs.readFileSync('public/widget.js', 'utf8');

// Find the start of the onsubmit block
const onsubmitStartIdx = content.indexOf(`document.getElementById('cf-checkout-form').onsubmit = async (e) => {`);
if (onsubmitStartIdx === -1) {
  console.error("Could not find onsubmit block");
  process.exit(1);
}

// Find the end of the onsubmit block
// It ends just before "autoInject: function() {"
const autoInjectIdx = content.indexOf(`autoInject: function() {`);
if (autoInjectIdx === -1) {
  console.error("Could not find autoInject block");
  process.exit(1);
}

// Find the precise end of the onsubmit block (which is "}, \n autoInject...")
const endIdx = content.lastIndexOf('},', autoInjectIdx);

const newSubmitLogic = `document.getElementById('cf-checkout-form').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('cf-submit-order');
        submitBtn.innerText = 'Processing...';
        submitBtn.style.opacity = '0.7';
        submitBtn.disabled = true;

        const paymentMethodEl = document.querySelector('input[name="payment"]:checked');
        const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'COD';
        
        const isPrepaid = ['UPI', 'Card', 'Wallet', 'Netbanking'].includes(paymentMethod);
        const isPartialCod = paymentMethod === 'PartialCOD';

        const subtotal = basePrice * currentQuantity;
        let prepaidDiscount = 0;
        if (typeof widgetConfig !== 'undefined' && widgetConfig && widgetConfig.isPrepaidDiscountEnabled && isPrepaid) {
          if (widgetConfig.prepaidDiscountType === 'percentage') {
             prepaidDiscount = subtotal * (widgetConfig.prepaidDiscountValue / 100);
          } else {
             prepaidDiscount = widgetConfig.prepaidDiscountValue;
          }
        }
        
        const payload = {
          shop,
          variantId,
          quantity: currentQuantity,
          productTitle,
          price,
          customerName: document.getElementById('cf-name').value,
          customerPhone: verifiedPhone,
          customerEmail: document.getElementById('cf-email').value,
          address: document.getElementById('cf-address').value,
          city: document.getElementById('cf-city').value,
          state: document.getElementById('cf-state').value,
          pincode: document.getElementById('cf-pincode').value,
          paymentMethod: paymentMethod,
          appliedDiscount: typeof appliedDiscount !== 'undefined' ? appliedDiscount : null,
          prepaidDiscount: prepaidDiscount
        };

        const createFinalOrder = async () => {
          try {
            const res = await fetch(\`\${apiBaseUrl}/api/create-order\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
              window.CheckoutFlow.trackEvent(shop, 'ORDER_COMPLETED');
              submitBtn.innerText = 'Redirecting...';
              if (data.orderStatusUrl) {
                window.location.href = data.orderStatusUrl;
              } else {
                sheet.innerHTML = \`
                  <div style="text-align:center; padding: 40px 20px;">
                    <div style="font-size:3rem; color:#10b981; margin-bottom:20px;">✓</div>
                    <h2 style="margin:0 0 10px 0; color:#111;">Order Confirmed!</h2>
                    <p style="color:#666;">Your order has been placed successfully.</p>
                    <button onclick="document.getElementById('checkoutflow-overlay').remove()" style="margin-top:20px; padding:10px 20px; background:#000; color:#fff; border:none; border-radius:8px; cursor:pointer;">Close</button>
                  </div>
                \`;
              }
            } else {
              alert('Failed to place order: ' + (data.error || 'Unknown error'));
              if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            }
          } catch(err) {
            alert('Network error. Please try again.');
            if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        };

        if (isPrepaid || isPartialCod) {
          try {
            const rzpAmount = Math.max(0, subtotal - (typeof discountAmount !== 'undefined' ? discountAmount : 0) - prepaidDiscount);

            const rzpOrderRes = await fetch(\`\${apiBaseUrl}/api/checkout/create-razorpay-order\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shop, amount: isPartialCod ? widgetConfig.partialCodAmount : rzpAmount })
            });
            const rzpOrderData = await rzpOrderRes.json();
            
            if (!rzpOrderData.success) {
              alert('Failed to initialize payment gateway: ' + rzpOrderData.error);
              if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
              return;
            }

            const options = {
              key: rzpOrderData.keyId,
              amount: rzpOrderData.amount,
              currency: "INR",
              name: "CheckoutFlow Demo",
              description: "Order Payment",
              order_id: rzpOrderData.orderId,
              handler: async function (response) {
                submitBtn.innerText = 'Verifying...';
                const verifyRes = await fetch(\`\${apiBaseUrl}/api/checkout/verify-payment\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    shop,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                  })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                  payload.paymentMethod = isPartialCod ? 'Partial COD' : 'Prepaid Online';
                  payload.paymentId = response.razorpay_payment_id;
                  await createFinalOrder();
                } else {
                  alert('Payment verification failed.');
                  if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
                  submitBtn.disabled = false;
                  submitBtn.style.opacity = '1';
                }
              },
              prefill: {
                name: document.getElementById('cf-name').value,
                email: document.getElementById('cf-email').value,
                contact: verifiedPhone
              },
              theme: { color: "#10b981" },
              modal: {
                ondismiss: function() {
                  if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
                  submitBtn.disabled = false;
                  submitBtn.style.opacity = '1';
                }
              }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
              alert('Payment failed. Reason: ' + response.error.description);
              if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            });
            rzp.open();
          } catch(e) {
            alert('Error initiating payment.');
            if (typeof window.internalUpdatePricing === 'function') window.internalUpdatePricing();
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        } else {
          await createFinalOrder();
        }
      };`;

const finalContent = content.substring(0, onsubmitStartIdx) + newSubmitLogic + '\n    ' + content.substring(endIdx);
fs.writeFileSync('public/widget.js', finalContent, 'utf8');
console.log('Force rewrite successful.');
