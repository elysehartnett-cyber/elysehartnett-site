/* Elyse Hartnett Fine Art — interactions */
(function () {
  "use strict";

  /* ---- nav: solid on scroll ---- */
  var nav = document.getElementById("nav");
  var hero = document.querySelector(".hero");
  var solidAt = hero ? hero.offsetHeight - 90 : 24;
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("is-solid", window.scrollY > solidAt);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { solidAt = hero ? hero.offsetHeight - 90 : 24; onScroll(); });
  onScroll();

  /* ---- mobile menu ---- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); });
    });
  }

  /* ---- lightbox ---- */
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightboxImg");
  var lbClose = document.getElementById("lightboxClose");
  if (lb) {
    var gallery = [], gi = 0;
    function show() { lbImg.src = gallery[gi]; }
    function advance() { if (gallery.length > 1) { gi = (gi + 1) % gallery.length; show(); } }
    document.querySelectorAll("[data-lightbox]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var imgs = el.getAttribute("data-images");
        gallery = imgs ? imgs.split("|") : [el.getAttribute("href")];
        gi = 0;
        lbImg.alt = (el.querySelector("img") || {}).alt || "";
        show();
        lb.classList.toggle("has-more", gallery.length > 1);
        lb.classList.add("open");
      });
    });
    lbImg.addEventListener("click", function (e) { e.stopPropagation(); advance(); });
    function close() { lb.classList.remove("open"); lbImg.src = ""; }
    lbClose.addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") advance();
    });
  }

  /* ---- placeholder buy buttons (until Stripe links are wired) ---- */
  document.querySelectorAll("[data-buy]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var href = btn.getAttribute("href");
      if (!href || href === "#") {
        e.preventDefault();
        btn.textContent = "Checkout — coming soon";
        setTimeout(function () { btn.textContent = btn.dataset.label || "Buy print"; }, 1800);
      }
    });
  });

  /* ---- forms: post to Netlify (storage) + MailerLite (newsletter), show inline confirmation ---- */
  var ML_ENDPOINT = "https://assets.mailerlite.com/jsonp/2421833/forms/189864220532148078/subscribe";
  function encode(data) {
    return Object.keys(data).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
    }).join("&");
  }
  // Newsletter signups also flow into MailerLite (fire-and-forget; Netlify is the source of truth).
  function sendToMailerLite(email) {
    if (!email) return;
    var body = "fields[email]=" + encodeURIComponent(email) + "&ml-submit=1&anticsrf=true";
    fetch(ML_ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body }).catch(function () {});
  }
  document.querySelectorAll("form[data-netlify]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      if (form.getAttribute("name") === "newsletter") sendToMailerLite(data.email);
      var confirmMsg = form.getAttribute("data-confirm") || "Thank you — I'll be in touch.";
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: encode(data) })
        .then(function () { showConfirm(form, confirmMsg); })
        .catch(function () { showConfirm(form, confirmMsg); }); // preview/local: still confirm
    });
  });
  function showConfirm(form, msg) {
    var note = document.createElement("p");
    note.className = "form-confirm";
    note.textContent = msg;
    note.style.cssText = "margin-top:1rem;font-family:var(--serif);font-style:italic;font-size:1.15rem;color:inherit;";
    form.replaceWith(note);
  }

  /* ---- protect artwork: block right-click "Save image", dragging, and iOS long-press-save on images ----
     Targets images only, so normal right-click on text/links still works. A light deterrent, not a lock;
     the real protection is that images are served at web resolution, too small for a quality print. */
  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.closest && e.target.closest("img")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) {
    if (e.target && e.target.closest && e.target.closest("img")) e.preventDefault();
  });
})();
