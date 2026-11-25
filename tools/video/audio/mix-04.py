# Pub 04 : voix devant (musique et bruitages nettement plus bas), bruitages recalés sur pub04.html. Usage : python3 audio/mix-04.py musique.wav sortie.wav
# (base) Pub 03b : son plus bas, voix traitée (filtre + légère pièce), musique très en retrait.
# Pub 03 : musique (sons-03.py, MUSIQUE_SEULE=1) + voix de Claire + bruitages ElevenLabs, calés sur pub03.html
# Usage : python3 mix-03.py musique.wav sortie.wav
import numpy as np, subprocess, sys, scipy.io.wavfile as w
SR = 48000; DUR = 27.0; N = int(SR * DUR); D = "audio/v03/"
def load(f, af=None):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f] + (["-af", af] if af else []) + [ "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
sr, mus = w.read(sys.argv[1]); mus = mus.astype(np.float64) / 32767
out = np.zeros((N, 2)); vo = np.zeros((N, 2))
def put(buf, v, t, g, pan=0.0):
    i = int(t * SR); n = min(len(v), N - i)
    if n > 0: buf[i:i + n, 0] += v[:n, 0] * g * (1 - max(pan, 0)); buf[i:i + n, 1] += v[:n, 1] * g * (1 + min(pan, 0))
# voix
for k, line in enumerate(open("audio/texte-voix-03.txt", encoding="utf-8").read().strip().splitlines(), 1):
    put(vo, load(f"{D}voix-{k}.mp3", "highpass=f=90,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,equalizer=f=3500:t=q:w=1:g=2,aecho=0.85:0.6:35|55:0.10|0.06"), float(line.split("|")[0]), 1.0)
# bruitages
S = {n: load(f"{D}{n}.mp3") for n in ("whoosh", "verre", "impact", "chime", "clic")}
for n in S: S[n] /= np.abs(S[n]).max() + 1e-9
for n in S: S[n] *= .55
for j in range(7): put(out, S["verre"], .08 + j * .09, .08, (-.4, .4)[j % 2])
for t, g in [(2.2, .30), (6.85, .18), (7.35, .26), (10.7, .28), (11.0, .22), (12.9, .14), (14.0, .14), (14.95, .30), (17.6, .14), (22.9, .28), (25.05, .22)]: put(out, S["whoosh"], t, g)
for t, g, pan in [(7.55, .12, 0), (8.05, .10, 0), (11.9, .09, -.4), (12.15, .09, .4), (16.9, .10, 0), (21.3, .12, 0), (23.55, .09, -.4), (23.8, .09, .4), (25.3, .10, 0)]: put(out, S["verre"], t, g, pan)
put(out, S["impact"], 9.0, .3); put(out, S["impact"], 26.12, .16)
put(out, S["chime"], 19.25, .30); put(out, S["clic"], 20.88, .45)
# musique baissée sous la voix
lvl = np.abs(vo).max(1); win = int(.25 * SR)
envv = np.convolve(lvl > .02, np.ones(win) / win, "same"); duck = 1 - .75 * np.clip(envv * 1.5, 0, 1)
mix = mus[:N] * duck[:, None] * 0.08 + out * .6 + vo * 1.0
mix /= np.abs(mix).max() / .7
w.write(sys.argv[2], SR, (mix * 32767).astype(np.int16)); print("ok")
