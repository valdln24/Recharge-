"use strict";
/* Accueil v3 : apparitions au défilement, cartes flottantes en parallaxe, cartes à faire glisser sur mobile, période des tarifs. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* 1. Apparition en fondu */
  var els = document.querySelectorAll(".rv");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  } else els.forEach(function (e) { e.classList.add("in"); });
  /* 2. Téléphone et cartes flottantes qui glissent avec le défilement */
  var phone = document.querySelector(".h3stage .phone"), cards = document.querySelectorAll(".fcard[data-sp]"), ticking = false;
  function para() {
    ticking = false; var y = Math.min(scrollY, 900);
    if (phone) { phone.style.setProperty("--py", (-y * .06).toFixed(1)); phone.style.setProperty("--ps", (1 + Math.min(y, 500) / 500 * .04).toFixed(3)); }
    cards.forEach(function (c) { c.style.setProperty("--fy", (-y * +c.dataset.sp).toFixed(1)); });
  }
  if (!reduce) { addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(para); } }, { passive: true }); para(); }
  /* 3. Mobile : les cartes se fondent et se redressent pendant qu'on les fait glisser */
  document.querySelectorAll("[data-swipe]").forEach(function (box) {
    var items = [].slice.call(box.children), dots = box.parentNode.querySelector(".swdots");
    if (dots) dots.innerHTML = items.map(function () { return "<i></i>"; }).join("");
    var di = dots ? [].slice.call(dots.children) : [];
    function upd() {
      if (box.scrollWidth <= box.clientWidth + 4) { items.forEach(function (it) { it.style.removeProperty("--o"); it.style.removeProperty("--s"); }); return; }
      var mid = box.scrollLeft + box.clientWidth / 2, best = 0, bd = 1e9;
      items.forEach(function (it, i) {
        var c = it.offsetLeft + it.offsetWidth / 2, d = Math.abs(c - mid) / it.offsetWidth;
        it.style.setProperty("--o", Math.max(.45, 1 - d * .55).toFixed(3)); it.style.setProperty("--s", Math.max(.92, 1 - d * .08).toFixed(3));
        if (d < bd) { bd = d; best = i; }
      });
      di.forEach(function (d, i) { d.classList.toggle("on", i === best); });
    }
    box.addEventListener("scroll", function () { requestAnimationFrame(upd); }, { passive: true }); addEventListener("resize", upd); upd();
  });
  /* 4. Petit réseau dessiné : vous, vos clients, et les personnes qu'ils connaissent */
  var svg = document.getElementById("netMini");
  if (svg) {
    var NS = "http://www.w3.org/2000/svg", h = "", GA = 2.39996;
    for (var i = 0; i < 9; i++) {
      var a = i * GA, r = 46 + (i % 3) * 6, x = Math.cos(a) * r, y = Math.sin(a) * r;
      h += '<line x1="0" y1="0" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.18)"/>';
      for (var j = 0; j < 5; j++) { var aa = a + (j - 2) * .11, rr = 86 + ((i * 7 + j * 13) % 20); h += '<circle cx="' + (Math.cos(aa) * rr).toFixed(1) + '" cy="' + (Math.sin(aa) * rr).toFixed(1) + '" r="2.4" fill="' + (j % 2 ? "#FFB98F" : "#B8BCFF") + '" opacity=".85"/>'; }
      h += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="#FF782E"/>';
    }
    h += '<circle r="20" fill="#fff"/><text y="5" text-anchor="middle" font-size="13" font-weight="800" fill="#17151B">Vous</text>';
    svg.innerHTML = h;
  }
  /* 5. Mobile : le bouton « Analyser » collé en bas apparaît une fois la carte du haut passée, et disparaît sur l'appel final */
  var mc = document.getElementById("mcta"), ac = document.getElementById("acard"), fin = document.querySelector(".fin3");
  if (mc && ac && fin) {
    var mcu = function () { var past = ac.getBoundingClientRect().bottom < 0, end = fin.getBoundingClientRect().top < innerHeight * .9; mc.classList.toggle("show", past && !end); };
    addEventListener("scroll", mcu, { passive: true }); mcu();
  }
  /* 6. Tarifs : l'annuel par défaut, prix fondateur tant qu'il reste des places (compteur réel du serveur) */
  var P = { starter: [990, 8900, 590, 5900], pro: [1990, 17900, 1190, 11900], equipe: [990, 8900, 790, 7100] }, year = true, founder = true;
  var eur = function (c) { return (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " €"; };
  function prices() {
    document.querySelectorAll(".p3 .pc").forEach(function (c) {
      var p = P[c.dataset.t]; if (!p) return;
      var n = year ? p[1] : p[0], f = year ? p[3] : p[2], v = founder ? f : n;
      c.querySelector(".pv").textContent = eur(year ? Math.round(v / 12) : v);
      var s = c.querySelector(".pn"); s.textContent = founder ? eur(year ? Math.round(n / 12) : n) : ""; s.style.display = founder ? "" : "none";
      c.querySelector(".pb").textContent = year ? "Facturé " + eur(v) + " par an" + (founder ? " au lieu de " + eur(n) : "") : "Sans engagement" + (founder ? " · au lieu de " + eur(n) : "");
    });
  }
  var tog = document.querySelector(".tog");
  if (tog) tog.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    tog.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    year = b.dataset.p === "year"; prices();
  });
  fetch("/api/offers").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || typeof j.founderLeft !== "number") return;
    var fnd = document.getElementById("fnd"), t = j.founderTotal || 50;
    if (j.founderLeft <= 0) { founder = false; if (fnd) fnd.style.display = "none"; prices(); return; }
    document.getElementById("fndTxt").textContent = "Encore " + j.founderLeft + " place" + (j.founderLeft > 1 ? "s" : "") + " sur " + t + " · gardé tant que l'abonnement continue.";
    document.getElementById("fndArc").setAttribute("stroke-dasharray", (94.2 * j.founderLeft / t).toFixed(1) + " 94.2");
  }).catch(function () {});
  prices();
})();
