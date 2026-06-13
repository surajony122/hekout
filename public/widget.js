(function() {
  window.CheckoutFlow = {
    open: function(options) {
      const { shop, variantId, quantity, productTitle, productImage, price } = options;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'flex-end';
      overlay.style.justifyContent = 'center';
      overlay.style.fontFamily = 'sans-serif';
      overlay.id = 'checkoutflow-overlay';

      // Create bottom sheet
      const sheet = document.createElement('div');
      sheet.style.width = '100%';
      sheet.style.maxWidth = '500px';
      sheet.style.backgroundColor = '#fff';
      sheet.style.borderTopLeftRadius = '20px';
      sheet.style.borderTopRightRadius = '20px';
      sheet.style.padding = '20px';
      sheet.style.boxSizing = 'border-box';
      sheet.style.transform = 'translateY(100%)';
      sheet.style.transition = 'transform 0.3s ease-out';
      sheet.style.maxHeight = '90vh';
      sheet.style.overflowY = 'auto';

      const total = parseFloat(price) * parseInt(quantity);

      sheet.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
          <h2 style="margin:0; font-size:1.4rem; font-weight:700; color:#111827;">Express Checkout</h2>
          <button id="cf-close" style="background:#f3f4f6; border:none; border-radius:50%; width:32px; height:32px; font-size:1.2rem; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#4b5563; transition:background 0.2s;">&times;</button>
        </div>
        
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:24px;">
          <div style="display:flex; gap:16px; align-items:center;">
            ${productImage ? `<img src="${productImage}" style="width:70px; height:70px; border-radius:10px; object-fit:cover; border:1px solid #e5e7eb;" />` : `<div style="width:70px; height:70px; border-radius:10px; background:#e5e7eb; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:24px;">🛍️</div>`}
            <div style="flex:1;">
              <div style="font-weight:600; font-size:1rem; color:#111827; margin-bottom:4px; line-height:1.3;">${productTitle || 'Product'}</div>
              <div style="color:#6b7280; font-size:0.875rem;">Qty: ${quantity}</div>
              <div style="font-weight:700; font-size:1.1rem; margin-top:6px; color:#111827;">₹${total.toLocaleString('en-IN')}</div>
            </div>
          </div>
          <div style="margin-top:16px; display:flex; gap:8px;">
            <input type="text" id="cf-discount" placeholder="Discount code" style="flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:0.9rem; outline:none;" />
            <button type="button" id="cf-apply-discount" style="background:#374151; color:white; border:none; border-radius:8px; padding:0 16px; font-size:0.9rem; font-weight:500; cursor:pointer;">Apply</button>
          </div>
          <div id="cf-discount-msg" style="color:#059669; font-size:0.8rem; margin-top:8px; display:none;">Discount code recorded.</div>
        </div>

        <form id="cf-form">
          <div style="margin-bottom:20px;">
            <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Customer Details</h3>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <input type="text" id="cf-name" placeholder="Full Name" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
              <input type="tel" id="cf-phone" placeholder="Phone Number" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
              <input type="email" id="cf-email" placeholder="Email Address (Optional)" style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Shipping Address</h3>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <input type="text" id="cf-address" placeholder="Street Address" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
              <div style="display:flex; gap:12px;">
                <input type="text" id="cf-city" placeholder="City" required style="width:50%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
                <input type="text" id="cf-state" placeholder="State" required style="width:50%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
              </div>
              <input type="text" id="cf-pincode" placeholder="Pincode" required style="width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; box-sizing:border-box; font-size:0.95rem; outline:none;" />
            </div>
          </div>

          <div style="margin-bottom:24px;">
            <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Payment Method</h3>
            <div style="border:1px solid #d1d5db; border-radius:8px; overflow:hidden;">
              <label style="display:flex; align-items:center; gap:12px; padding:16px; cursor:pointer; border-bottom:1px solid #d1d5db; background:#f9fafb;">
                <input type="radio" name="payment" value="COD" checked style="width:18px; height:18px; accent-color:#10b981;" />
                <span style="font-weight:500; color:#111827;">Cash on Delivery (COD)</span>
              </label>
              <label style="display:flex; align-items:center; gap:12px; padding:16px; cursor:pointer;">
                <input type="radio" name="payment" value="Prepaid" style="width:18px; height:18px; accent-color:#10b981;" />
                <span style="font-weight:500; color:#111827;">Pay Online (Prepaid)</span>
              </label>
            </div>
          </div>

          <button type="submit" id="cf-submit" style="width:100%; padding:16px; background:#10b981; color:#fff; border:none; border-radius:8px; font-size:1.1rem; font-weight:bold; cursor:pointer; transition: opacity 0.2s; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
            Complete Order &bull; ₹${total.toLocaleString('en-IN')}
          </button>
        </form>
      `;

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);

      // Animate up
      setTimeout(() => { sheet.style.transform = 'translateY(0)'; }, 10);

      // Close handler
      const closeWidget = () => {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => overlay.remove(), 300);
      };

      // Discount logic
      document.getElementById('cf-apply-discount').onclick = () => {
        const code = document.getElementById('cf-discount').value.trim();
        if (code) {
          document.getElementById('cf-discount-msg').innerText = `Discount code '${code}' recorded.`;
          document.getElementById('cf-discount-msg').style.display = 'block';
        }
      };

      document.getElementById('cf-close').onclick = closeWidget;
      overlay.onclick = (e) => { if(e.target === overlay) closeWidget(); };

      // Submit handler
      document.getElementById('cf-form').onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('cf-submit');
        submitBtn.innerText = 'Processing...';
        submitBtn.style.opacity = '0.7';
        submitBtn.disabled = true;

        const payload = {
          shop,
          variantId,
          quantity,
          productTitle,
          price,
          customerName: document.getElementById('cf-name').value,
          customerPhone: document.getElementById('cf-phone').value,
          customerEmail: document.getElementById('cf-email').value,
          address: document.getElementById('cf-address').value,
          city: document.getElementById('cf-city').value,
          state: document.getElementById('cf-state').value,
          pincode: document.getElementById('cf-pincode').value,
          paymentMethod: document.querySelector('input[name="payment"]:checked').value,
          discountCode: document.getElementById('cf-discount').value.trim()
        };

        try {
          // Pointing to Render SaaS URL
          const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
          const res = await fetch(`${apiBaseUrl}/api/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const data = await res.json();
          if (data.success) {
            submitBtn.innerText = 'Redirecting...';
            if (data.orderStatusUrl) {
              window.location.href = data.orderStatusUrl;
            } else {
              sheet.innerHTML = `
                <div style="text-align:center; padding: 40px 20px;">
                  <div style="font-size:3rem; color:#10b981; margin-bottom:20px;">✓</div>
                  <h2 style="margin:0 0 10px 0; color:#111;">Order Confirmed!</h2>
                  <p style="color:#666;">Your order has been placed successfully.</p>
                  <button onclick="document.getElementById('checkoutflow-overlay').remove()" style="margin-top:20px; padding:10px 20px; background:#000; color:#fff; border:none; border-radius:8px; cursor:pointer;">Close</button>
                </div>
              `;
            }
          } else {
            alert('Failed to place order: ' + (data.error || 'Unknown error'));
            submitBtn.innerText = `Complete Order • ₹${total}`;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        } catch(err) {
          alert('Network error. Please try again.');
          submitBtn.innerText = `Complete Order • ₹${total}`;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
      };
    },

    // Auto-Initialization Function
    autoInject: function() {
      // 1. Wait for page to fully load
      window.addEventListener('DOMContentLoaded', () => {
        // Find the standard Shopify Add to Cart forms
        const cartForms = document.querySelectorAll('form[action="/cart/add"]');
        
        cartForms.forEach(form => {
          // Create our custom Fast Checkout Button
          const fastCheckoutBtn = document.createElement('button');
          fastCheckoutBtn.type = 'button';
          fastCheckoutBtn.innerText = 'Buy Now (CheckoutFlow)';
          fastCheckoutBtn.style.cssText = 'width: 100%; padding: 15px; margin-top: 10px; background-color: #10b981; color: white; border: none; font-weight: bold; font-size: 16px; border-radius: 6px; cursor: pointer;';
          
          fastCheckoutBtn.onclick = (e) => {
            e.preventDefault();
            
            // Attempt to extract product data from the Shopify page dynamically
            let variantId = 'unknown';
            const variantInput = form.querySelector('input[name="id"], select[name="id"]');
            if (variantInput) variantId = variantInput.value;

            let quantity = 1;
            const qtyInput = form.querySelector('input[name="quantity"]');
            if (qtyInput) quantity = parseInt(qtyInput.value) || 1;

            // Grab Shopify global data if available
            const shopDomain = window.Shopify ? window.Shopify.shop : 'test.myshopify.com';
            
            // Try to scrape title and price from the page
            const titleEl = document.querySelector('h1');
            const productTitle = titleEl ? titleEl.innerText : 'Product';
            
            let price = 0;
            if (window.meta && window.meta.product && window.meta.product.variants && window.meta.product.variants.length > 0) {
              price = window.meta.product.variants[0].price / 100;
            } else {
              const priceEl = document.querySelector('.price-item--regular, .price, .product__price, [data-product-price]');
              if (priceEl) {
                let text = priceEl.innerText.replace(/,/g, '');
                let match = text.match(/[\d]+(\.[\d]+)?/);
                if (match) price = parseFloat(match[0]);
              }
            }

            window.CheckoutFlow.open({
              shop: shopDomain,
              variantId: variantId,
              quantity: quantity,
              productTitle: productTitle,
              price: price
            });
          };

          // Inject it below the form
          form.appendChild(fastCheckoutBtn);
        });
      });
    }
  };

  // Run auto inject automatically when script loads
  window.CheckoutFlow.autoInject();

})();
