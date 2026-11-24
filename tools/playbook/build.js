// Génère le PDF du Playbook à partir de playbook.html (police et logo repris du site).
// Usage : node tools/playbook/build.js   →   public/playbook/le-playbook-de-la-vente-directe.pdf
// Nécessite Playwright (Chromium). Le PDF est servi par le serveur uniquement avec un lien de téléchargement personnel.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const root = path.join(__dirname, "..", "..");
const css = fs.readFileSync(path.join(root, "public/assets/site.css"), "utf8");
const font = (css.match(/@font-face\{[^}]*\}/) || [""])[0];
const home = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
let logo = (home.match(/<svg class="logo-svg"[\s\S]*?<\/svg>/) || [""])[0]
  .replace(/ style="[^"]*"/, "").replace(/id="([^"]+)"/g, 'id="pb-$1"').replace(/url\(#([^)]+)\)/g, "url(#pb-$1)");
const html = fs.readFileSync(path.join(__dirname, "playbook.html"), "utf8").replace("{{FONT}}", font).replace(/\{\{LOGO\}\}/g, logo);
(async () => {
  const out = path.join(root, "public/playbook/le-playbook-de-la-vente-directe.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const br = await chromium.launch(), page = await br.newPage();
  await page.setContent(html, { waitUntil: "load" });
  // la police du site doit être chargée avant l'impression (sinon Chromium prend une police de secours)
  const ok = await page.evaluate(async () => { for (const w of [400, 600, 700, 800]) await document.fonts.load(`${w} 12px Manrope`); await document.fonts.ready; return document.fonts.check("800 12px Manrope"); });
  if (!ok) throw new Error("La police Manrope n'a pas pu être chargée.");
  // contrôle : aucun contenu ne doit déborder de sa page
  const over = await page.evaluate(() => [...document.querySelectorAll(".page")].map((p, i) => [i + 1, p.scrollHeight - p.clientHeight]).filter(x => x[1] > 1));
  if (over.length) console.warn("Contenu qui déborde (page, px) :", JSON.stringify(over));
  await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
  await br.close();
  console.log("PDF :", path.relative(root, out), Math.round(fs.statSync(out).size / 1024) + " Ko");
})();
