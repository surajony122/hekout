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
        
        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; margin-bottom:24px; overflow:hidden;">
          <!-- Accordion Header -->
          <div id="cf-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding:16px; cursor:pointer; background:#f9fafb;">
            <div style="display:flex; align-items:center; gap:8px;">
              <svg width="20" height="20" fill="none" stroke="#374151" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              <span style="font-weight:600; color:#374151; font-size:1rem;">Order summary</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; color:#4b5563; font-size:0.9rem;">
              <span id="cf-summary-qty-header">${quantity} item</span>
              <svg id="cf-accordion-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="transition: transform 0.2s;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          
          <div id="cf-savings-banner" style="display:none; background:#dcfce7; color:#166534; padding:8px 16px; font-size:0.95rem; font-weight:500; text-align:center; border-top:1px solid #bbf7d0; border-bottom:1px solid #bbf7d0;">
            Yay! You've saved <span id="cf-savings-amount" style="font-weight:700;">₹0</span> so far 🥳
          </div>

          <!-- Accordion Body -->
          <div id="cf-accordion-body" style="padding:16px; display:none;">
            <div style="display:flex; gap:16px; align-items:flex-start;">
              ${productImage ? `<img src="${productImage}" style="width:80px; height:80px; border-radius:8px; object-fit:cover; border:1px solid #e5e7eb;" />` : `<div style="width:80px; height:80px; border-radius:8px; background:#e5e7eb; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:24px;">🛍️</div>`}
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                  <div style="font-weight:500; font-size:0.95rem; color:#111827; line-height:1.4; padding-right:12px;">${productTitle || 'Product'}</div>
                  <div style="font-weight:700; font-size:1rem; color:#111827;" id="cf-item-total">₹${total.toLocaleString('en-IN')}</div>
                </div>
                
                <div style="display:flex; align-items:center; gap:16px; margin-top:12px;">
                  <button type="button" id="cf-delete-item" style="background:none; border:1px solid #d1d5db; border-radius:6px; padding:6px; cursor:pointer; color:#ef4444; display:flex; align-items:center; justify-content:center; transition: background 0.2s;">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                  <div style="display:flex; align-items:center; border:1px solid #d1d5db; border-radius:6px; overflow:hidden;">
                    <button type="button" id="cf-qty-minus" style="background:#f9fafb; border:none; border-right:1px solid #d1d5db; padding:6px 14px; cursor:pointer; font-size:1.1rem; color:#374151; display:flex; align-items:center; justify-content:center;">-</button>
                    <div id="cf-qty-display" style="padding:6px 16px; font-size:0.95rem; font-weight:600; color:#111827;">${quantity}</div>
                    <button type="button" id="cf-qty-plus" style="background:#f9fafb; border:none; border-left:1px solid #d1d5db; padding:6px 14px; cursor:pointer; font-size:1.1rem; color:#374151; display:flex; align-items:center; justify-content:center;">+</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:24px;">
          <div style="display:flex; gap:8px;">
            <input type="text" id="cf-discount" placeholder="Enter coupon code" style="flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:8px; font-size:0.9rem; outline:none;" />
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
            <h3 style="font-size:1rem; font-weight:600; color:#374151; margin:0 0 12px 0;">Order Summary</h3>
            <div style="background:#f9fafb; border:1px solid #d1d5db; border-radius:8px; padding:16px; font-size:0.95rem; color:#374151;">
              <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span>Subtotal</span>
                <span id="cf-summary-subtotal" style="font-weight:600;">₹${total.toLocaleString('en-IN')}</span>
              </div>
              <div id="cf-summary-discount-row" style="display:none; justify-content:space-between; margin-bottom:8px; color:#059669;">
                <span>Coupon discount (<span id="cf-summary-discount-code"></span>)</span>
                <span id="cf-summary-discount-value" style="font-weight:600;">-₹0</span>
              </div>
              <div id="cf-summary-freebie-row" style="display:none; justify-content:space-between; margin-bottom:8px; color:#059669;">
                <span>Free Gift</span>
                <span id="cf-summary-freebie-name" style="font-weight:600;"></span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <span>Shipping</span>
                <span style="font-weight:600; color:#059669;">Free</span>
              </div>
              <div style="border-top:1px solid #d1d5db; margin:12px 0;"></div>
              <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.1rem; color:#111827;">
                <span>Total</span>
                <span id="cf-summary-total">₹${total.toLocaleString('en-IN')}</span>
              </div>
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

      // State Variables
      let currentQuantity = parseInt(quantity) || 1;
      let basePrice = parseFloat(price) || 0;
      let appliedDiscount = null;

      // Pricing Update Engine
      const updatePricingUI = () => {
        const subtotal = basePrice * currentQuantity;
        let discountAmount = 0;

        if (appliedDiscount) {
          if (appliedDiscount.type === 'percentage') {
            discountAmount = subtotal * (appliedDiscount.value / 100);
          } else if (appliedDiscount.type === 'fixed_amount') {
            discountAmount = appliedDiscount.value;
          }
        }

        const finalTotal = Math.max(0, subtotal - discountAmount);

        // Update Item Accordion
        document.getElementById('cf-item-total').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('cf-qty-display').innerText = currentQuantity;
        document.getElementById('cf-summary-qty-header').innerText = `${currentQuantity} item${currentQuantity !== 1 ? 's' : ''}`;

        // Update Order Summary Box
        document.getElementById('cf-summary-subtotal').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        if (appliedDiscount && appliedDiscount.type !== 'freebie_product') {
          document.getElementById('cf-summary-discount-value').innerText = `-₹${discountAmount.toLocaleString('en-IN')}`;
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = `₹${discountAmount.toLocaleString('en-IN')}`;
        } else if (appliedDiscount && appliedDiscount.type === 'freebie_product') {
          document.getElementById('cf-savings-banner').style.display = 'block';
          document.getElementById('cf-savings-amount').innerText = 'a Free Gift';
        } else {
          document.getElementById('cf-savings-banner').style.display = 'none';
        }
        
        document.getElementById('cf-summary-total').innerText = `₹${finalTotal.toLocaleString('en-IN')}`;
        document.getElementById('cf-submit').innerHTML = `Complete Order &bull; ₹${finalTotal.toLocaleString('en-IN')}`;
      };

      // Accordion Toggle
      const accHeader = document.getElementById('cf-accordion-header');
      const accBody = document.getElementById('cf-accordion-body');
      const accIcon = document.getElementById('cf-accordion-icon');
      let isAccOpen = false;
      accHeader.onclick = () => {
        isAccOpen = !isAccOpen;
        accBody.style.display = isAccOpen ? 'block' : 'none';
        accIcon.style.transform = isAccOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      };

      // Quantity Controls
      document.getElementById('cf-qty-plus').onclick = () => {
        currentQuantity++;
        updatePricingUI();
      };

      document.getElementById('cf-qty-minus').onclick = () => {
        if (currentQuantity > 1) {
          currentQuantity--;
          updatePricingUI();
        }
      };

      document.getElementById('cf-delete-item').onclick = () => {
        if (confirm('Remove item from cart?')) {
          closeWidget();
        }
      };
      let currentTotal = total;

      const applyDiscountToState = (data, code) => {
        if (data.type === 'freebie_product') {
          appliedDiscount = { code, type: data.type, value: 0, freebieName: data.freebieName };
          document.getElementById('cf-summary-discount-row').style.display = 'none';
          document.getElementById('cf-summary-freebie-name').innerText = data.freebieName;
          document.getElementById('cf-summary-freebie-row').style.display = 'flex';
        } else {
          appliedDiscount = { code, type: data.type, value: data.value };
          document.getElementById('cf-summary-freebie-row').style.display = 'none';
          document.getElementById('cf-summary-discount-code').innerText = code;
          document.getElementById('cf-summary-discount-row').style.display = 'flex';
        }
        updatePricingUI();
      };

      document.getElementById('cf-apply-discount').onclick = async () => {
        const code = document.getElementById('cf-discount').value.trim();
        const msgEl = document.getElementById('cf-discount-msg');
        const btn = document.getElementById('cf-apply-discount');
        
        if (!code) return;

        btn.innerText = '...';
        btn.disabled = true;
        msgEl.style.display = 'none';
        msgEl.style.color = '#059669';

        try {
          const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
          const res = await fetch(`${apiBaseUrl}/api/validate-discount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop, code })
          });
          
          const data = await res.json();
          if (data.valid) {
            applyDiscountToState(data, code);
            
            msgEl.innerText = `Discount applied successfully!`;
            msgEl.style.color = '#059669';
            msgEl.style.display = 'block';
          } else {
            appliedDiscount = null;
            document.getElementById('cf-summary-discount-row').style.display = 'none';
            document.getElementById('cf-summary-freebie-row').style.display = 'none';
            updatePricingUI();
            
            msgEl.innerText = data.error || 'Invalid discount code';
            msgEl.style.color = '#dc2626';
            msgEl.style.display = 'block';
          }
        } catch (err) {
          msgEl.innerText = 'Failed to validate code. Try again.';
          msgEl.style.color = '#dc2626';
          msgEl.style.display = 'block';
        }
        
        btn.innerText = 'Apply';
        btn.disabled = false;
      };

      // Check for Auto-Apply Discounts on load
      fetch(`https://checkoutflow-app.onrender.com/api/discounts/auto?shop=${shop}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.discount) {
            document.getElementById('cf-discount').value = data.discount.code;
            applyDiscountToState({ valid: true, ...data.discount }, data.discount.code);
            const msgEl = document.getElementById('cf-discount-msg');
            msgEl.innerText = `Auto-applied discount: ${data.discount.code}`;
            msgEl.style.color = '#059669';
            msgEl.style.display = 'block';
          }
        })
        .catch(console.error);

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
          quantity: currentQuantity,
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
          appliedDiscount: appliedDiscount // { code, type, value }
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
            submitBtn.innerHTML = `Complete Order &bull; ₹${currentTotal.toLocaleString('en-IN')}`;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        } catch(err) {
          alert('Network error. Please try again.');
          updatePricingUI(); // reset button text
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
            let productImage = null;
            if (window.meta && window.meta.product && window.meta.product.variants && window.meta.product.variants.length > 0) {
              price = window.meta.product.variants[0].price / 100;
              if (window.meta.product.variants[0].featured_image) {
                productImage = window.meta.product.variants[0].featured_image.src;
              }
            } else {
              const priceEl = document.querySelector('.price-item--regular, .price, .product__price, [data-product-price]');
              if (priceEl) {
                let text = priceEl.innerText.replace(/,/g, '');
                let match = text.match(/[\d]+(\.[\d]+)?/);
                if (match) price = parseFloat(match[0]);
              }
            }
            
            if (!productImage) {
              const imgEl = document.querySelector('img.product-single__photo, img.product__image, img[data-product-featured-image]');
              if (imgEl) productImage = imgEl.src;
            }

            window.CheckoutFlow.open({
              shop: shopDomain,
              variantId: variantId,
              quantity: quantity,
              productTitle: productTitle,
              productImage: productImage,
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
