# Film Recharge (60 s) : musique originale + bruitages ElevenLabs (film/sfx), calés sur film-recharge.html
# Usage : python3 audio/film-sons.py sortie.wav   (lancer depuis tools/video)
import numpy as np, subprocess, sys, scipy.io.wavfile as w
from scipy.signal import butter, sosfilt
SR = 48000; DUR = 60.0; N = int(SR * DUR); rng = np.random.default_rng(7)
mus = np.zeros((N, 2)); fx = np.zeros((N, 2))
lp = lambda v, c: sosfilt(butter(2, c, 'low', fs=SR, output='sos'), v)
hp = lambda v, c: sosfilt(butter(2, c, 'high', fs=SR, output='sos'), v)
bp = lambda v, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), v)
def put(buf, v, t, g, pan=0.0):
    i = int(t * SR); n = min(len(v), N - i)
    if n <= 0 or i < 0: return
    if v.ndim == 1: v = np.stack([v, v], 1)
    buf[i:i + n, 0] += v[:n, 0] * g * (1 - max(pan, 0)); buf[i:i + n, 1] += v[:n, 1] * g * (1 + min(pan, 0))
def env(n, a, d): tt = np.arange(n) / SR; return np.minimum(tt / a, 1) * np.exp(-tt / d)
def load(f):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64); return a / (np.abs(a).max() + 1e-9)
X = {k: load(f"film/sfx/{k}.mp3") for k in ["drone", "riser", "hit", "pop", "tap", "typing", "swoosh", "liquid", "stamp", "sparkle", "boom", "zap"]}

# ---------- musique ----------
B = 0.5   # 120 bpm, temps fort calé sur 15,0 s
def saw(f, d, det=(-.005, .005)):
    n = int(d * SR); tt = np.arange(n) / SR; v = np.zeros(n)
    for dd in det: v += 2 * ((f * (1 + dd) * tt) % 1) - 1
    return v / len(det)
def pad(freqs, d, cut):
    n = int(d * SR); tt = np.arange(n) / SR; v = sum(saw(f, d) for f in freqs) / len(freqs)
    return lp(v, cut) * np.minimum(tt / .5, 1) * np.clip((d - tt) / .6, 0, 1)
# acte 1 : nappe grave (la) + souffle
n1 = int(15.2 * SR); tt = np.arange(n1) / SR
sub = (np.sin(2 * np.pi * 55 * tt) * .6 + np.sin(2 * np.pi * 82.4 * tt) * .25) * np.minimum(tt / 2, 1) * (1 - np.clip((tt - 14.8) / .4, 0, 1))
put(mus, sub, 0, .35)
put(mus, pad([110, 164.8, 220], 15.2, 700), 0, .22)
air = bp(rng.standard_normal(n1), 300, 2500) * (.5 + .5 * np.sin(2 * np.pi * .25 * tt)) ** 2 * np.minimum(tt / 3, 1) * (1 - np.clip((tt - 14.6) / .6, 0, 1))
put(mus, air, 0, .05)
# acte 2 : groove propre et chaleureux (fa maj7, la m7, ré m7, sol)
CH = [[174.6, 220, 261.6, 329.6], [220, 261.6, 329.6, 392], [146.8, 174.6, 220, 261.6], [196, 246.9, 293.7, 349.2]]
def kick():
    n = int(.35 * SR); t2 = np.arange(n) / SR; f = 50 + 100 * np.exp(-t2 / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t2 / .15)
def hat(): n = int(.05 * SR); return hp(rng.standard_normal(n), 7500) * np.exp(-np.arange(n) / (.012 * SR))
def clap(): n = int(.18 * SR); return bp(rng.standard_normal(n), 900, 4000) * np.exp(-np.arange(n) / (.035 * SR))
def pluck(f): n = int(.4 * SR); t2 = np.arange(n) / SR; return (np.sin(2 * np.pi * f * t2) + .3 * np.sin(4 * np.pi * f * t2)) * np.exp(-t2 / .12)
def bass(f, d): n = int(d * SR); t2 = np.arange(n) / SR; return lp(np.sin(2 * np.pi * f * t2) + .25 * saw(f, d), 400) * env(n, .006, .25)
bar = 4 * B
t0 = 15.0
while t0 < 56.0:
    c = CH[int((t0 - 15) / bar) % 4]; d = min(bar, 55.6 - t0)
    if d <= 0: break
    cut = 1400 if t0 < 50 else 1400 + (t0 - 50) * 500
    put(mus, pad(c, d + .4, cut), t0, .16, -.1); put(mus, pad([x * 2 for x in c[1:3]], d + .4, cut), t0, .05, .2)
    for q in range(8):
        tq = t0 + q * B / 2
        if tq >= 55.6: break
        coach = 30.0 <= tq < 31.5               # respiration à l'arrivée de l'ordinateur
        if q % 2 == 0 and not coach: put(mus, kick(), tq, .42)
        if q % 2 == 1: put(mus, hat(), tq, .06, .3)
        if q in (2, 6) and tq > 19 and not coach: put(mus, clap(), tq, .07, -.1)
        if q % 2 == 0: put(mus, bass(c[0] / 2, B * .9), tq, .2)
        if tq > 17: put(mus, pluck(c[q % 4] * 2), tq + B / 4, .045, (-.4, .4)[q % 2])
    t0 += bar
