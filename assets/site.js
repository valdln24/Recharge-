"use strict";
/* Script commun à toutes les pages du site. Chaque bloc ne s'active que si ses éléments sont présents. */
const $ = id => document.getElementById(id);

/* Navigation qui se fige au défilement */
const nav = $("nav");
if (nav) addEventListener("scroll", () => nav.classList.toggle("solid", scrollY > 10), { passive: true });
if ($("year")) $("year").textContent = new Date().getFullYear();

/* Téléphone : l'appli de démonstration est affichée à l'échelle de l'écran */
const screen = $("screen"), frame = $("demo");
if (screen && frame) {
  const fitPhone = () => {
    const s = screen.clientWidth / 375;
    frame.style.transform = `scale(${s})`;
    frame.style.height = (screen.clientHeight / s) + "px";
  };
  new ResizeObserver(fitPhone).observe(screen); fitPhone();
}

/* Bandeau défilant : contenu doublé pour une boucle continue */
const track = $("track");
if (track) track.innerHTML += track.innerHTML;

/* Jauge en segments (bloc résultats) */
const dialSvg = $("dialSvg");
if (dialSvg) {
  const lerp = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const [x, y] = [p(a), p(b)];
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const n = 19, lit = Math.round(Number(dialSvg.dataset.value || .42) * n), cx = 130, cy = 134, R = 104;
  let h = "";
  for (let i = 0; i < n; i++) {
    const th = 192 + i * (156 / (n - 1)), r = th * Math.PI / 180, t = i / (n - 1);
    const x = (cx + R * Math.cos(r)).toFixed(1), y = (cy + R * Math.sin(r)).toFixed(1);
    const c = i < lit ? (t < .5 ? lerp("#6f86ff", "#ffb48c", t * 2) : lerp("#ffb48c", "#ff4f1a", (t - .5) * 2)) : "rgba(255,255,255,.09)";
    h += `<rect x="${(x - 6.5).toFixed(1)}" y="${(y - 17).toFixed(1)}" width="13" height="34" rx="6.5" style="--c:${c};transition-delay:${i * 45}ms" transform="rotate(${(th - 90).toFixed(1)} ${x} ${y})"/>`;
  }
  dialSvg.innerHTML = h;
}

