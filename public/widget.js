(function() {
  window.CheckoutFlow = {
    trackEvent: async function(shop, eventName) {
      try {
        await fetch('https://checkoutflow-app.onrender.com/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, sessionId: 'anon', eventName })
        });
      } catch (err) {}
    },

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
          
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --p1:#7c3aed;--p2:#a855f7;--p3:#ec4899;--p4:#f97316;
  --pg:linear-gradient(135deg,#7c3aed,#a855f7,#ec4899);
  --pg2:linear-gradient(135deg,#a855f7,#ec4899,#f97316);
  --g-green:linear-gradient(135deg,#059669,#10b981);
  --g-gold:linear-gradient(135deg,#d97706,#f59e0b,#fbbf24);
  --surface:#ffffff;
  --bg:#f5f3ff;
  --border:#ede9fe;
  --border2:#ddd6fe;
  --text1:#1e1b4b;--text2:#6b7280;--text3:#a78bfa;
  --red:#ef4444;--green:#059669;--green-bg:#ecfdf5;--green-text:#065f46;
  --amber:#d97706;--amber-bg:#fffbeb;
  --radius:14px;--radius-sm:10px;--radius-xs:7px;
  --font:'Inter',sans-serif;
  --shadow:0 2px 12px rgba(124,58,237,.10);
  --shadow-card:0 4px 20px rgba(124,58,237,.08);
}
html,body{font-family:var(--font);background:var(--bg);color:var(--text1);min-height:100vh;font-size:14px;-webkit-font-smoothing:antialiased;overscroll-behavior:none}

/* ── CONFETTI CANVAS ── */
#confetti-canvas{position:fixed;inset:0;pointer-events:none;z-index:9999}

/* ── Sheet ── */
.sheet{max-width:420px;margin:0 auto;background:var(--bg);min-height:100vh;box-shadow:0 0 60px rgba(124,58,237,.15);position:relative}

/* ── Header ── */
.top-header{position:sticky;top:0;z-index:80;background:var(--surface);border-bottom:1.5px solid var(--border2)}
.header-row{display:flex;align-items:center;padding:12px 16px;gap:10px}
.back-btn{width:36px;height:36px;border-radius:50%;border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .2s}
.back-btn:hover{background:var(--bg);transform:scale(.95)}
.back-btn svg{width:18px;height:18px;stroke:var(--text1);fill:none;stroke-width:2.5}
.brand-center{flex:1;display:flex;justify-content:center}
.brand-oct{position:relative;padding:7px 14px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-align:center;line-height:1.3;color:var(--p1)}
.brand-oct::before{content:'';position:absolute;inset:0;border:1.5px solid var(--p1);clip-path:polygon(25% 0%,75% 0%,100% 25%,100% 75%,75% 100%,25% 100%,0% 75%,0% 25%)}
.header-price{text-align:right;flex-shrink:0}
.header-price .final{font-size:18px;font-weight:800;background:var(--pg);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header-price .mrp{font-size:12px;color:var(--text3);text-decoration:line-through}
.upi-strip{background:var(--pg);color:#fff;text-align:center;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px;display:flex;align-items:center;justify-content:center;gap:6px}
.upi-strip .star{animation:twinkle 1.2s ease-in-out infinite alternate}
@keyframes twinkle{from{opacity:.5;transform:scale(.8)}to{opacity:1;transform:scale(1)}}

/* ── Body ── */
.scroll-body{padding:12px 12px 100px;display:flex;flex-direction:column;gap:10px}

/* ── Card base ── */
.card{background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card)}

/* ── Section label ── */
.sec-lbl{font-size:11.5px;font-weight:700;color:var(--text2);letter-spacing:.06em;text-transform:uppercase;padding:2px 0 8px}

/* ── ORDER SUMMARY ── */
.summary-hdr{display:flex;align-items:center;gap:8px;padding:14px 16px;cursor:pointer;user-select:none;transition:background .15s}
.summary-hdr:hover{background:var(--bg)}
.summary-hdr .icon{width:20px;height:20px;stroke:var(--p1);fill:none;stroke-width:2}
.summary-hdr-text{flex:1;font-size:15px;font-weight:700;color:var(--text1)}
.summary-hdr-right{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text2);font-weight:500}
.chev{width:16px;height:16px;stroke:var(--text3);fill:none;stroke-width:2;transition:transform .25s}
.open>.chev,.open .chev{transform:rotate(180deg)}
.summary-body{display:none}
.summary-body.show{display:block}
.oi{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-top:1px solid var(--border)}
.oi-thumb{width:66px;height:66px;border-radius:var(--radius-sm);border:1.5px solid var(--border2);overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#f5f3ff,#ede9fe);display:flex;align-items:center;justify-content:center;font-size:28px;position:relative}
.free-badge-img{position:absolute;top:0;right:0;background:var(--g-green);border-radius:0 0 0 8px;padding:3px 5px;display:flex}
.free-badge-img svg{width:11px;height:11px;stroke:#fff;fill:none;stroke-width:2.5}
.oi-info{flex:1;min-width:0}
.oi-name{font-size:13px;font-weight:600;line-height:1.4;color:var(--text1);margin-bottom:3px}
.oi-sku{font-size:11px;color:var(--text3);margin-bottom:8px}
.oi-ctrls{display:flex;align-items:center;gap:7px}
.del-btn{width:28px;height:28px;border-radius:7px;border:1.5px solid #fecaca;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff5f5;transition:all .2s}
.del-btn:hover{background:#fecaca;transform:scale(1.05)}
.del-btn svg{width:13px;height:13px;stroke:#ef4444;fill:none;stroke-width:2}
.qty-btn{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;color:var(--p1);user-select:none;background:var(--surface);transition:all .15s;font-weight:700}
.qty-btn:active{transform:scale(.92);background:var(--bg)}
.qty-n{font-size:14px;font-weight:700;min-width:20px;text-align:center;color:var(--text1)}
.oi-price{text-align:right;flex-shrink:0}
.oi-price .pr{font-size:14px;font-weight:700;color:var(--text1)}
.oi-price .mrp{font-size:11px;color:var(--text3);text-decoration:line-through;margin-top:1px}
.oi-price .free{font-size:13px;font-weight:800;background:var(--g-green);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.totals-box{background:linear-gradient(135deg,#f5f3ff,#fdf4ff);padding:14px 16px;border-top:1px solid var(--border)}
.tr{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px}
.tr:last-child{margin-bottom:0}
.tr .l{color:var(--text2)}
.tr .v{font-weight:600}
.tr.disc .l,.tr.disc .v{color:#059669;font-weight:700}
.tr.free-sh .v{color:var(--text3);font-weight:500}
.tr.grand{font-size:16px;font-weight:800;margin-top:4px}
.tr.grand .l,.tr.grand .v{color:var(--text1)}
.tr-div{border:none;border-top:1px dashed var(--border2);margin:8px 0}

/* ── DELIVER ── */
.deliver-inner{padding:14px 16px}
.deliver-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.deliver-top svg{width:18px;height:18px;stroke:var(--p1);fill:none;stroke-width:2;flex-shrink:0}
.deliver-top-t{font-size:15px;font-weight:700;flex:1}
.tag{background:linear-gradient(135deg,#ede9fe,#fce7f3);border:1px solid var(--border2);border-radius:999px;font-size:11px;font-weight:700;padding:3px 10px;color:var(--p1)}
.edit-lnk{font-size:12px;font-weight:700;color:var(--p1);cursor:pointer;display:flex;align-items:center;gap:2px;transition:opacity .15s}
.edit-lnk:hover{opacity:.7}
.edit-lnk svg{width:13px;height:13px;stroke:var(--p1);fill:none;stroke-width:2.5}
.addr-box{background:linear-gradient(135deg,#f5f3ff,#fdf4ff);border-radius:var(--radius-sm);padding:12px 14px;font-size:13px;line-height:1.7;color:var(--text1);border:1px solid var(--border)}
.addr-box .aname{font-weight:700}
.addr-contact{margin-top:6px;display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--text2)}
.addr-contact span{display:flex;align-items:center;gap:4px}
.addr-contact svg{width:12px;height:12px;stroke:var(--text3);fill:none;stroke-width:2}

/* ── SHIPPING ── */
.ship-hdr{display:flex;align-items:center;gap:8px;padding:14px 16px;cursor:pointer;transition:background .15s}
.ship-hdr:hover{background:var(--bg)}
.ship-hdr svg.tr-icon{width:22px;height:22px;stroke:var(--p1);fill:none;stroke-width:1.8}
.ship-hdr-t{font-size:15px;font-weight:700;flex:1}
.free-lbl{font-size:14px;font-weight:800;background:var(--g-green);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ship-body{display:none;padding:10px 16px 14px;border-top:1px solid var(--border)}
.ship-body.show{display:block}
.ship-opt{display:flex;gap:10px;font-size:13px;line-height:1.6;color:var(--text1);align-items:flex-start}
.ship-opt input[type=radio]{accent-color:var(--p1);margin-top:3px;flex-shrink:0}
.cod-note-sm{font-size:12px;color:var(--p1);font-weight:700;margin-top:3px;cursor:pointer}

/* ── COUPON ── */
.coupon-card{background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card)}
.coupon-top{display:flex;align-items:center;gap:8px;padding:13px 14px;border-bottom:1.5px solid var(--border2)}
.coupon-top svg{width:18px;height:18px;stroke:var(--p2);fill:none;stroke-width:1.8;flex-shrink:0}
.coupon-top input{flex:1;border:none;outline:none;font-size:14px;font-family:var(--font);color:var(--text1);background:transparent;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.coupon-top input::placeholder{text-transform:none;letter-spacing:0;color:var(--text3);font-weight:400}
.c-apply-btn{font-size:13px;font-weight:800;background:var(--pg);-webkit-background-clip:text;-webkit-text-fill-color:transparent;border:none;cursor:pointer;font-family:var(--font);opacity:.4;transition:opacity .15s;white-space:nowrap;padding:0}
.c-apply-btn.on{opacity:1}
.c-apply-btn:hover.on{opacity:.8}
.coupon-msg{padding:8px 14px 10px;font-size:12px;font-weight:600;display:none;align-items:center;gap:6px}
.coupon-msg.ok{display:flex;color:var(--green)}
.coupon-msg.ok svg{stroke:var(--green)}
.coupon-msg.er{display:flex;color:var(--red)}
.coupon-msg.er svg{stroke:var(--red)}
.coupon-msg svg{width:14px;height:14px;fill:none;stroke-width:2;flex-shrink:0}
.savings-strip{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:linear-gradient(135deg,#fef3c7,#fde68a);cursor:pointer}
.savings-left{display:flex;align-items:center;gap:8px}
.savings-left .coin{font-size:20px}
.savings-txt{font-size:13px;font-weight:700;color:#78350f}
.savings-txt span{font-weight:500;color:#92400e}

/* ── UPSELL SCROLL ── */
.upsell-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;-ms-overflow-style:none;scroll-snap-type:x mandatory}
.upsell-scroll::-webkit-scrollbar{display:none}
.upsell-card{flex-shrink:0;width:140px;background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius);overflow:hidden;scroll-snap-align:start;transition:transform .2s,box-shadow .2s;box-shadow:var(--shadow)}
.upsell-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.18)}
.upsell-img{width:100%;height:100px;object-fit:cover;background:linear-gradient(135deg,#f5f3ff,#fce7f3);display:flex;align-items:center;justify-content:center;font-size:42px}
.upsell-body{padding:8px 10px}
.upsell-name{font-size:11.5px;font-weight:600;color:var(--text1);line-height:1.3;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.upsell-pricing{display:flex;align-items:baseline;gap:5px;margin-bottom:7px}
.upsell-price{font-size:13px;font-weight:800;color:var(--p1)}
.upsell-mrp{font-size:10px;color:var(--text3);text-decoration:line-through}
.upsell-off{font-size:9px;font-weight:700;background:linear-gradient(135deg,#059669,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.upsell-add{width:100%;height:30px;border:1.5px solid var(--p1);border-radius:6px;background:transparent;font-size:11px;font-weight:700;color:var(--p1);cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:4px;transition:all .2s}
.upsell-add:hover{background:var(--p1);color:#fff;transform:scale(1.02)}
.upsell-add.added{background:var(--g-green);border-color:transparent;color:#fff}
.upsell-add.added:hover{transform:scale(1.02)}

/* ── PAYMENT METHODS ── */
.pay-row{display:flex;align-items:center;gap:12px;padding:14px 14px;border-top:1px solid var(--border);cursor:pointer;transition:all .18s;position:relative;overflow:hidden}
.pay-row:first-child{border-top:none}
.pay-row::after{content:'';position:absolute;inset:0;background:var(--pg);opacity:0;transition:opacity .15s}
.pay-row:hover::after{opacity:.04}
.pay-row:active{transform:scale(.99)}
.pay-icons-wrap{display:flex;flex-wrap:wrap;gap:3px;width:56px;flex-shrink:0}
.pi{width:24px;height:24px;border-radius:5px;border:1px solid var(--border2);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}
.pi img{width:20px;height:20px;object-fit:contain}
.pi.big{width:40px;height:40px;border-radius:10px}
.pi.big img{width:32px;height:32px}
.pi svg{width:18px;height:18px;stroke:var(--p2);fill:none;stroke-width:1.8}
.pay-info{flex:1;min-width:0}
.pay-name{font-size:14px;font-weight:700;color:var(--text1);margin-bottom:2px}
.pay-sub{font-size:11px;color:var(--text3)}
.pay-offer{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--green);margin-top:4px}
.pay-offer svg{width:11px;height:11px;stroke:var(--green);fill:none;stroke-width:2.5}
.pay-price-col{text-align:right;flex-shrink:0}
.pay-price{font-size:15px;font-weight:800;background:var(--pg);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pay-arrow svg{width:15px;height:15px;stroke:var(--text3);fill:none;stroke-width:2.5;margin-left:3px}
.pay-badge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-top:3px;display:inline-block}
.pay-badge.best{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
.pay-badge.popular{background:linear-gradient(135deg,#059669,#10b981);color:#fff}

/* ── FOOTER ── */
.checkout-foot{border-top:1.5px solid var(--border2);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;background:var(--surface)}
.logged-txt{font-size:12px;color:var(--text2)}
.logout-btn{font-size:12px;font-weight:700;color:var(--p1);border:1.5px solid var(--border2);border-radius:8px;padding:5px 13px;cursor:pointer;background:var(--surface);font-family:var(--font);transition:all .2s}
.logout-btn:hover{background:var(--bg);border-color:var(--p2)}
.pow-row{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;color:var(--text3);padding:6px 0}
.pow-chip{font-size:10px;font-weight:700;padding:2px 9px;border:1px solid var(--border2);border-radius:5px;color:var(--p2);background:var(--surface)}

/* ── DRAWERS ── */
.overlay{display:none;position:fixed;inset:0;background:rgba(30,27,75,.5);z-index:200;align-items:flex-end;backdrop-filter:blur(3px)}
.overlay.show{display:flex}
.drawer{width:100%;max-width:420px;margin:0 auto;background:var(--surface);border-radius:20px 20px 0 0;padding:0 0 32px;animation:slideup .28s cubic-bezier(.32,.72,0,1);max-height:88vh;overflow-y:auto}
@keyframes slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.d-handle{width:40px;height:4px;border-radius:2px;background:var(--border2);margin:12px auto 0}
.d-hdr{padding:16px 20px 13px;font-size:17px;font-weight:800;color:var(--text1);border-bottom:1.5px solid var(--border)}
.d-body{padding:16px 20px}
.upi-apps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.upi-app{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);cursor:pointer;transition:all .2s}
.upi-app:hover{border-color:var(--p2);background:var(--bg);transform:translateY(-2px)}
.upi-app:active{transform:scale(.95)}
.upi-app img{width:36px;height:36px;border-radius:8px;object-fit:contain}
.upi-app small{font-size:10px;font-weight:700;color:var(--text2)}
.div-or{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text3);margin:12px 0}
.div-or::before,.div-or::after{content:'';flex:1;height:1px;background:var(--border)}
.upi-id-row{display:flex;gap:8px}
.upi-id-row input{flex:1;height:46px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);padding:0 12px;font-size:14px;font-family:var(--font);color:var(--text1);outline:none;transition:border-color .15s}
.upi-id-row input:focus{border-color:var(--p1)}
.upi-verify{height:46px;padding:0 16px;background:var(--pg);color:#fff;border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font)}
.field{margin-bottom:12px}
.field label{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:5px}
.field input,.field select{width:100%;height:46px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);padding:0 12px;font-size:14px;font-family:var(--font);color:var(--text1);outline:none;background:#fff;transition:border-color .15s;appearance:none;-webkit-appearance:none}
.field input:focus,.field select:focus{border-color:var(--p1);box-shadow:0 0 0 3px rgba(124,58,237,.08)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.emi-row{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}
.emi-row:last-child{border-bottom:none}
.emi-bank{font-size:14px;font-weight:700}
.emi-tenure{font-size:11px;color:var(--text3);margin-top:2px}
.emi-amt{font-size:15px;font-weight:800;background:var(--pg);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.no-cost{font-size:9px;font-weight:700;background:var(--g-green);color:#fff;padding:2px 6px;border-radius:4px;display:inline-block;margin-left:5px;-webkit-text-fill-color:#fff}
.bank-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.bank-tile{border:1.5px solid var(--border2);border-radius:var(--radius-sm);padding:10px 6px;text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:var(--text2);transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:5px}
.bank-tile:hover{border-color:var(--p2);color:var(--p1);background:var(--bg)}
.bank-tile.sel{border-color:var(--p1);color:var(--p1);background:linear-gradient(135deg,#f5f3ff,#fdf4ff)}
.bank-tile .icon{font-size:22px}
.cod-warn{background:var(--amber-bg);border:1px solid #fde68a;border-radius:var(--radius-sm);padding:12px 14px;font-size:13px;color:#78350f;display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}
.cod-warn svg{width:18px;height:18px;stroke:var(--amber);fill:none;stroke-width:2;flex-shrink:0;margin-top:1px}
.cod-save-note{background:var(--green-bg);border-radius:var(--radius-sm);padding:10px 12px;font-size:12px;color:var(--green-text);font-weight:600;display:flex;align-items:center;gap:7px;margin-bottom:14px}
.cod-save-note svg{width:15px;height:15px;stroke:var(--green);fill:none;stroke-width:2.5;flex-shrink:0}

/* ── PAY NOW BTN ── */
.pay-now{width:100%;height:52px;background:var(--pg);color:#fff;border:none;border-radius:var(--radius);font-size:16px;font-weight:800;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s}
.pay-now::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15),transparent)}
.pay-now:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(168,85,247,.4)}
.pay-now:active{transform:scale(.98)}
.pay-now svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2}
.pay-note{font-size:11.5px;text-align:center;color:var(--text3);margin-top:8px}

/* ── RIPPLE ── */
.ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.4);transform:scale(0);animation:rpl .5s linear;pointer-events:none}
@keyframes rpl{to{transform:scale(4);opacity:0}}

/* ── SUCCESS ── */
.success-screen{display:none;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px 24px;text-align:center;gap:18px;background:linear-gradient(160deg,#f5f3ff,#fdf4ff,#fff0fb)}
.success-screen.show{display:flex}
.s-icon{width:90px;height:90px;border-radius:50%;background:var(--pg);display:flex;align-items:center;justify-content:center;animation:popIn .45s cubic-bezier(.36,1.4,.6,1)}
@keyframes popIn{0%{transform:scale(0)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
.s-icon svg{width:44px;height:44px;stroke:#fff;fill:none;stroke-width:2.5}
.s-title{font-size:26px;font-weight:900;background:var(--pg);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.s-sub{font-size:14px;color:var(--text2);line-height:1.7;max-width:280px}
.s-oid{background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius-sm);padding:12px 20px;font-size:13px;color:var(--text2)}
.s-oid b{display:block;font-size:16px;font-weight:800;background:var(--pg);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-top:2px}
.s-deliver{background:var(--green-bg);border-radius:var(--radius-sm);padding:12px 16px;font-size:13px;color:var(--green-text);display:flex;align-items:center;gap:10px;max-width:320px;width:100%;font-weight:600;line-height:1.5}
.s-deliver svg{width:20px;height:20px;stroke:var(--green);fill:none;stroke-width:2;flex-shrink:0}
.track-btn{background:var(--pg);color:#fff;border:none;border-radius:var(--radius);height:52px;padding:0 36px;font-size:15px;font-weight:800;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:8px;transition:transform .15s,box-shadow .15s}
.track-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(168,85,247,.4)}
.track-btn svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2}

/* ── TOAST ── */
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;padding:10px 22px;border-radius:999px;font-size:13px;font-weight:600;z-index:500;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s;box-shadow:0 4px 20px rgba(124,58,237,.3)}
.toast.show{opacity:1}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.spin{animation:spin .7s linear infinite}

        </style>
        

<canvas id="confetti-canvas"></canvas>

<div class="sheet" id="mainSheet">

  <!-- TOP HEADER -->
  <div class="top-header">
    <div class="header-row">
      <div class="back-btn" onclick="history.back()">
        <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </div>
      <div class="brand-center">
        <div class="brand-oct">JUST LIL<br>THINGS<br><span style="font-size:7px;letter-spacing:.4em">~~~</span></div>
      </div>
      <div class="header-price">
        <div class="final" id="hFinal">₹618.20</div>
        <div class="mrp" id="hMrp">₹798</div>
      </div>
    </div>
    <div class="upi-strip">
      <span class="star">✦</span> EXTRA 1% DISCOUNT ON UPI <span class="star" style="animation-delay:.4s">✦</span>
    </div>
  </div>

  <!-- SCROLL BODY -->
  <div class="scroll-body">

    <!-- 1. ORDER SUMMARY -->
    <div class="card">
      <div class="summary-hdr" id="sumHdr" onclick="togSum()">
        <svg class="icon" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <span class="summary-hdr-text">Order summary</span>
        <div class="summary-hdr-right">
          <span id="itemLbl">3 items</span>
          <svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div class="summary-body" id="sumBody">
        <!-- Item 1 -->
        <div class="oi" id="oi1">
          <div class="oi-thumb">🎫</div>
          <div class="oi-info">
            <div class="oi-name">Quarterly Membership</div>
            <div class="oi-ctrls">
              <div class="del-btn" onclick="rmItem(1)"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
              <div class="qty-btn" onclick="chQty(1,-1)">−</div>
              <span class="qty-n" id="q1">1</span>
              <div class="qty-btn" onclick="chQty(1,1)">+</div>
            </div>
          </div>
          <div class="oi-price"><div class="pr" id="p1">₹299</div></div>
        </div>
        <!-- Item 2 -->
        <div class="oi" id="oi2">
          <div class="oi-thumb">💍</div>
          <div class="oi-info">
            <div class="oi-name">Statement Clustered Pearl Earrings JLT11768</div>
            <div class="oi-sku">SKU: JLT11768</div>
            <div class="oi-ctrls">
              <div class="del-btn" onclick="rmItem(2)"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></div>
              <div class="qty-btn" onclick="chQty(2,-1)">−</div>
              <span class="qty-n" id="q2">1</span>
              <div class="qty-btn" onclick="chQty(2,1)">+</div>
            </div>
          </div>
          <div class="oi-price"><div class="pr" id="p2">₹319.20</div><div class="mrp">₹499</div></div>
        </div>
        <!-- Item 3 FREE -->
        <div class="oi" id="oi3">
          <div class="oi-thumb">🧻<div class="free-badge-img"><svg viewBox="0 0 24 24"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg></div></div>
          <div class="oi-info">
            <div class="oi-name">Wet Wipes – Make Remover</div>
            <div class="oi-ctrls">
              <div class="qty-btn" onclick="chQty(3,-1)">−</div>
              <span class="qty-n" id="q3">1</span>
              <div class="qty-btn" onclick="chQty(3,1)">+</div>
            </div>
          </div>
          <div class="oi-price"><div class="free">FREE!</div></div>
        </div>
        <!-- Totals -->
        <div class="totals-box">
          <div class="tr"><span class="l">Subtotal</span><span class="v" id="tSub">₹798</span></div>
          <div class="tr disc"><span class="l">Discount on MRP</span><span class="v">− ₹100</span></div>
          <div class="tr free-sh"><span class="l">Shipping</span><span class="v">FREE</span></div>
          <div class="tr disc" id="tCoupRow" style="display:none"><span class="l">Coupon discount</span><span class="v" id="tCoupVal">− ₹0</span></div>
          <hr class="tr-div">
          <div class="tr grand"><span class="l">Total</span><span class="v" id="tGrand">₹618.20</span></div>
        </div>
      </div>
    </div>

    <!-- 2. DELIVER TO -->
    <div class="card">
      <div class="deliver-inner">
        <div class="deliver-top">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="deliver-top-t">Deliver to</span>
          <span class="tag">Home</span>
          <span class="edit-lnk" onclick="showToast('Address edit — coming soon')">Edit <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span>
        </div>
        <div class="addr-box">
          <span class="aname">Gaurav Bhatia,</span> e299 phase 8a mohali punjab, Noida,<br>Uttar Pradesh, India &nbsp;<strong>201301</strong>
          <div class="addr-contact">
            <span><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12 19.79 19.79 0 01.14 3.18 2 2 0 012.11 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.45-.45a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>+918826988586</span>
            <span><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>support@italianshoescompan...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. SHIPPING -->
    <div class="card">
      <div class="ship-hdr" id="shipHdr" onclick="togShip()">
        <svg class="tr-icon" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <span class="ship-hdr-t">Shipping</span>
        <span class="free-lbl">FREE</span>
        <svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="ship-body" id="shipBody">
        <div class="ship-opt">
          <input type="radio" name="ship" checked>
          <div>Free Shipping for Prepaid orders above <strong style="color:#059669">₹399</strong> — <strong style="color:#059669">FREE</strong><div class="cod-note-sm">🚚 COD available + Extra ₹69 charges</div></div>
        </div>
      </div>
    </div>

    <!-- 5. UPSELL PRODUCTS -->
    <div>
      <div class="sec-lbl" style="display:flex;align-items:center;justify-content:space-between">
        <span>You may also like</span>
        <span style="font-size:11px;color:var(--p2);font-weight:600;cursor:pointer">View all →</span>
      </div>
      <div class="upsell-scroll" id="upsellScroll">
        <div class="upsell-card">
          <div class="upsell-img">💎</div>
          <div class="upsell-body">
            <div class="upsell-name">Crystal Drop Earrings Set</div>
            <div class="upsell-pricing"><span class="upsell-price">₹249</span><span class="upsell-mrp">₹499</span><span class="upsell-off">50% off</span></div>
            <button class="upsell-add" onclick="addUpsell(this,'Crystal Drop Earrings')">＋ Add</button>
          </div>
        </div>
        <div class="upsell-card">
          <div class="upsell-img">👜</div>
          <div class="upsell-body">
            <div class="upsell-name">Mini Boho Sling Bag</div>
            <div class="upsell-pricing"><span class="upsell-price">₹599</span><span class="upsell-mrp">₹999</span><span class="upsell-off">40% off</span></div>
            <button class="upsell-add" onclick="addUpsell(this,'Mini Boho Sling Bag')">＋ Add</button>
          </div>
        </div>
        <div class="upsell-card">
          <div class="upsell-img">🌸</div>
          <div class="upsell-body">
            <div class="upsell-name">Floral Scrunchie Pack ×5</div>
            <div class="upsell-pricing"><span class="upsell-price">₹149</span><span class="upsell-mrp">₹299</span><span class="upsell-off">50% off</span></div>
            <button class="upsell-add" onclick="addUpsell(this,'Floral Scrunchie Pack')">＋ Add</button>
          </div>
        </div>
        <div class="upsell-card">
          <div class="upsell-img">🧴</div>
          <div class="upsell-body">
            <div class="upsell-name">Rose Water Face Mist 100ml</div>
            <div class="upsell-pricing"><span class="upsell-price">₹349</span><span class="upsell-mrp">₹499</span><span class="upsell-off">30% off</span></div>
            <button class="upsell-add" onclick="addUpsell(this,'Rose Water Face Mist')">＋ Add</button>
          </div>
        </div>
        <div class="upsell-card">
          <div class="upsell-img">💍</div>
          <div class="upsell-body">
            <div class="upsell-name">Stackable Ring Set – Gold</div>
            <div class="upsell-pricing"><span class="upsell-price">₹399</span><span class="upsell-mrp">₹699</span><span class="upsell-off">43% off</span></div>
            <button class="upsell-add" onclick="addUpsell(this,'Stackable Ring Set')">＋ Add</button>
          </div>
        </div>
        <div class="upsell-card">
          <div class="upsell-img">🧣</div>
          <div class="upsell-body">
            <div class="upsell-name">Satin Silk Scrunchie Set</div>
            <div class="upsell-pricing"><span class="upsell-price">₹199</span><span class="upsell-mrp">₹349</span><span class="upsell-off">43% off</span></div>
            <button class="upsell-add" onclick="addUpsell(this,'Satin Scrunchie Set')">＋ Add</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 6. PAYMENT METHODS -->
    <div>
      <div class="sec-lbl">Payment methods</div>
      <div class="card" style="padding:0">

        <!-- UPI -->
        <div class="pay-row" onclick="openDrw('upi')">
          <div class="pay-icons-wrap">
            <!-- GPay -->
            <div class="pi"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png" alt="GPay" onerror="this.parentNode.innerHTML='G'"></div>
            <!-- PhonePe -->
            <div class="pi"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/PhonePe_Logo.png/512px-PhonePe_Logo.png" alt="PhonePe" onerror="this.parentNode.innerHTML='P'"></div>
            <!-- Paytm -->
            <div class="pi"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/512px-Paytm_Logo_%28standalone%29.svg.png" alt="Paytm" onerror="this.parentNode.innerHTML='₿'"></div>
            <!-- BHIM -->
            <div class="pi"><img src="https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/BHIM_logo.png/220px-BHIM_logo.png" alt="BHIM" onerror="this.parentNode.innerHTML='🏛'"></div>
          </div>
          <div class="pay-info">
            <div class="pay-name">Pay via UPI</div>
            <div class="pay-sub">GPay · PhonePe · Paytm · BHIM</div>
            <div class="pay-offer"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Get ₹12.36 off</div>
            <span class="pay-badge best">BEST VALUE</span>
          </div>
          <div class="pay-price-col">
            <div class="pay-price" id="ppUpi">₹605.84</div>
          </div>
          <div class="pay-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
        </div>

        <!-- Card -->
        <div class="pay-row" onclick="openDrw('card')">
          <div class="pay-icons-wrap" style="align-items:center">
            <div class="pi big">
              <!-- Visa SVG inline -->
              <svg viewBox="0 0 48 48" width="32" height="32"><rect width="48" height="48" rx="6" fill="#1A1F71"/><path d="M19.5 31.5h-3l1.9-11h3L19.5 31.5zm13.1-10.7c-.6-.2-1.6-.5-2.8-.5-3 0-5.2 1.6-5.2 3.9 0 1.7 1.5 2.6 2.7 3.2 1.2.6 1.6 1 1.6 1.5 0 .8-.9 1.2-1.8 1.2-1.2 0-1.8-.2-2.8-.6l-.4-.2-.4 2.5c.7.3 2 .6 3.3.6 3.2 0 5.3-1.6 5.3-4 0-1.3-.8-2.3-2.6-3.1-1.1-.5-1.7-.9-1.7-1.4 0-.5.6-1 1.8-1 1 0 1.7.2 2.3.5l.3.1.4-2.7zm7.9-.3h-2.3c-.7 0-1.2.2-1.5.9l-4.3 10.1h3l.6-1.7h3.7l.3 1.7h2.7L40.5 20.5zm-3.5 7.1l1.1-3.1.5 3.1h-1.6zM17.1 20.5l-3 7.5-.3-1.6c-.6-1.9-2.4-4-4.4-5l2.7 10h3.1l4.7-11H17.1z" fill="#fff"/><path d="M11.5 20.5H6.6l-.1.3c3.8.9 6.3 3.2 7.3 5.9l-1-5.3c-.2-.7-.7-.9-1.3-.9z" fill="#F2AE14"/></svg>
            </div>
          </div>
          <div class="pay-info">
            <div class="pay-name">Debit / Credit card</div>
            <div class="pay-sub">Visa · Mastercard · RuPay · Amex</div>
            <div class="pay-offer"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Get ₹6.18 off</div>
          </div>
          <div class="pay-price-col"><div class="pay-price" id="ppCard">₹612.02</div></div>
          <div class="pay-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
        </div>

        <!-- Wallets -->
        <div class="pay-row" onclick="openDrw('wallet')">
          <div class="pay-icons-wrap" style="align-items:center">
            <div class="pi big">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--p2);fill:none;stroke-width:1.8"><path d="M20 12V22H4V12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7a5 5 0 01-5-5 5 5 0 005 5zM12 7a5 5 0 005-5 5 5 0 01-5 5z"/></svg>
            </div>
          </div>
          <div class="pay-info">
            <div class="pay-name">Wallets</div>
            <div class="pay-sub">Airtel · PayZapp · Mobikwik · Freecharge</div>
          </div>
          <div class="pay-price-col"><div class="pay-price" id="ppWallet">₹618.20</div></div>
          <div class="pay-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
        </div>

        <!-- Netbanking -->
        <div class="pay-row" onclick="openDrw('nb')">
          <div class="pay-icons-wrap" style="align-items:center">
            <div class="pi big">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--p1);fill:none;stroke-width:1.8"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>
            </div>
          </div>
          <div class="pay-info">
            <div class="pay-name">Net banking</div>
            <div class="pay-sub">SBI · HDFC · ICICI · Axis & more</div>
            <div class="pay-offer"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Get ₹6.18 off</div>
            <span class="pay-badge popular">POPULAR</span>
          </div>
          <div class="pay-price-col"><div class="pay-price" id="ppNb">₹612.02</div></div>
          <div class="pay-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
        </div>

        <!-- EMI -->
        <div class="pay-row" onclick="openDrw('emi')">
          <div class="pay-icons-wrap" style="align-items:center">
            <div class="pi big">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:#059669;fill:none;stroke-width:1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h2M11 15h4"/></svg>
            </div>
          </div>
          <div class="pay-info">
            <div class="pay-name">No-cost EMI</div>
            <div class="pay-sub">HDFC · ICICI · Axis · SBI</div>
            <div class="pay-offer"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>From ₹206/month</div>
          </div>
          <div class="pay-price-col"><div class="pay-price" id="ppEmi">₹618.20</div></div>
          <div class="pay-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
        </div>

        <!-- COD -->
        <div class="pay-row" onclick="openDrw('cod')">
          <div class="pay-icons-wrap" style="align-items:center">
            <div class="pi big">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:#d97706;fill:none;stroke-width:1.8"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
          </div>
          <div class="pay-info">
            <div class="pay-name">Cash on delivery</div>
            <div class="pay-sub">Pay at doorstep · ₹69 handling fee</div>
          </div>
          <div class="pay-price-col">
            <div class="pay-price" id="ppCod" style="background:linear-gradient(135deg,#d97706,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">₹687.20</div>
            <div style="font-size:10px;color:var(--text3)">Incl. ₹69 fee</div>
          </div>
          <div class="pay-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
        </div>

      </div>
    </div>

    <!-- FOOTER -->
    <div class="checkout-foot">
      <div class="logged-txt">Logged in with +91 88269 88586</div>
      <button class="logout-btn" onclick="showToast('Logged out successfully')">Log out</button>
    </div>
    <div class="pow-row">
      Secured by
      <span class="pow-chip">GoKwik</span>
      <span class="pow-chip">Razorpay</span>
      <span class="pow-chip">Shiprocket</span>
    </div>

  </div>
</div>

<!-- SUCCESS -->
<div class="success-screen" id="successScr">
  <div class="s-icon"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div>
  <div class="s-title">Order placed! 🎉</div>
  <div class="s-sub">Your order is confirmed and will be delivered by <strong>Wed, 18 Jun 2025</strong></div>
  <div class="s-oid">Order ID<b>#JLT8820614</b></div>
  <div class="s-deliver"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Tracking via Shiprocket — SMS sent to your mobile number</div>
  <button class="track-btn"><svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Track my order</button>
  <div class="pow-row">Powered by <span class="pow-chip">GoKwik</span> &amp; <span class="pow-chip" style="color:#e8531f">Shiprocket</span></div>
</div>

<!-- ===== DRAWERS ===== -->

<!-- UPI -->
<div class="overlay" id="drwUpi" onclick="closeDrw('upi',event)">
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="d-handle"></div>
    <div class="d-hdr">Pay via UPI</div>
    <div class="d-body">
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px;font-weight:500">Choose your UPI app</div>
      <div class="upi-apps">
        <div class="upi-app">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png" alt="GPay" style="width:36px;height:36px;object-fit:contain;border-radius:8px" onerror="this.outerHTML='<span style=font-size:28px>G</span>'">
          <small>GPay</small>
        </div>
        <div class="upi-app">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/PhonePe_Logo.png/512px-PhonePe_Logo.png" alt="PhonePe" style="width:36px;height:36px;object-fit:contain;border-radius:8px" onerror="this.outerHTML='<span style=font-size:28px>P</span>'">
          <small>PhonePe</small>
        </div>
        <div class="upi-app">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/512px-Paytm_Logo_%28standalone%29.svg.png" alt="Paytm" style="width:36px;height:36px;object-fit:contain;border-radius:8px" onerror="this.outerHTML='<span style=font-size:28px>₿</span>'">
          <small>Paytm</small>
        </div>
        <div class="upi-app">
          <img src="https://upload.wikimedia.org/wikipedia/en/thumb/6/6c/BHIM_logo.png/220px-BHIM_logo.png" alt="BHIM" style="width:36px;height:36px;object-fit:contain;border-radius:8px" onerror="this.outerHTML='<span style=font-size:28px>🏛</span>'">
          <small>BHIM</small>
        </div>
      </div>
      <div class="div-or">OR enter UPI ID</div>
      <div class="upi-id-row">
        <input type="text" placeholder="yourname@okaxis" id="upiIn">
        <button class="upi-verify" onclick="verUpi()">Verify</button>
      </div>
      <button class="pay-now" onclick="addRipple(event);placeOrder('UPI')">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Pay <span id="upiPayAmt">₹605.84</span>
      </button>
      <div class="pay-note">✦ 1% extra UPI cashback applied</div>
    </div>
  </div>
</div>

<!-- CARD -->
<div class="overlay" id="drwCard" onclick="closeDrw('card',event)">
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="d-handle"></div>
    <div class="d-hdr">Debit / Credit card</div>
    <div class="d-body">
      <div class="field"><label>Card number</label><input type="text" placeholder="1234  5678  9012  3456" maxlength="19" oninput="fmtCard(this)"></div>
      <div class="field"><label>Name on card</label><input type="text" placeholder="GAURAV BHATIA" style="text-transform:uppercase"></div>
      <div class="row2">
        <div class="field"><label>Expiry (MM / YY)</label><input type="text" placeholder="08 / 27" maxlength="7" oninput="fmtExpiry(this)"></div>
        <div class="field"><label>CVV</label><input type="password" placeholder="•••" maxlength="4"></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <input type="checkbox" id="sc" style="accent-color:var(--p1);width:16px;height:16px">
        <label for="sc" style="font-size:12px;color:var(--text2);cursor:pointer">Save card for faster checkout</label>
      </div>
      <!-- Network logos row -->
      <div style="display:flex;gap:8px;align-items:center;padding:10px 0;border-top:1px solid var(--border);margin-top:8px">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/512px-Visa_Inc._logo.svg.png" style="height:18px;object-fit:contain" alt="Visa" onerror="this.outerHTML='<span style=font-size:11px;font-weight:700;color:#1A1F71>VISA</span>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/512px-Mastercard-logo.svg.png" style="height:20px;object-fit:contain" alt="MC" onerror="this.outerHTML='<span style=font-size:11px;font-weight:700>MC</span>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/RuPay.svg/512px-RuPay.svg.png" style="height:18px;object-fit:contain" alt="RuPay" onerror="this.outerHTML='<span style=font-size:11px;font-weight:700>RuPay</span>'">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/American_Express_logo.svg/512px-American_Express_logo.svg.png" style="height:20px;object-fit:contain" alt="Amex" onerror="this.outerHTML='<span style=font-size:11px;font-weight:700;color:#007BC1>Amex</span>'">
      </div>
      <button class="pay-now" onclick="addRipple(event);placeOrder('Card')">
        <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
        Pay <span id="cardPayAmt">₹612.02</span>
      </button>
    </div>
  </div>
</div>

<!-- WALLET -->
<div class="overlay" id="drwWallet" onclick="closeDrw('wallet',event)">
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="d-handle"></div>
    <div class="d-hdr">Pay via Wallet</div>
    <div class="d-body">
      <div class="bank-grid">
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">✈️</div>Airtel</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">💙</div>PayZapp</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🏧</div>Freecharge</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">💛</div>Mobikwik</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🌐</div>PayPal</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🪙</div>JioMoney</div>
      </div>
      <button class="pay-now" onclick="addRipple(event);placeOrder('Wallet')">
        <svg viewBox="0 0 24 24"><path d="M20 12V22H4V12"/><rect x="2" y="7" width="20" height="5"/></svg>
        Pay <span id="walletPayAmt">₹618.20</span>
      </button>
    </div>
  </div>
</div>

<!-- NET BANKING -->
<div class="overlay" id="drwNb" onclick="closeDrw('nb',event)">
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="d-handle"></div>
    <div class="d-hdr">Net banking</div>
    <div class="d-body">
      <div style="font-size:13px;color:var(--text2);font-weight:500;margin-bottom:10px">Popular banks</div>
      <div class="bank-grid">
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🏦</div>SBI</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🔵</div>HDFC</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🟠</div>ICICI</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🟣</div>Axis</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🔴</div>Kotak</div>
        <div class="bank-tile" onclick="selBank(this)"><div class="icon">🟡</div>PNB</div>
      </div>
      <div class="field"><label>Other bank</label><select><option>Select bank</option><option>Bank of Baroda</option><option>Bank of India</option><option>Canara Bank</option><option>Union Bank</option><option>Yes Bank</option><option>IDFC First</option></select></div>
      <button class="pay-now" onclick="addRipple(event);placeOrder('Net Banking')">
        <svg viewBox="0 0 24 24"><line x1="3" y1="22" x2="21" y2="22"/><polygon points="12 2 20 7 4 7"/></svg>
        Pay <span id="nbPayAmt">₹612.02</span>
      </button>
    </div>
  </div>
</div>

<!-- EMI -->
<div class="overlay" id="drwEmi" onclick="closeDrw('emi',event)">
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="d-handle"></div>
    <div class="d-hdr">No-cost EMI</div>
    <div class="d-body">
      <div class="emi-row"><div><div class="emi-bank">HDFC Bank <span class="no-cost">NO COST</span></div><div class="emi-tenure">3 months</div></div><div class="emi-amt">₹206/mo</div></div>
      <div class="emi-row"><div><div class="emi-bank">ICICI Bank <span class="no-cost">NO COST</span></div><div class="emi-tenure">6 months</div></div><div class="emi-amt">₹103/mo</div></div>
      <div class="emi-row"><div><div class="emi-bank">Axis Bank</div><div class="emi-tenure">9 months · 12% p.a.</div></div><div class="emi-amt">₹73/mo</div></div>
      <div class="emi-row"><div><div class="emi-bank">SBI Card</div><div class="emi-tenure">12 months · 14% p.a.</div></div><div class="emi-amt">₹57/mo</div></div>
      <button class="pay-now" onclick="addRipple(event);placeOrder('EMI')">
        <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
        Choose &amp; Pay EMI
      </button>
    </div>
  </div>
</div>

<!-- COD -->
<div class="overlay" id="drwCod" onclick="closeDrw('cod',event)">
  <div class="drawer" onclick="event.stopPropagation()">
    <div class="d-handle"></div>
    <div class="d-hdr">Cash on delivery</div>
    <div class="d-body">
      <div class="cod-warn"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><span>A handling fee of <strong>₹69</strong> is added. Final amount: <strong id="codFinalAmt">₹687.20</strong>. COD orders take 1–2 extra days to process.</span></div>
      <div class="cod-save-note"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>Save ₹69 by switching to UPI — fastest delivery!</div>
      <button class="pay-now" style="background:linear-gradient(135deg,#d97706,#f59e0b,#fbbf24)" onclick="addRipple(event);placeOrder('COD')">
        <svg viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        Place COD order — <span id="codPayAmt">₹687.20</span>
      </button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>


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

    autoInject: function() {
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
          form.appendChild(fastCheckoutBtn);
        });
      });
    }
  };

  window.CheckoutFlow.autoInject();
})();
