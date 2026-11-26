# Film Recharge façon Glean : musique ElevenLabs + bruitages ElevenLabs (film/sfx2), calés sur glean/film.html
# Usage : python3 audio/film-glean-sons.py sortie.wav   (depuis tools/video)
import numpy as np, subprocess, sys, scipy.io.wavfile as w
SR = 48000; N = 60 * SR
def load(f):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
X = {k: load(f"film/sfx2/{k}.mp3") for k in ["whoosh", "whoosh2", "tap", "glass", "hit", "type", "chime", "riser", "pop", "send"]}
for k in X: X[k] /= np.abs(X[k]).max() + 1e-9
mus = np.zeros((N, 2)); m = load("film/sfx2/music.mp3")[:N]; mus[:len(m)] = m
fx = np.zeros((N, 2))
def put(name, t, g, pan=0.0):
    v = X[name]; i = int(t * SR); n = min(len(v), N - i)
    fx[i:i + n, 0] += v[:n, 0] * g * (1 - max(pan, 0)); fx[i:i + n, 1] += v[:n, 1] * g * (1 + min(pan, 0))
# 1 · formes en verre
for j, tc in enumerate([.1, .22, .36, .5, .64, .78]): put("glass", tc, .18, (j % 2 - .5) * .8)
put("riser", 1.05, .35); put("whoosh", 2.55, .55)
# 2 · logo
put("hit", 3.05, .5); put("glass", 3.55, .35)
put("whoosh2", 4.15, .4)
# 3 · Voici Recharge
put("whoosh", 5.2, .4); [put("pop", 6.1 + j * .12, .18, (j - 2) * .25) for j in range(5)]
put("whoosh", 7.7, .45)
# 4 · coach : « Qu'est-ce que je peux faire aujourd'hui ? » → plan chaud / tiède / froid
put("whoosh2", 8.84, .45); put("glass", 9.1, .3)
put("tap", 9.72, .5); put("type", 9.8, .45); put("type", 10.3, .3)
put("tap", 11.07, .55); put("send", 11.1, .5); put("whoosh", 11.25, .3); put("chime", 11.65, .4)
for j in range(3): put("pop", 11.75 + j * .22, .3, (j - 1) * .5)
for i in range(3):
    for j in range(2): put("tap", 13.2 + i * .9 + j * .35, .3, (i - 1) * .5)
put("glass", 15.3, .25)
# 6 · coach : « Elle trouve ça un peu cher… » (version courte)
put("whoosh2", 16.34, .45); put("glass", 16.6, .3)
put("tap", 17.31, .45); put("type", 17.45, .4)
put("tap", 18.72, .55); put("send", 18.75, .5); put("chime", 19.15, .4)
# 6bis · opportunités autour de vous
put("whoosh2", 20.24, .45)
for j in range(4): put("pop", 20.7 + j * .2, .28, ((j % 2) - .5) * .8)
put("glass", 21.75, .35); put("pop", 22.0, .3)
# 7-8 · dégradé + parcours
put("whoosh2", 22.84, .5); put("hit", 23.0, .25)
put("whoosh2", 24.44, .45); put("pop", 24.65, .3); put("pop", 24.9, .3)
for j in range(3): put("whoosh2", 26.6 + .7 * (j + 1) - .1, .25, (j - 1) * .3); put("pop", 26.6 + .7 * (j + 1), .25)
# 9 · appli
put("whoosh2", 29.84, .45); put("whoosh2", 30.9, .3)
put("tap", 32.45, .6); put("send", 32.5, .55); put("chime", 32.6, .45)
put("whoosh2", 33.6, .3)
# 10 · suivi
put("whoosh2", 34.84, .45); put("pop", 35.3, .3); put("tap", 36.1, .45); put("chime", 36.15, .25); put("pop", 36.4, .3)
[put("pop", 35.6 + j * .3, .2, (j - 1) * .5) for j in range(3)]
# 11 · fidélité
put("whoosh2", 38.84, .5); put("glass", 39.35, .35)
for j in range(8): put("tap", 40.0 + j * .16, .28 + j * .02, (j - 4) * .1)
put("chime", 41.3, .3)
# 12 · bascule
put("whoosh2", 42.34, .45); put("glass", 42.8, .3); put("whoosh", 43.3, .4); put("glass", 44.2, .3)
# 13 · prospection
put("whoosh2", 45.34, .45); [put("pop", 45.8 + j * .18, .25, (j - 2) * .2) for j in range(5)]; put("pop", 47.2, .3)
# 14 · résultats
put("whoosh2", 48.84, .45); put("riser", 49.3, .3); put("chime", 51.2, .4)
# 15 · mur + promesse
put("whoosh", 52.25, .5); put("hit", 52.5, .25); put("glass", 53.0, .3); put("glass", 53.75, .35)
# 16 · logo final
put("riser", 54.0, .4); put("hit", 56.0, .85); put("glass", 56.25, .4)
put("whoosh2", 56.75, .4)
for j in range(6): put("tap", 57.25 + j * .3, .45 + j * .04, ((j % 2) - .5) * .4); put("whoosh2", 57.2 + j * .3, .12)
put("hit", 58.75, .35); put("chime", 58.8, .45); put("glass", 59.05, .3)
# mix : musique en retrait sous les bruitages, petit creux avant le logo
g = np.ones(N); a, b = int(55.55 * SR), int(56.0 * SR); g[a:b] = np.linspace(1, .25, b - a); c = int(56.0 * SR); g[c:] = .55
mix = mus * g[:, None] * .55 + fx * .7
fo = int(1.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.3
w.write(sys.argv[1], SR, (mix / np.abs(mix).max() * .9 * 32767).astype(np.int16)); print("ok")
