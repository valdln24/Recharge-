# Voix (Claire) resserrée sur 25 s + musique de la vidéo 02 + bruitages calés sur pub02b.html
import numpy as np, subprocess, sys, scipy.io.wavfile as w
from scipy.signal import butter, sosfilt
S = sys.argv[1]; SR = 44100; DUR = 25.0; N = int(SR * DUR)
# 1. voix : mêmes coupes que la v1, placées plus serrées
segs = [(0, 2.6, .5), (2.7, 7.55, 3.6), (7.6, 12.85, 8.7), (12.9, 17.1, 14.2), (17.15, 19.97, 19.6)]
f = "".join(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={b-a-.04:.3f}:d=0.04,adelay={int(d*1000)}|{int(d*1000)}[s{i}];" for i, (a, b, d) in enumerate(segs))
f += "".join(f"[s{i}]" for i in range(5)) + f"amix=inputs=5:normalize=0,apad,atrim=0:{DUR}[vo]"
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", "audio/voix-claire-02.mp3", "-filter_complex", f, "-map", "[vo]", "-ar", "44100", "-ac", "2", f"{S}/vo_02b.wav"], check=True)
# 2. musique : les 25 premières secondes, fondu de sortie
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", f"{S}/audio/music_02.wav", "-af", f"atrim=0:{DUR},afade=t=out:st={DUR-2.2}:d=2.2", "-ar", "44100", "-ac", "2", f"{S}/mus_02b.wav"], check=True)
# 3. bruitages
rng = np.random.default_rng(5); x = np.zeros(N)
lp = lambda v, c: sosfilt(butter(2, c, 'low', fs=SR, output='sos'), v)
bp = lambda v, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), v)
def add(v, t, g):
    i = int(t * SR); n = min(len(v), N - i); x[i:i + n] += v[:n] * g
def tone(fr, d, dec):
    tt = np.arange(int(d * SR)) / SR; return np.sin(2 * np.pi * fr * tt) * np.exp(-tt / dec) * np.minimum(tt / .003, 1)
def whoosh(d=.45):
    n = int(d * SR); v = rng.standard_normal(n); e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return bp(v, 300, 1800) * e
def click():
    n = int(.03 * SR); v = rng.standard_normal(n) * np.exp(-np.arange(n) / (.004 * SR)); return lp(v, 4000)
def pop(fr): return tone(fr, .12, .035) + .4 * tone(fr * 2, .12, .02)
def chime(): return tone(880, 1.2, .35) + .6 * tone(1318.5, 1.2, .3) + .35 * tone(1760, 1.2, .25)
for a in (0, .15, .3): add(whoosh(.35), a, 0.083)
add(whoosh(.5), 2.6, 0.100); add(chime(), 3.5, .16)
add(whoosh(.5), 4.7, 0.093)
for k in range(4): add(pop(980 + 90 * k), 5.9 + .12 * k, .14)
add(whoosh(.4), 7.7, 0.073)
for k in range(5): add(click(), 8.2 + .11 * k + rng.uniform(-.01, .01), .3)
add(whoosh(.45), 9.85, 0.093)
for k in range(6): add(click(), 10.3 + .12 * k, .1)
add(pop(1250), 11.9, .14)
add(whoosh(.5), 14.2, 0.093)
for k, a in enumerate((15.45, 15.85, 16.25)): add(pop(1320 + 120 * k), a + .28, .16)
add(whoosh(.45), 17.5, 0.087); add(pop(900), 17.95, .15)
for k in range(2): add(tone(660, .25, .08), 18.1 + .6 * k, .06)
add(whoosh(.6), 19.3, 0.100); add(chime(), 20.0, .2)
w.write(f"{S}/sfx_02b2.wav", SR, np.stack([x, x], 1).astype(np.float32))