/* Compteurs animés */
function countUp(el) {
  const to = Number(el.dataset.to), t0 = performance.now(), d = 1400;
  const step = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(to * e).toLocaleString("fr-FR"); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* Calculateur de l'offre Équipe : 49 € jusqu'à 10 filleuls, puis 4 € par filleul en plus */
const TEAM_BASE = 49, TEAM_INCLUDED = 10, TEAM_EXTRA = 4;
const teamSize = $("teamSize");
const eur = n => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
if (teamSize) {
  const updateTeam = animate => {
    const n = Number(teamSize.value);
    const price = TEAM_BASE + Math.max(0, n - TEAM_INCLUDED) * TEAM_EXTRA;
    const priceEl = $("teamPrice");
    priceEl.textContent = eur(price);
    $("teamSizeOut").textContent = n;
    $("teamPer").textContent = eur(Math.round(price / n * 100) / 100);
    teamSize.style.setProperty("--p", ((n - 1) / 49 * 100) + "%");
    if (animate) { priceEl.classList.remove("bump"); void priceEl.offsetWidth; priceEl.classList.add("bump"); }
  };
  teamSize.addEventListener("input", () => updateTeam(true));
  updateTeam(false);
}

/* Simulateur : panier 50 €, 1 client sur 4 non relancé, Recharge en récupère la moitié */
const simN = $("simN");
if (simN) {
  const r5 = v => Math.round(v / 5) * 5, r10 = v => Math.round(v / 10) * 10;
  const fmtE = v => v.toLocaleString("fr-FR") + " €";
  const updateSim = () => {
    const n = Number(simN.value), lostM = n * .25 * 50, gainM = lostM / 2;
    $("simNOut").textContent = n;
    $("sLostM").textContent = "≈ " + fmtE(r5(lostM));
    $("sGainM").textContent = "≈ " + fmtE(r10(gainM));
    $("sGainX").textContent = `${Math.max(1, Math.round(gainM * .25 / 9.9))} fois son prix`;
    simN.style.setProperty("--p", ((n - 10) / 70 * 100) + "%");
  };
  simN.addEventListener("input", updateSim);
  updateSim();
}

/* Téléphone : points sous les cartes à faire glisser */
document.querySelectorAll(".swipe").forEach(el => {
  const dots = document.createElement("div"); dots.className = "dots-nav";
  dots.innerHTML = [...el.children].map(() => "<i></i>").join("");
  el.after(dots);
  const update = () => {
    const kids = [...el.children], mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0, bd = 1e9;
    kids.forEach((k, i) => { const c = k.offsetLeft + k.offsetWidth / 2, d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
    [...dots.children].forEach((d, i) => d.classList.toggle("on", i === best));
  };
  el.addEventListener("scroll", update, { passive: true });
  if (el.dataset.start && matchMedia("(max-width:720px)").matches) {
    const k = el.children[Number(el.dataset.start)];
    requestAnimationFrame(() => { el.scrollLeft = k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2; update(); });
  } else update();
});

/* Bouton « Commencer » toujours visible sur téléphone, entre le haut de page et l'appel final */
const mcta = $("mcta"), heroEl = document.querySelector(".hero, .phero"), finalEl = document.querySelector(".final");
if (mcta && heroEl && finalEl) {
  const toggleCta = () => {
    const past = heroEl.getBoundingClientRect().bottom < 0, atEnd = finalEl.getBoundingClientRect().top < innerHeight;
    mcta.classList.toggle("show", past && !atEnd);
  };
  addEventListener("scroll", toggleCta, { passive: true }); toggleCta();
}

/* Le badge ajouté par l'hébergeur ne doit pas cacher le bouton */
function avoidHostBadge() { const bd = $("nl-badge-frame"); document.documentElement.style.setProperty("--badge", bd && bd.offsetHeight ? "58px" : "0px"); }
new MutationObserver(avoidHostBadge).observe(document.body, { childList: true }); avoidHostBadge();

/* Menu plein écran */
const menu = $("menu"), burger = $("burger");
if (menu && burger) {
  const openMenu = () => { menu.hidden = false; document.body.classList.add("menu-on"); burger.setAttribute("aria-expanded", "true"); requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("open"))); };
  const closeMenu = () => { menu.classList.remove("open"); document.body.classList.remove("menu-on"); burger.setAttribute("aria-expanded", "false"); setTimeout(() => { if (!menu.classList.contains("open")) menu.hidden = true; }, 300); };
  burger.addEventListener("click", openMenu);
  $("menuX").addEventListener("click", closeMenu);
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));
  addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) closeMenu(); });
}

