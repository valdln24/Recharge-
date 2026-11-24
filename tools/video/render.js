// Rend pub01.html en images. Usage : node render.js <dossier> [t1,t2,...]   (sans liste : toutes les images à 30 i/s)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const out = process.argv[2], list = process.argv[3], DUR = 28.6, FPS = 30;
  fs.mkdirSync(out, { recursive: true });
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await p.goto("http://127.0.0.1:8833/pub01.html");
  await p.waitForFunction(() => window.__ready && document.fonts.check("800 20px Manrope"));
  const ts = list ? list.split(",").map(Number) : Array.from({ length: DUR * FPS }, (_, i) => i / FPS);
  for (let i = 0; i < ts.length; i++) {
    await p.evaluate(t => render(warp(t)), ts[i]);
    await p.screenshot({ path: path.join(out, (list ? "t" + ts[i].toFixed(2) : String(i).padStart(4, "0")) + ".png") });
  }
  await br.close();
})();
