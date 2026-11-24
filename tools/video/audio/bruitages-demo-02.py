import numpy as np, scipy.io.wavfile as w
sr, x = w.read("audio/sfx_02.wav"); x = x.astype(np.float32) / (32768 if x.dtype == np.int16 else 1)
if x.ndim == 1: x = np.stack([x, x], 1)
rng = np.random.default_rng(2)
def put(t, s, g):
    i = int(t * sr); n = min(len(s), len(x) - i); x[i:i + n] += (s[:n] * g)[:, None]
def click():
    n = int(.03 * sr); e = np.exp(-np.arange(n) / (.004 * sr)); v = rng.standard_normal(n) * e
    return np.convolve(v, np.ones(6) / 6, "same")
def tick(f):
    n = int(.12 * sr); tt = np.arange(n) / sr; return np.sin(2 * np.pi * f * tt) * np.exp(-tt / .03)
for k in range(5): put(11.95 + .1 * k + rng.uniform(-.01, .01), click(), .22)
for k in range(5): put(18.3 + .05 * k, click(), .12)
for k, a in enumerate([20.95, 21.45, 21.95]): put(a + .32, tick(1320 + 120 * k), .18)
w.write("audio/sfx_02b.wav", sr, np.clip(x, -1, 1).astype(np.float32))