/* Apparitions au défilement */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    en.target.classList.add("in");
    en.target.querySelectorAll(".dial").forEach(d => d.classList.add("go"));
    en.target.querySelectorAll(".count").forEach(c => reduce ? (c.textContent = c.dataset.to) : countUp(c));
    io.unobserve(en.target);
  }
}, { threshold: .18 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

/* Potentiel interactif : vous, vos clients (×10) et vos prospects (×5), dessinés en constellation */
const potSvg = $("potSvg");
if (potSvg) {
  const NS = "http://www.w3.org/2000/svg", GA = 2.39996, PANIER = 35;
  const potC = $("potC"), potP = $("potP");
  let boom = false, shown = 0;
  const rnd = s => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
  const el = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  potSvg.innerHTML = `<defs><radialGradient id="gO" cx="35%" cy="30%"><stop offset="0" stop-color="#ffb47a"/><stop offset="1" stop-color="#ff4f1a"/></radialGradient>
    <radialGradient id="gB" cx="35%" cy="30%"><stop offset="0" stop-color="#a9b9ff"/><stop offset="1" stop-color="#4560f0"/></radialGradient></defs>`;
  const layers = { far: el("g", {}), lines: el("g", {}), dots: el("g", {}), nodes: el("g", {}) };
  const inner = el("g", { class: "pot-in" });
  potSvg.appendChild(layers.far); potSvg.appendChild(inner);
  [layers.lines, layers.dots, layers.nodes].forEach(g => inner.appendChild(g));
  const groups = { c: [], p: [] };
  function makeGroup(kind, i) {
    const isC = kind === "c", a = i * GA + (isC ? 0 : 1.1), r = isC ? 62 + (i % 4) * 9 : 100 + (i % 3) * 8;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, n = isC ? 10 : 5, parts = [];
    const ln = el("line", { x1: 0, y1: 0, x2: x.toFixed(1), y2: y.toFixed(1), class: "ln" + (isC ? "" : " b") }); layers.lines.appendChild(ln); parts.push(ln);
    for (let j = 0; j < n; j++) {
      const aa = a + (j - (n - 1) / 2) * (isC ? .075 : .1) + (rnd(i * 31 + j + (isC ? 0 : 500)) - .5) * .05;
      const rr = (isC ? 132 : 148) + rnd(i * 17 + j * 7 + (isC ? 0 : 900)) * 46;
      const d = el("circle", { cx: (Math.cos(aa) * rr).toFixed(1), cy: (Math.sin(aa) * rr).toFixed(1), r: isC ? 2.6 : 2.4, class: (isC ? "ct" : "ctb") + " pop" });
      d.style.animationDelay = (j * 25) + "ms"; layers.dots.appendChild(d); parts.push(d);
    }
    const nd = el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: isC ? 7 : 6, class: (isC ? "cl" : "pr") + " pop" });
    layers.nodes.appendChild(nd); parts.push(nd);
    return parts;
  }
  function sync(kind, want) {
    const arr = groups[kind];
    while (arr.length < want) arr.push(makeGroup(kind, arr.length));
    while (arr.length > want) arr.pop().forEach(e => e.remove());
  }
  /* « Et s'ils recommandent aussi ? » : un 2e cercle, beaucoup plus large */
  function drawBoom(on) {
    layers.far.innerHTML = "";
    inner.classList.toggle("small", on); document.querySelector(".pot-mid").classList.toggle("small", on);
    if (!on) return;
    const m = Math.min(420, Number(potC.value) * 10 + Number(potP.value) * 5);
    for (let k = 0; k < m; k++) {
      const a = k * GA * 1.37, rr = 150 + rnd(k * 13 + 7) * 46;
      const d = el("circle", { cx: (Math.cos(a) * rr).toFixed(1), cy: (Math.sin(a) * rr).toFixed(1), r: 1.8, class: "ct2 pop" });
      d.style.animationDelay = Math.round(rnd(k) * 600) + "ms"; layers.far.appendChild(d);
    }
  }
  const mid = document.querySelector(".pot-mid"), tot = $("potTotal");
  function tween(to) {
    const from = shown, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 500), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); tot.textContent = v.toLocaleString("fr-FR"); if (k < 1) requestAnimationFrame(step); else shown = to; };
    requestAnimationFrame(step);
    mid.classList.remove("bump"); void mid.offsetWidth; mid.classList.add("bump");
  }
  function update() {
    const c = Number(potC.value), p = Number(potP.value), net = c * 10 + p * 5, total = boom ? net + net * 10 : net, nw = Math.round(total / 10);
    $("potCOut").textContent = c; $("potPOut").textContent = p;
    potC.style.setProperty("--p", ((c - 1) / 49 * 100) + "%"); potP.style.setProperty("--p", (p / 30 * 100) + "%");
    sync("c", c); sync("p", p); drawBoom(boom);
    $("potNet").textContent = total.toLocaleString("fr-FR");
    $("potNew").textContent = "+" + nw.toLocaleString("fr-FR");
    $("potCA").textContent = "≈ " + (nw * PANIER).toLocaleString("fr-FR") + " €";
    $("potNote").textContent = boom ? "Si chaque personne touchée en parle à 10 autres : le bouche-à-oreille fait boule de neige. Estimation indicative, panier de 35 €."
      : "Estimation indicative : 10 contacts par client, 5 par prospect, panier de 35 €.";
    tween(total);
  }
  potC.addEventListener("input", update); potP.addEventListener("input", update);
  $("potBoom").addEventListener("click", () => { boom = !boom; $("potBoom").textContent = boom ? "↩︎ Revenir à mon cercle proche" : "✨ Et s'ils recommandent aussi ?"; update(); });
  /* on lance l'animation quand la section apparaît */
  let started = false;
  const go = () => { if (!started) { started = true; update(); } };
  if ("IntersectionObserver" in window) new IntersectionObserver((en, o) => { if (en.some(x => x.isIntersecting)) { go(); o.disconnect(); } }, { threshold: .25 }).observe(potSvg);
  else go();
}
