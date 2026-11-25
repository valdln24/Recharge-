// Rend une pub. Usage : [PAGE=pub02.html DUR=32] node render.js <dossier> [t1,t2,...]   (sans liste : toutes les images à 30 i/s)
// Si <dossier> finit par .mp4 : les images partent directement dans ffmpeg, rien n'est écrit sur le disque.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const out = process.argv[2], list = process.argv[3], PAGE = process.env.PAGE || "pub01.html", DUR = +(process.env.DUR || 28.6), FPS = +(process.env.FPS || 30), W = +(process.env.W || 540), H = +(process.env.H || 960);
  const pipe = out.endsWith(".mp4") && !list;
  let ff = null;
  if (pipe) ff = require("child_process").spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-vf", `scale=${W*2}:${H*2}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", out], { stdio: ["pipe", "inherit", "inherit"] });
  else fs.mkdirSync(out, { recursive: true });
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await p.goto("http://127.0.0.1:8833/" + PAGE);
  await p.waitForFunction(() => window.__ready && document.fonts.check("800 20px Manrope"));
  const ts = list ? list.split(",").map(Number) : Array.from({ length: DUR * FPS }, (_, i) => i / FPS);
  for (let i = 0; i < ts.length; i++) {
    await p.evaluate(t => render(warp(t)), ts[i]);
    if (pipe) { const b = await p.screenshot(); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once("drain", r)); }
    else await p.screenshot({ path: path.join(out, (list ? "t" + ts[i].toFixed(2) : String(i).padStart(4, "0")) + ".png") });
  }
  await br.close();
  if (pipe) { ff.stdin.end(); await new Promise(r => ff.on("close", r)); }
})();