# acte 3 : montée vers le logo, un temps de silence, puis l'impact
n3 = int(1.2 * SR); put(mus, bp(rng.standard_normal(n3), 1500, 8000) * np.linspace(0, 1, n3) ** 2, 54.4, .04)
tail = pad([87.3, 130.8, 174.6, 220, 261.6], 4.0, 900); put(mus, tail, 56.0, .3)
n4 = int(4 * SR); t4 = np.arange(n4) / SR; put(mus, np.sin(2 * np.pi * 43.65 * t4) * np.exp(-t4 / 1.6), 56.0, .4)
put(mus, pad([110, 164.8, 220], 3.0, 600), 57.0, .12)

# ---------- bruitages ----------
put(fx, X["drone"], 0.0, .3); put(fx, X["drone"][::-1] * np.linspace(0, 1, len(X["drone"]))[:, None] ** .5, 5.8, .2)
for tc in [2.5, 3.35, 4.2, 5.0, 5.9, 6.95, 8.0]: put(fx, X["hit"], tc, .55)
put(fx, X["liquid"], 3.4, .35); put(fx, X["zap"], 4.25, .4); put(fx, X["riser"], 5.0, .25)
put(fx, X["pop"], 7.7, .5); [put(fx, X["pop"], 7.75 + j * .05, .18, (-.5, .5)[j % 2]) for j in range(4)]
put(fx, X["swoosh"], 8.0, .3); put(fx, X["swoosh"], 9.85, .3); put(fx, X["hit"], 9.85, .3)
for j in range(6): put(fx, X["pop"], 11.25 + j * .09, .22, (-.4, .4)[j % 2])
put(fx, X["riser"], 12.0, .35); put(fx, X["liquid"], 13.0, .2)
put(fx, X["hit"], 15.0, .6); put(fx, X["sparkle"], 15.05, .35)
for j in range(5): put(fx, X["pop"], 15.95 + j * .07, .25, (j - 2) * .2)
put(fx, X["tap"], 17.35, .55); put(fx, X["liquid"], 17.4, .3)
put(fx, X["swoosh"], 19.25, .35); [put(fx, X["pop"], 19.3 + j * .08, .2, (j - 2) * .2) for j in range(5)]
for j in range(5): put(fx, X["tap"], 20.95 + j * .1, .22, (j - 2) * .15)
put(fx, X["swoosh"], 24.1, .4); put(fx, X["hit"], 24.2, .3)
put(fx, X["swoosh"], 25.0, .35); put(fx, X["liquid"], 25.9, .25); put(fx, X["tap"], 27.0, .55); put(fx, X["pop"], 27.15, .35)
put(fx, X["sparkle"], 28.45, .3); put(fx, X["swoosh"], 28.95, .45)
put(fx, X["hit"], 30.1, .45); put(fx, X["swoosh"], 30.85, .3); put(fx, X["sparkle"], 31.8, .25)
put(fx, X["typing"][:int(.8 * SR)], 33.5, .4); put(fx, X["tap"], 34.4, .5); put(fx, X["liquid"], 34.45, .45); put(fx, X["hit"], 34.45, .25)
put(fx, X["sparkle"], 35.1, .18)
put(fx, X["swoosh"], 38.0, .35); put(fx, X["pop"], 38.6, .35); [put(fx, X["pop"], 39.2 + j * .1, .25, (j - 1) * .3) for j in range(3)]
put(fx, X["tap"], 40.55, .5); put(fx, X["sparkle"], 40.65, .35)
for j in range(4): put(fx, X["pop"], 42.1 + j * .12, .2, (j - 1.5) * .25)
put(fx, X["swoosh"], 42.4, .25); put(fx, X["pop"], 43.5, .3); put(fx, X["sparkle"], 43.75, .2)
for j in range(6): put(fx, X["stamp"], 43.42 + j * .3, .45, .3)
put(fx, X["swoosh"], 46.1, .35); [put(fx, X["pop"], 46.2 + j * .1, .2, (j - 1.5) * .25) for j in range(4)]
put(fx, X["liquid"], 47.4, .3); put(fx, X["swoosh"], 48.2, .3); put(fx, X["liquid"], 48.75, .4)
for j in range(4): put(fx, X["pop"], 49.15 + j * .1, .25)
put(fx, X["swoosh"], 50.0, .35); [put(fx, X["pop"], 50.4 + j * .08, .13, ((j % 3) - 1) * .4) for j in range(8)]
for j in range(14): put(fx, X["tap"], 51.0 + j * .13, .07 + j * .006)
put(fx, X["liquid"], 54.5, .45); put(fx, X["sparkle"], 55.0, .3); put(fx, X["pop"], 55.6, .35)
put(fx, X["boom"], 56.0, .9); put(fx, X["hit"], 56.0, .5); put(fx, X["pop"], 57.0, .3); put(fx, X["sparkle"], 57.75, .2)

# ---------- mix ----------
sil = np.ones(N); a, b = int(55.6 * SR), int(56.0 * SR); sil[a:b] = np.linspace(1, 0, b - a) ** 3   # un temps de silence avant le logo
mix = mus * sil[:, None] * .9 + fx * .8
fade = np.ones(N); fo = int(1.6 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.4; fade[:int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR))
mix *= fade[:, None]; mix /= np.abs(mix).max() / .8
w.write(sys.argv[1], SR, (mix * 32767).astype(np.int16)); print("ok")
