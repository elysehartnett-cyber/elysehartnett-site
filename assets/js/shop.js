/* Elyse Hartnett Fine Art — shop + cart
   Renders the shop from products.json, manages a sessionStorage cart, and
   hands the cart to the Netlify checkout function. Prices are re-verified
   server-side at checkout; nothing here is trusted for money. */
(function () {
  "use strict";

  var CART_KEY = "eh_cart_v1";
  var CATALOG = null;
  var byId = {};

  var GROUPS = [
    { key: "matted", label: "Matted 8×10 prints",
      sub: "8×10 giclée prints, matted to 11×14, signed. Ready for any standard frame." },
    { key: "framed", label: "Framed 4×6 prints",
      sub: "Small giclée prints in a natural wood frame with plexiglass — ready to display." },
    { key: "cards", label: "Greeting cards",
      sub: "Folded 5×7 cards, blank inside, with envelopes." }
  ];

  /* ---------- helpers ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(cents) {
    var d = cents / 100;
    return "$" + (cents % 100 === 0 ? d.toFixed(0) : d.toFixed(2));
  }
  function maxQty(p) { return Math.max(1, Math.min(p && p.stock ? p.stock : 25, 25)); }

  /* ---------- cart state ---------- */
  function readCart() {
    try { return JSON.parse(sessionStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeCart(cart) {
    cart = cart.filter(function (i) { return i.qty > 0 && byId[i.id]; });
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
    updateBadge();
  }
  function cartCount() {
    return readCart().reduce(function (n, i) { return n + i.qty; }, 0);
  }
  function subtotalCents() {
    return readCart().reduce(function (s, i) {
      var p = byId[i.id]; return s + (p ? p.priceCents * i.qty : 0);
    }, 0);
  }
  function addToCart(id, qty) {
    var p = byId[id]; if (!p) return;
    qty = Math.max(1, qty || 1);
    var cart = readCart();
    var line = cart.filter(function (i) { return i.id === id; })[0];
    if (line) line.qty = Math.min(line.qty + qty, maxQty(p));
    else cart.push({ id: id, qty: Math.min(qty, maxQty(p)) });
    writeCart(cart);
  }
  function setQty(id, qty) {
    var p = byId[id]; if (!p) return;
    var cart = readCart();
    var line = cart.filter(function (i) { return i.id === id; })[0];
    if (line) line.qty = Math.max(0, Math.min(qty, maxQty(p)));
    writeCart(cart);
  }

  /* ---------- render shop grid ---------- */
  function renderShop() {
    var grid = el("shop-grid");
    if (!grid) return;
    var active = CATALOG.products.filter(function (p) { return p.active; });
    grid.innerHTML = GROUPS.map(function (g) {
      var items = active.filter(function (p) { return p.category === g.key; });
      if (!items.length) return "";
      return (
        '<section class="shop-group">' +
          '<div class="shop-group__head">' +
            '<h2>' + esc(g.label) + '</h2>' +
            '<p>' + esc(g.sub) + '</p>' +
          '</div>' +
          '<div class="grid-prints">' + items.map(cardHtml).join("") + '</div>' +
        '</section>'
      );
    }).join("");
  }

  function cardHtml(p) {
    var img0 = p.images[0], img1 = p.images[1] || p.images[0];
    return (
      '<article class="print" data-id="' + esc(p.id) + '">' +
        '<button class="print__img" type="button" data-view="' + esc(p.id) + '" aria-label="View ' + esc(p.shortName) + '">' +
          '<img src="' + esc(img0) + '" alt="' + esc(p.shortName) + '" loading="lazy" />' +
          '<img class="pi-2" src="' + esc(img1) + '" alt="" loading="lazy" />' +
        '</button>' +
        '<h3 class="print__name">' + esc(p.shortName) + '</h3>' +
        '<p class="print__meta">' + esc(p.categoryLabel) + '</p>' +
        '<p class="print__short">' + esc(p.short) + '</p>' +
        '<div class="print__row">' +
          '<span class="print__price">' + money(p.priceCents) + '</span>' +
          '<button class="btn btn--buy" type="button" data-add="' + esc(p.id) + '">Add to cart</button>' +
        '</div>' +
      '</article>'
    );
  }

  /* ---------- product modal ---------- */
  function openProduct(id) {
    var p = byId[id]; if (!p) return;
    var m = el("pmodal"); if (!m) return;
    var imgs = p.images.map(function (src, i) {
      return '<img src="' + esc(src) + '" alt="' + esc(p.shortName) + (i ? " (detail)" : "") + '" class="pmodal__img' + (i === 0 ? " is-active" : "") + '" />';
    }).join("");
    var thumbs = p.images.length > 1 ? '<div class="pmodal__thumbs">' + p.images.map(function (src, i) {
      return '<button type="button" class="pmodal__thumb' + (i === 0 ? " is-active" : "") + '" data-thumb="' + i + '"><img src="' + esc(src) + '" alt="" /></button>';
    }).join("") + '</div>' : "";
    var desc = String(p.description).split("\n\n").map(function (para) {
      return "<p>" + esc(para) + "</p>";
    }).join("");
    var specs = (p.specs || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");

    el("pmodalBody").innerHTML =
      '<div class="pmodal__media">' + imgs + thumbs + '</div>' +
      '<div class="pmodal__info">' +
        '<p class="eyebrow">' + esc(p.categoryLabel) + '</p>' +
        '<h2 id="pmodalTitle">' + esc(p.shortName) + '</h2>' +
        '<p class="pmodal__price">' + money(p.priceCents) + '</p>' +
        '<div class="pmodal__desc">' + desc + '</div>' +
        (specs ? '<ul class="pmodal__specs">' + specs + '</ul>' : "") +
        '<div class="pmodal__buy">' +
          qtyStepperHtml(id, 1) +
          '<button class="btn" type="button" data-add-modal="' + esc(id) + '">Add to cart</button>' +
        '</div>' +
      '</div>';
    m.hidden = false;
    document.body.classList.add("noscroll");
  }
  function closeProduct() {
    var m = el("pmodal"); if (m) m.hidden = true;
    if (!isCartOpen()) document.body.classList.remove("noscroll");
  }
  function qtyStepperHtml(id, qty) {
    return '<div class="qty" data-qty-for="' + esc(id) + '">' +
      '<button type="button" class="qty__btn" data-step="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<span class="qty__n">' + qty + '</span>' +
      '<button type="button" class="qty__btn" data-step="1" aria-label="Increase quantity">+</button>' +
    '</div>';
  }

  /* ---------- cart drawer ---------- */
  function isCartOpen() { var c = el("cart"); return c && !c.hidden; }
  function openCart() { var c = el("cart"); if (c) { c.hidden = false; document.body.classList.add("noscroll"); renderCart(); } }
  function closeCart() { var c = el("cart"); if (c) { c.hidden = true; if (!(el("pmodal") && !el("pmodal").hidden)) document.body.classList.remove("noscroll"); } }

  function updateBadge() {
    var b = el("cartCount"); if (!b) return;
    var n = cartCount();
    b.textContent = n;
    b.classList.toggle("is-empty", n === 0);
  }

  function renderCart() {
    var wrap = el("cartItems"); if (!wrap) return;
    var cart = readCart();
    if (!cart.length) {
      wrap.innerHTML = '<p class="cart__empty">Your cart is empty.</p>';
      el("cartFoot").innerHTML = "";
      return;
    }
    wrap.innerHTML = cart.map(function (i) {
      var p = byId[i.id];
      return (
        '<div class="citem" data-id="' + esc(p.id) + '">' +
          '<img class="citem__img" src="' + esc(p.images[0]) + '" alt="" />' +
          '<div class="citem__info">' +
            '<p class="citem__name">' + esc(p.shortName) + '</p>' +
            '<p class="citem__meta">' + esc(p.categoryLabel) + ' · ' + money(p.priceCents) + '</p>' +
            qtyStepperHtml(p.id, i.qty) +
          '</div>' +
          '<div class="citem__end">' +
            '<span class="citem__line">' + money(p.priceCents * i.qty) + '</span>' +
            '<button type="button" class="citem__remove" data-remove="' + esc(p.id) + '">Remove</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    var sub = subtotalCents();
    var threshold = CATALOG.shipping.freeThresholdCents;
    var free = sub >= threshold;
    var ship = free ? 0 : CATALOG.shipping.flatCents;
    var nudge = free
      ? '<p class="cart__nudge is-free">You\'ve earned free shipping.</p>'
      : '<p class="cart__nudge">Add ' + money(threshold - sub) + ' more for free shipping.</p>';

    el("cartFoot").innerHTML =
      nudge +
      '<div class="cart__line"><span>Subtotal</span><span>' + money(sub) + '</span></div>' +
      '<div class="cart__line"><span>Shipping</span><span>' + (free ? "Free" : money(ship)) + '</span></div>' +
      '<div class="cart__line cart__line--total"><span>Total</span><span>' + money(sub + ship) + '</span></div>' +
      '<button class="btn cart__checkout" type="button" id="checkoutBtn">Checkout</button>' +
      '<p class="cart__fine">Shipping to the US. Taxes, if any, calculated at checkout.</p>' +
      '<div class="cart__msg" id="cartMsg" role="alert"></div>';
  }

  /* ---------- checkout ---------- */
  function checkout() {
    var cart = readCart();
    if (!cart.length) return;
    var btn = el("checkoutBtn");
    var msg = el("cartMsg");
    if (msg) msg.textContent = "";
    if (btn) { btn.disabled = true; btn.textContent = "Taking you to secure checkout…"; }
    fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(function (i) { return { id: i.id, quantity: i.qty }; }) })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d && res.d.url) { window.location.href = res.d.url; return; }
        throw new Error((res.d && res.d.error) || "Checkout could not be started.");
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = "Checkout"; }
        if (msg) msg.textContent = err.message + " Please try again, or email elysehartnett@gmail.com.";
      });
  }

  /* ---------- return from Stripe ---------- */
  function handleReturn() {
    var q = new URLSearchParams(location.search);
    var state = q.get("checkout");
    if (!state) return;
    var banner = el("shopBanner");
    if (state === "success") {
      sessionStorage.removeItem(CART_KEY);
      updateBadge(); renderCart();
      if (banner) {
        banner.className = "shop-banner is-success";
        banner.innerHTML = "Thank you — your order is in. You'll get a confirmation email from Stripe, and I'll be in touch when it ships.";
        banner.hidden = false;
      }
    } else if (state === "cancel") {
      if (banner) {
        banner.className = "shop-banner";
        banner.innerHTML = "Checkout canceled — your cart is still here whenever you're ready.";
        banner.hidden = false;
      }
    }
    history.replaceState({}, "", location.pathname);
  }

  /* ---------- events (delegated) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-add],[data-view],[data-add-modal],[data-remove],[data-step],[data-thumb],[data-cart-open],[data-cart-close],[data-close],#checkoutBtn");
    if (!t) return;

    if (t.hasAttribute("data-add")) { addToCart(t.getAttribute("data-add"), 1); openCart(); }
    else if (t.hasAttribute("data-view")) { openProduct(t.getAttribute("data-view")); }
    else if (t.hasAttribute("data-add-modal")) {
      var id = t.getAttribute("data-add-modal");
      var stepper = document.querySelector('.pmodal [data-qty-for="' + id + '"] .qty__n');
      addToCart(id, stepper ? parseInt(stepper.textContent, 10) : 1);
      closeProduct(); openCart();
    }
    else if (t.hasAttribute("data-remove")) { setQty(t.getAttribute("data-remove"), 0); }
    else if (t.hasAttribute("data-step")) {
      var box = t.closest("[data-qty-for]");
      var pid = box.getAttribute("data-qty-for");
      var span = box.querySelector(".qty__n");
      var cur = parseInt(span.textContent, 10) || 1;
      var next = cur + parseInt(t.getAttribute("data-step"), 10);
      // In the cart, changing qty updates the cart. In the modal, it's a local picker.
      if (t.closest("#cartItems")) { setQty(pid, next); }
      else { span.textContent = Math.max(1, Math.min(next, maxQty(byId[pid]))); }
    }
    else if (t.hasAttribute("data-thumb")) {
      var i = parseInt(t.getAttribute("data-thumb"), 10);
      var imgs = document.querySelectorAll(".pmodal__img");
      var ths = document.querySelectorAll(".pmodal__thumb");
      imgs.forEach(function (im, k) { im.classList.toggle("is-active", k === i); });
      ths.forEach(function (b, k) { b.classList.toggle("is-active", k === i); });
    }
    else if (t.hasAttribute("data-cart-open")) { openCart(); }
    else if (t.hasAttribute("data-cart-close")) { closeCart(); }
    else if (t.hasAttribute("data-close")) { closeProduct(); }
    else if (t.id === "checkoutBtn") { checkout(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeProduct(); closeCart(); }
  });

  /* ---------- init ---------- */
  fetch("/products.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      CATALOG = data;
      data.products.forEach(function (p) { byId[p.id] = p; });
      renderShop();
      renderCart();
      updateBadge();
      handleReturn();
    })
    .catch(function () {
      var grid = el("shop-grid");
      if (grid) grid.innerHTML = '<p class="shop-error">The shop couldn\'t load just now. Please refresh, or email elysehartnett@gmail.com to order.</p>';
    });
})();
