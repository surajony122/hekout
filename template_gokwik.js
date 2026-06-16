open: async function(options) {
      const { shop, variantId, quantity, productTitle, productImage, price } = options;
      
      this.trackEvent(shop, 'WIDGET_OPENED');

      const apiBaseUrl = 'https://checkoutflow-app.onrender.com';
      let widgetConfig = { 
        isPrepaidDiscountEnabled: false, prepaidDiscountType: 'percentage', prepaidDiscountValue: 0, 
        isPartialCodEnabled: false, partialCodAmount: 0, hasRazorpay: false,
        primaryColor: '#111827',
      };

      try {
        const configRes = await fetch(`${apiBaseUrl}/api/widget/config?shop=${shop}&t=${Date.now()}`);
        const configData = await configRes.json();
        if (configData.success) {
          widgetConfig = configData.config;
        }
      } catch (e) {}

      // Add Phosphor icons
      const phosphorScript = document.createElement('script');
      phosphorScript.src = 'https://unpkg.com/@phosphor-icons/web';
      document.head.appendChild(phosphorScript);

      const overlay = document.createElement('div');
      overlay.id = 'checkoutflow-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = '#f5f3ff';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'block';
      overlay.style.overflowY = 'auto';
      
      let currentQuantity = quantity;
      let basePrice = price;
      let total = basePrice * currentQuantity;

      // Extract Product Image Fallback
      let finalProductImage = productImage;
      if (!finalProductImage) {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) finalProductImage = ogImage.content;
      }

      overlay.innerHTML = `
        <style>
          ${widgetConfig.primaryColor ? `:root { --p1: ${widgetConfig.primaryColor}; }` : ''}
          /*__CSS__*/
        </style>
        <!--__HTML__-->
      `;

      document.body.appendChild(overlay);

      // Disable body scroll
      document.body.style.overflow = 'hidden';

      // --- DYNAMIC DATA BINDING ---
      const updatePricing = () => {
        const subtotal = basePrice * currentQuantity;
        let prepaidDiscount = 0;
        let codFee = 69;

        const ppType = widgetConfig.prepaidDiscountType;
        const ppVal = widgetConfig.prepaidDiscountValue || 0;
        if (widgetConfig.isPrepaidDiscountEnabled) {
          if (ppType === 'percentage') {
             prepaidDiscount = subtotal * (ppVal / 100);
          } else {
             prepaidDiscount = ppVal;
          }
        }

        const upiAmt = Math.max(0, subtotal - prepaidDiscount);
        const cardAmt = Math.max(0, subtotal - prepaidDiscount);
        const walletAmt = Math.max(0, subtotal - prepaidDiscount);
        const nbAmt = Math.max(0, subtotal - prepaidDiscount);
        const emiAmt = Math.max(0, subtotal);
        const codAmt = subtotal + codFee;

        // UI Updates
        document.getElementById('hFinal').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('hMrp').innerText = ''; 
        
        document.getElementById('tSub').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        document.getElementById('tGrand').innerText = `₹${subtotal.toLocaleString('en-IN')}`;
        
        // Items
        document.getElementById('itemLbl').innerText = `${currentQuantity} items`;
        document.getElementById('q1').innerText = currentQuantity;
        document.getElementById('p1').innerText = `₹${subtotal.toLocaleString('en-IN')}`;

        document.getElementById('ppUpi').innerText = `₹${upiAmt.toLocaleString('en-IN')}`;
        document.getElementById('ppCard').innerText = `₹${cardAmt.toLocaleString('en-IN')}`;
        document.getElementById('ppWallet').innerText = `₹${walletAmt.toLocaleString('en-IN')}`;
        document.getElementById('ppNb').innerText = `₹${nbAmt.toLocaleString('en-IN')}`;
        document.getElementById('ppEmi').innerText = `₹${emiAmt.toLocaleString('en-IN')}`;
        document.getElementById('ppCod').innerText = `₹${codAmt.toLocaleString('en-IN')}`;

        document.getElementById('upiPayAmt').innerText = `₹${upiAmt.toLocaleString('en-IN')}`;
        document.getElementById('cardPayAmt').innerText = `₹${cardAmt.toLocaleString('en-IN')}`;
        document.getElementById('walletPayAmt').innerText = `₹${walletAmt.toLocaleString('en-IN')}`;
        document.getElementById('nbPayAmt').innerText = `₹${nbAmt.toLocaleString('en-IN')}`;
        document.getElementById('codPayAmt').innerText = `₹${codAmt.toLocaleString('en-IN')}`;
        document.getElementById('codFinalAmt').innerText = `₹${codAmt.toLocaleString('en-IN')}`;
      };

      // Initial populate
      document.querySelector('.oi-name').innerText = productTitle || 'Awesome Product';
      const imgDiv = document.querySelector('.oi-thumb');
      if (finalProductImage) {
        imgDiv.innerHTML = `<img src="${finalProductImage}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`;
      } else {
        imgDiv.innerText = '🛍️';
      }

      // Hide other mock items
      document.getElementById('oi2').style.display = 'none';
      document.getElementById('oi3').style.display = 'none';
      
      updatePricing();

      // Hook up UI functions
      window.historyBackOverride = () => {
        overlay.remove();
        document.body.style.overflow = '';
      };
      document.querySelector('.back-btn').onclick = window.historyBackOverride;

      window.togSum = function(){
        const b=document.getElementById('sumBody');
        const h=document.getElementById('sumHdr');
        const open=b.classList.toggle('show');
        h.classList.toggle('open',open);
      };

      window.togShip = function(){
        const b=document.getElementById('shipBody');
        const h=document.getElementById('shipHdr');
        const open=b.classList.toggle('show');
        h.classList.toggle('open',open);
      };

      window.chQty = function(id, d) {
        if(id === 1) {
          const nq = currentQuantity + d;
          if(nq < 1) return;
          currentQuantity = nq;
          updatePricing();
        }
      };
      
      window.rmItem = function(id) {
         if (id === 1) {
            window.historyBackOverride();
         }
      };

      const drwMap={upi:'drwUpi',card:'drwCard',wallet:'drwWallet',nb:'drwNb',emi:'drwEmi',cod:'drwCod'};
      window.openDrw = function(type){
        const el=document.getElementById(drwMap[type]);
        if(el){ el.classList.add('show'); el.style.display='flex'; }
      };
      window.closeDrw = function(type,e){
        const overlayDrw=document.getElementById(drwMap[type]);
        if(!overlayDrw) return;
        if(e && e.target!==overlayDrw) return;
        overlayDrw.classList.remove('show');
        setTimeout(() => { overlayDrw.style.display='none'; }, 300);
      };

      window.showToast = function(msg){
        const t=document.getElementById('toast');
        t.textContent=msg;
        t.classList.add('show');
        clearTimeout(t._t);
        t._t=setTimeout(function(){ t.classList.remove('show'); },2600);
      };
      
      window.addRipple = function(e){
        const btn=e.currentTarget;
        const r=document.createElement('span');
        r.className='ripple';
        const rect=btn.getBoundingClientRect();
        const size=Math.max(btn.clientWidth,btn.clientHeight);
        r.style.width=r.style.height=size+'px';
        r.style.left=(e.clientX-rect.left-size/2)+'px';
        r.style.top=(e.clientY-rect.top-size/2)+'px';
        btn.appendChild(r);
        setTimeout(function(){ r.remove(); },600);
      };

      // Hide all overlays initially
      Object.values(drwMap).forEach(id => {
         const el = document.getElementById(id);
         if(el) {
            el.style.display = 'none';
         }
      });

      // Injecting script functions directly inside the module
      /*__JS__*/
      
      window.placeOrder = async (method) => {
          Object.values(drwMap).forEach(function(id){
            var el=document.getElementById(id);
            if(el) { el.classList.remove('show'); el.style.display = 'none'; }
          });
          
          let prepaidDiscount = 0;
          if (widgetConfig.isPrepaidDiscountEnabled && method !== 'COD') {
             const ppType = widgetConfig.prepaidDiscountType;
             const ppVal = widgetConfig.prepaidDiscountValue || 0;
             if (ppType === 'percentage') {
                prepaidDiscount = (basePrice * currentQuantity) * (ppVal / 100);
             } else {
                prepaidDiscount = ppVal;
             }
          }
          
          const payload = {
            shop, variantId, quantity: currentQuantity, productTitle, price,
            customerName: 'Guest User', customerPhone: '9999999999', customerEmail: 'guest@example.com',
            address: '123 Test Street', city: 'Test City', state: 'TS', pincode: '110001',
            paymentMethod: method,
            prepaidDiscount: prepaidDiscount
          };
          
          var sheet=document.getElementById('mainSheet');
          sheet.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;background:linear-gradient(160deg,#f5f3ff,#fdf4ff)"><div style="width:48px;height:48px;border:3px solid #ede9fe;border-top:3px solid #7c3aed;border-radius:50%;animation:spin .7s linear infinite"></div><div style="font-size:14px;color:#6b7280;font-weight:600">Processing your '+method+' payment…</div></div>';
          
          try {
            const res = await fetch(`${apiBaseUrl}/api/create-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            setTimeout(function(){
              sheet.style.display='none';
              var s=document.getElementById('successScr');
              s.classList.add('show');
              launchConfetti();
              setTimeout(launchConfetti,800);
            }, 1000);
          } catch(e) {
            sheet.innerHTML = 'Error placing order';
          }
      };
    },
