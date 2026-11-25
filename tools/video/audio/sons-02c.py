# Vidéo 02 (v4, fond blanc) : voix de Claire à 0,4 s + musique de la vidéo 02 + bruitages doux calés sur pub02c.html
import numpy as np, subprocess, sys, scipy.io.wavfile as w
from scipy.signal import butter, sosfilt
S = sys.argv[1]; SR = 44100; DUR = 24.0; N = int(SR * DUR)
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
for a in (.3, 3.05, 7.75, 11.9, 13.1, 15.15): add(air(), a, .05)
for k in range(3): add(pop(900 + 80 * k), .62 + .12 * k, .1)
add(pop(1200), 2.4, .1)
for k in range(9): add(tick(), 5.82 + .125 * k, .12)
add(pop(760), 7.1, .14)
for k in range(5): add(pop(1500 + 60 * k), 8.08 + .06 * k, .05)
for k, a in enumerate((10.0, 10.35, 10.7)): add(pop(1100 + 140 * k), a, .13)
add(pop(900), 11.95, .08)
for k in range(8): add(tick(), 13.42 + .13 * k, .1)
add(pop(800), 14.6, .1)
for j in (16.5, 17.2, 17.9): add(ding(), j, .07); add(pop(1300), j + .35, .07)
add(air(.6), 19.05, .06); add(chime(), 19.2, .16)
w.write(f"{S}/sfx_02c.wav", SR, np.stack([x, x], 1).astype(np.float32))
