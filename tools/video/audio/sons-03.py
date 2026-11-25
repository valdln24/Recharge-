# Pub 03 (liquid glass, 27 s) : musique électro minimale qui monte jusqu'au logo + bruitages calés sur pub03.html
# Usage : python3 sons-03.py sortie.wav
import numpy as np, sys, scipy.io.wavfile as w
from scipy.signal import butter, sosfilt
SR = 48000; DUR = 27.0; N = int(SR * DUR); rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)
lp = lambda v, c: sosfilt(butter(2, c, 'low', fs=SR, output='sos'), v)
hp = lambda v, c: sosfilt(butter(2, c, 'high', fs=SR, output='sos'), v)
bp = lambda v, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), v)
def add(v, t, g, pan=0.0):
    i = int(t * SR); n = min(len(v), N - i)
    if n <= 0: return
    L[i:i + n] += v[:n] * g * (1 - max(pan, 0)); R[i:i + n] += v[:n] * g * (1 + min(pan, 0))
def env(n, a, d):
    tt = np.arange(n) / SR; return np.minimum(tt / a, 1) * np.exp(-tt / d)
def tone(f, d, dec, a=.002):
    n = int(d * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * f * tt) * env(n, a, dec)

# --- musique : 120 bpm, la mineur / fa / do / sol
BPM = 120; B = 60 / BPM
CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
def pad(freqs, d):
    n = int(d * SR); tt = np.arange(n) / SR; v = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0.004):
            ph = 2 * np.pi * f * (1 + det) * tt; v += (2 * ((ph / (2 * np.pi)) % 1) - 1) * .25
    return v * np.minimum(tt / .4, 1) * np.minimum((d - tt) / .4, 1).clip(0, 1)
m = np.zeros(N)
bar = 4 * B
for bi in range(int(DUR / bar) + 1):
    t0 = bi * bar
    if t0 >= DUR: break
    v = pad(CH[bi % 4], bar + .3); i = int(t0 * SR); n = min(len(v), N - i); m[i:i + n] += v[:n]
# filtre qui s'ouvre jusqu'au logo (9 s), reste ouvert, se referme en fin
pads = np.zeros(N); seg = int(.05 * SR)
for s0 in range(0, N, seg):
    tc = s0 / SR
    cut = 350 + 2600 * min(tc / 9.0, 1) ** 2 if tc < 9.05 else (2200 if tc < 25.2 else 2200 - 1700 * min((tc - 25.2) / 1.8, 1))
    blk = m[max(0, s0 - 2000):s0 + seg]; f = lp(blk, cut)[-(min(seg, N - s0)):]; pads[s0:s0 + len(f)] = f
add(pads, 0, .10, -.15); add(pads, 0, .10, .15)
# kick (à partir de 5 s, demi-temps ; plein temps après le logo)
def kick():
    n = int(.35 * SR); tt = np.arange(n) / SR; f = 48 + 110 * np.exp(-tt / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .14)
def hat():
    n = int(.05 * SR); return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / (.012 * SR))
def bass(f, d):
    n = int(d * SR); tt = np.arange(n) / SR; v = np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt); return lp(v, 500) * env(n, .005, .18)
t = 0.0; k = 0
while t < DUR - .05:
    if 5.0 <= t < 9.0 and k % 2 == 0: add(kick(), t, .22)
    if 9.05 <= t < 25.0: add(kick(), t, .30)
    if 11.0 <= t < 25.0: add(hat(), t + B / 2, .05, .3)
    if 13.0 <= t < 25.0 and k % 2 == 1: add(hat(), t + B / 4, .025, -.3)
    if 9.05 <= t < 25.0:
        root = CH[int(t / bar) % 4][0] / 2; add(bass(root, B * .9), t + B / 2, .16)
    t += B; k += 1
# montée (bruit filtré) avant le logo
n = int(2.2 * SR); rise = bp(rng.standard_normal(n), 800, 6000) * np.linspace(0, 1, n) ** 2
add(rise, 9.05 - 2.2, .05, 0)

# --- bruitages
def whoosh(d=.45, lo=300, hi=2600):
    n = int(d * SR); v = rng.standard_normal(n); e = np.sin(np.linspace(0, np.pi, n)) ** 2.2
    # balayage : deux bandes enchaînées
    a = bp(v, lo, hi) * e; return a / (np.abs(a).max() + 1e-9)
def glass(f=2600):
    return (tone(f, 1.1, .32) + .5 * tone(f * 2.76, 1.1, .16) + .25 * tone(f * 5.4, 1.1, .07)) / 1.6
def impact():
    n = int(1.6 * SR); tt = np.arange(n) / SR; f = 38 + 60 * np.exp(-tt / .06)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .5)
    air = lp(rng.standard_normal(n), 900) * np.exp(-tt / .25) * .35
    return lp(body + air, 1800)
def chime():
    return (tone(1046.5, 1.8, .55) + .7 * tone(1568, 1.8, .45) + .45 * tone(2093, 1.8, .35)) / 2
def click():
    n = int(.03 * SR); return lp(rng.standard_normal(n) * np.exp(-np.arange(n) / (.004 * SR)), 4000)

for j in range(7): add(glass(2300 + 180 * (j % 4)), .08 + j * .09, .05, (-.4, .4)[j % 2])
add(whoosh(.7), 2.2, .16)                       # éparpillement
add(whoosh(.5, 200, 1500), 3.0, .07)
add(whoosh(.55, 250, 1800), 6.85, .10)          # retour des fiches
add(whoosh(.6, 400, 3000), 7.35, .15)           # aspiration
add(glass(1900), 7.6, .09)                      # carte unique
add(glass(2900), 8.45, .06)                     # logo
add(impact(), 9.05, .55)                        # reveal du logo
add(chime(), 9.55, .06)
add(whoosh(.5, 500, 4000), 10.78, .17)          # whip pan
add(whoosh(.8, 200, 1600), 11.0, .12)           # dézoom
add(glass(2500), 13.05, .07); add(glass(3100), 13.5, .05, .3)
add(whoosh(.4, 600, 4500), 14.9, .17)           # punch-in
add(glass(2700), 15.6, .06, -.3); add(glass(3300), 16.2, .06, .3)
for q in range(3): add(tone(880, .25, .08), 16.65 + q * .9, .03)   # pulsation du badge
add(whoosh(.5, 300, 2200), 16.95, .10)          # morphing vers la fiche
add(glass(2200), 17.1, .06)
add(whoosh(.45, 500, 4000), 18.78, .16)         # transition
add(chime(), 19.3, .15)                         # message WhatsApp prêt
add(glass(2800), 20.65, .05)
add(click(), 21.55, .25); add(tone(1760, .4, .1) + .5 * tone(2637, .4, .08), 21.8, .07)  # envoyé
add(whoosh(.45, 500, 4000), 22.78, .16)
for j in range(3): add(glass(2400 + 300 * j), 23.05 + j * .1, .055, (-.5, 0, .5)[j])
add(whoosh(.5, 300, 2400), 25.0, .12)           # cartes qui se rassemblent
add(impact(), 25.42, .28); add(chime(), 25.45, .09)
add(glass(3000), 25.9, .05)

mix = np.stack([L, R], 1)
fade = np.ones(N); fo = int(1.0 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5; fade[:int(.02 * SR)] = np.linspace(0, 1, int(.02 * SR))
mix *= fade[:, None]
mix /= np.abs(mix).max() / .89
w.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
print("ok", DUR)
