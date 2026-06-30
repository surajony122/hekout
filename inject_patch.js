const fs = require('fs');
let file = fs.readFileSync('old_widget_utf8.js', 'utf8');

const oldInject = `    autoInject: function() {
      window.addEventListener('DOMContentLoaded', () => {
        const cartForms = document.querySelectorAll('form[action="/cart/add"]');
        cartForms.forEach(form => {
          const fastCheckoutBtn = document.createElement('button');
          fastCheckoutBtn.type = 'button';
          fastCheckoutBtn.innerText = 'Buy Now (CheckoutFlow)';
          fastCheckoutBtn.style.cssText = 'width: 100%; padding: 15px; margin-top: 10px; background-color: #10b981; color: white; border: none; font-weight: bold; font-size: 16px; border-radius: 6px; cursor: pointer;';
          
          fastCheckoutBtn.onclick = (e) => {
            e.preventDefault();
            let variantId = 'unknown';
            const variantInput = form.querySelector('input[name="id"], select[name="id"]');
            if (variantInput) variantId = variantInput.value;

            let quantity = 1;
            const qtyInput = form.querySelector('input[name="quantity"]');
            if (qtyInput) quantity = parseInt(qtyInput.value) || 1;

            const shopDomain = window.Shopify ? window.Shopify.shop : 'test.myshopify.com';
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
                let match = text.match(/[\\d]+(\\.[\\d]+)?/);
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
          form.appendChild(fastCheckoutBtn);
        });
      });
    }`;

const newInject = `    autoInject: function() {
      const injectButtons = () => {
        const checkoutSelectors = [
          'button[name="checkout"]',
          'input[name="checkout"]',
          '.shopify-payment-button__button',
          'form[action="/cart"] button[type="submit"]',
          'form[action="/cart/add"] .product-form__submit'
        ];
        
        let injectedCount = 0;
        checkoutSelectors.forEach(selector => {
          const els = document.querySelectorAll(selector);
          els.forEach(el => {
            if (el.dataset.cfInjected) return;
            el.dataset.cfInjected = 'true';
            
            // Hide the native button
            el.style.display = 'none';
            
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerText = 'Buy Now - CheckoutFlow ⚡';
            btn.style.cssText = 'width: 100%; padding: 14px; margin-top: 10px; margin-bottom: 10px; background: linear-gradient(90deg, #10b981, #059669); color: white; border: none; font-weight: 700; font-size: 15px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: transform 0.2s;';
            btn.onmouseover = () => btn.style.transform = 'translateY(-2px)';
            btn.onmouseout = () => btn.style.transform = 'translateY(0)';
            
            btn.onclick = async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const shopDomain = window.Shopify ? window.Shopify.shop : 'test.myshopify.com';
              let variantId = 'unknown';
              let quantity = 1;
              let productTitle = 'Order';
              let price = 0;
              let productImage = null;
              
              // Check if we are in a cart context (drawer or cart page)
              const isCart = el.closest('form[action^="/cart"]') && !el.closest('form[action="/cart/add"]');
              
              if (isCart) {
                 btn.innerText = 'Loading...';
                 try {
                    const cartRes = await fetch('/cart.js');
                    const cart = await cartRes.json();
                    if (cart.items && cart.items.length > 0) {
                       variantId = cart.items[0].variant_id;
                       quantity = cart.item_count;
                       productTitle = cart.items.length > 1 ? \`\${cart.items[0].title} + \${cart.items.length-1} more\` : cart.items[0].title;
                       price = cart.total_price / 100 / quantity; // Average price per unit for the widget math
                       productImage = cart.items[0].image;
                    }
                 } catch(err) {
                    console.error('Error fetching cart', err);
                 }
                 btn.innerText = 'Buy Now - CheckoutFlow ⚡';
              } else {
                 // Product page context
                 const form = el.closest('form[action="/cart/add"]');
                 if (form) {
                    const variantInput = form.querySelector('input[name="id"], select[name="id"]');
                    if (variantInput) variantId = variantInput.value;
                    const qtyInput = form.querySelector('input[name="quantity"]');
                    if (qtyInput) quantity = parseInt(qtyInput.value) || 1;
                 }
                 
                 const titleEl = document.querySelector('h1');
                 if (titleEl) productTitle = titleEl.innerText;
                 
                 if (window.meta && window.meta.product && window.meta.product.variants && window.meta.product.variants.length > 0) {
                    price = window.meta.product.variants[0].price / 100;
                    if (window.meta.product.variants[0].featured_image) {
                      productImage = window.meta.product.variants[0].featured_image.src;
                    }
                 } else {
                    const priceEl = document.querySelector('.price-item--regular, .price, .product__price, [data-product-price]');
                    if (priceEl) {
                      let text = priceEl.innerText.replace(/,/g, '');
                      let match = text.match(/[\\d]+(\\.[\\d]+)?/);
                      if (match) price = parseFloat(match[0]);
                    }
                 }
                 if (!productImage) {
                    const imgEl = document.querySelector('img.product-single__photo, img.product__image, img[data-product-featured-image]');
                    if (imgEl) productImage = imgEl.src;
                 }
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
            
            el.parentNode.insertBefore(btn, el.nextSibling);
            injectedCount++;
          });
        });
      };

      // Run on DOM loaded
      if (document.readyState === 'loading') {
         document.addEventListener('DOMContentLoaded', injectButtons);
      } else {
         injectButtons();
      }
      
      // Observe DOM for dynamic cart drawers opening
      const observer = new MutationObserver((mutations) => {
         injectButtons();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }`;

file = file.replace(oldInject.trim(), newInject.trim());
fs.writeFileSync('old_widget_utf8.js', file);
console.log('autoInject patched successfully!');
