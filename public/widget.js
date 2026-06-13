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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
          <h2 style="margin:0; font-size:1.5rem; color:#111;">Checkout</h2>
          <button id="cf-close" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>
        
        <div style="display:flex; gap:15px; margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #eee;">
          ${productImage ? `<img src="${productImage}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;" />` : ''}
          <div>
            <div style="font-weight:600; color:#333;">${productTitle || 'Product'}</div>
            <div style="color:#666;">Qty: ${quantity}</div>
            <div style="font-weight:bold; margin-top:5px; color:#111;">₹${total}</div>
          </div>
        </div>

        <form id="cf-form">
          <h3 style="font-size:1.1rem; color:#333; margin-bottom:10px;">Customer Details</h3>
          <input type="text" id="cf-name" placeholder="Full Name" required style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />
          <input type="tel" id="cf-phone" placeholder="Phone Number" required style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />
          <input type="email" id="cf-email" placeholder="Email Address" style="width:100%; padding:12px; margin-bottom:20px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />

          <h3 style="font-size:1.1rem; color:#333; margin-bottom:10px;">Shipping Address</h3>
          <input type="text" id="cf-address" placeholder="Street Address" required style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />
          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <input type="text" id="cf-city" placeholder="City" required style="width:50%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />
            <input type="text" id="cf-state" placeholder="State" required style="width:50%; padding:12px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />
          </div>
          <input type="text" id="cf-pincode" placeholder="Pincode" required style="width:100%; padding:12px; margin-bottom:20px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;" />

          <div style="margin-bottom:20px;">
            <label style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
              <input type="radio" name="payment" value="COD" checked /> Cash on Delivery (COD)
            </label>
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              <input type="radio" name="payment" value="Prepaid" /> Pay Online (Prepaid)
            </label>
          </div>

          <button type="submit" id="cf-submit" style="width:100%; padding:15px; background:#000; color:#fff; border:none; border-radius:8px; font-size:1.1rem; font-weight:bold; cursor:pointer; transition: opacity 0.2s;">
            Complete Order &bull; ₹${total}
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
          paymentMethod: document.querySelector('input[name="payment"]:checked').value
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
            sheet.innerHTML = `
              <div style="text-align:center; padding: 40px 20px;">
                <div style="font-size:3rem; color:#10b981; margin-bottom:20px;">✓</div>
                <h2 style="margin:0 0 10px 0; color:#111;">Order Confirmed!</h2>
                <p style="color:#666;">Your order has been placed successfully.</p>
                <button onclick="document.getElementById('checkoutflow-overlay').remove()" style="margin-top:20px; padding:10px 20px; background:#000; color:#fff; border:none; border-radius:8px; cursor:pointer;">Close</button>
              </div>
            `;
          } else {
            alert('Failed to place order: ' + (data.error || 'Unknown error'));
            submitBtn.innerText = \`Complete Order • ₹\${total}\`;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        } catch(err) {
          alert('Network error. Please try again.');
          submitBtn.innerText = \`Complete Order • ₹\${total}\`;
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
            
            const priceEl = document.querySelector('.price, .product__price, [data-product-price]');
            let priceStr = priceEl ? priceEl.innerText.replace(/[^0-9.]/g, '') : '0';
            let price = parseFloat(priceStr);
            if (isNaN(price)) price = 0;

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
