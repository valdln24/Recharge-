# Vidéo 02 (v4, fond blanc) : voix de Claire à 0,4 s + musique de la vidéo 02 + bruitages doux calés sur pub02c.html
import numpy as np, subprocess, sys, scipy.io.wavfile as w
from scipy.signal import butter, sosfilt
S = sys.argv[1]; SR = 44100; DUR = 28.0; N = int(SR * DUR)
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", "audio/voix-claire-02c.mp3", "-af", f"adelay=400|400,apad,atrim=0:{DUR}", "-ar", "44100", "-ac", "2", f"{S}/vo_02c.wav"], check=True)
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", f"{S}/audio/music_02.wav", "-af", f"atrim=0:{DUR},afade=t=in:d=0.4,afade=t=out:st={DUR-2.5}:d=2.5", "-ar", "44100", "-ac", "2", f"{S}/mus_02c.wav"], check=True)
rng = np.random.default_rng(7); x = np.zeros(N)
lp = lambda v, c: sosfilt(butter(2, c, 'low', fs=SR, output='sos'), v)
bp = lambda v, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), v)
def add(v, t, g):
    i = int(t * SR); n = min(len(v), N - i); x[i:i + n] += v[:n] * g
def tone(fr, d, dec):
    tt = np.arange(int(d * SR)) / SR; return np.sin(2 * np.pi * fr * tt) * np.exp(-tt / dec) * np.minimum(tt / .003, 1)
def air(d=.4):
    n = int(d * SR); v = rng.standard_normal(n); e = np.sin(np.linspace(0, np.pi, n)) ** 2; return bp(v, 400, 1400) * e
def tick():
    n = int(.02 * SR); v = rng.standard_normal(n) * np.exp(-np.arange(n) / (.003 * SR)); return lp(v, 3500)
def pop(fr): return tone(fr, .12, .03) + .35 * tone(fr * 2, .12, .018)
def chime(): return tone(880, 1.4, .4) + .55 * tone(1318.5, 1.4, .32) + .3 * tone(1760, 1.4, .25)
def ding(): return tone(1568, .5, .14) + .4 * tone(2093, .5, .1)
for a in (.25, 3.3, 5.85, 9.45, 13.95, 15.95, 17.2, 19.1): add(air(), a, .05)
for k in range(3): add(pop(1000 + 90 * k), 1.75 + .14 * k, .1)          # clientes importées
for k in range(3): add(pop(900 + 80 * k), 3.62 + .12 * k, .1)           # liste du jour
add(pop(1200), 5.4, .1)
for k in range(9): add(tick(), 7.67 + .125 * k, .12)                    # message qui s'écrit
add(pop(760), 8.95, .14)
for k in range(5): add(pop(1500 + 60 * k), 9.78 + .06 * k, .05)
for k, a in enumerate((11.7, 12.05, 12.4)): add(pop(1100 + 140 * k), a, .13)
for k in range(6): add(pop(1150 + 70 * k), 14.2 + .07 * k if k < 5 else 14.75, .08)   # tampons
add(ding(), 15.0, .07)
add(pop(900), 16.05, .08)
for k in range(8): add(tick(), 17.52 + .13 * k, .1)
add(pop(800), 18.7, .1)
for j in (20.45, 21.15, 21.85): add(ding(), j, .07); add(pop(1300), j + .35, .07)
add(air(.6), 23.05, .06); add(chime(), 23.2, .16)
w.write(f"{S}/sfx_02c.wav", SR, np.stack([x, x], 1).astype(np.float32))
