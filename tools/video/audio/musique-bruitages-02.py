import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR=44100; DUR=32.0; N=int(SR*DUR)
WARP=[[0,0],[.5,1.08],[1.35,1.92],[2.4,2.98],[3.4,4.45],[5.25,6.3],[5.75,7.15],[7.58,8.75],[8.4,9.6],[9.3,10.9],[10.8,12.35],[12.25,13.8],[13.85,15.95],[15.3,17.3],[15.7,17.85],[16.0,18.3],[17.63,19.93],[18.4,21.6],[18.8,21.95],[20.3,23.6],[21.0,24.35],[22.0,25.4],[24.5,27.9]]
def F(T):  # temps d'origine -> temps final
    for (a,A),(b,B) in zip(WARP,WARP[1:]):
        if T<=B: return a+(b-a)*(T-A)/(B-A)
    return DUR
rng=np.random.default_rng(7)
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def bp(x,a,b): return sosfilt(butter(2,[a,b],'band',fs=SR,output='sos'),x)
def env(n,att,dec):
    t=np.arange(n)/SR; return np.minimum(t/max(att,1e-4),1)*np.exp(-t/dec)
def clamp01(x): return max(0,min(1,x))
def tone(f,d,att=.003,dec=.15,harm=((1,1),)):
    n=int(SR*d); t=np.arange(n)/SR
    return sum(a*np.sin(2*np.pi*f*h*t) for h,a in harm)*env(n,att,dec)
sfx=np.zeros(N); mus=np.zeros(N)
def add(buf,x,at,g=1.):
    i=int(at*SR); j=min(N,i+len(x));
    if i<N: buf[i:j]+=g*x[:j-i]
# --- bruitages
def notif(): return tone(1318.5,.35,dec=.09,harm=((1,1),(2,.25)))+np.pad(tone(1760,.3,dec=.12,harm=((1,1),(2,.2))),(int(.07*SR),0))[:int(.35*SR)]
def click(): n=int(.06*SR); return lp(rng.standard_normal(n),3500)*env(n,.001,.012)+.6*tone(180,.06,dec=.02)
def whoosh(d=.45):
    n=int(d*SR); x=rng.standard_normal(n); t=np.linspace(0,1,n)
    out=np.zeros(n)
    for k in range(0,n,512):
        f=300+3500*np.sin(np.pi*t[k])**2; s=x[k:k+512]; out[k:k+512]=s
    return bp(out,400,4000)*np.sin(np.pi*t)**2
def impact():
    n=int(.9*SR); t=np.arange(n)/SR; f=90*np.exp(-t*6)+42
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.28)+.3*lp(rng.standard_normal(n),900)*np.exp(-t/.05)
def tick(): return tone(2400,.03,att=.0005,dec=.006)+.4*tone(1200,.03,att=.0005,dec=.008)
def pencil(d=.5):
    n=int(d*SR); t=np.linspace(0,1,n); x=bp(rng.standard_normal(n),2500,7000)
    return x*(.5+.5*np.sin(2*np.pi*14*t*d))**2*np.sin(np.pi*t)**.5
def chime(f,d=1.6): return tone(f,d,att=.004,dec=.5,harm=((1,1),(2,.35),(3,.12),(4.2,.05)))

# ---- vidéo 02 : bruitages (temps final)
for v in [.1,.45,1.1]: add(sfx,notif(),v,.22)
for v in [.8,1.35]: add(sfx,click(),v,.3)
add(sfx,whoosh(.7),1.75,.25); add(sfx,impact(),2.65,.45)
add(sfx,chime(523.25,2.2)+.5*chime(784,2.2),4.05,.12)
add(sfx,whoosh(.6)[::-1],4.9,.22)
for v in [7.3,9.4,14.3,16.1,23.4]: add(sfx,tone(1567.98,.25,dec=.05,harm=((1,1),(2,.3))),v,.10); add(sfx,tick(),v,.12)
for v in [8.4,12.0,15.3]: add(sfx,whoosh(.5),v,.10)
add(sfx,click(),12.95,.4)
add(sfx,whoosh(.45),13.15,.2); add(sfx,whoosh(.45)[::-1],17.9,.15)
for n in range(6): add(sfx,tick(),19.2+n*.22,.2)
r=bp(rng.standard_normal(int(1.0*SR)),600,3000)*np.linspace(0,1,int(1.0*SR))**2; add(sfx,r,20.9,.10)
add(sfx,impact(),21.95,.22); add(sfx,lp(notif(),2500),22.1,.18)
for v in [24.0,24.5]: add(sfx,tone(880,.3,dec=.08),v,.08)
add(sfx,whoosh(.5),25.4,.2); add(sfx,whoosh(.6)[::-1],26.3,.2)
add(sfx,chime(523.25,3)+.6*chime(784,3)+.4*chime(1046.5,3),28.35,.2)
add(sfx,chime(1568,1.2),28.0,.05)
# ---- musique : pulsation électronique douce, montée progressive, accord chaud au logo
t=np.arange(N)/SR; bpm=112; beat=60/bpm
for b in np.arange(2.7,26.4,beat):
    g=.32+.18*clamp01((b-6)/14)
    add(mus,tone(55,.5,att=.002,dec=.12),b,g)
    if b>6: add(mus,hp(rng.standard_normal(int(.04*SR)),7000)*env(int(.04*SR),.001,.008),b+beat/2,.09)
    if b>12: add(mus,tone(220*(1.5 if int(b/beat)%4==3 else 1),.22,dec=.07),b+beat*.75,.05)
def pad(freqs,a,b,g):
    n=int((b-a)*SR); tt=np.arange(n)/SR; x=sum(np.sin(2*np.pi*f*tt+np.sin(2*np.pi*.3*tt)*.5)+.3*np.sin(2*np.pi*f*2.003*tt) for f in freqs)
    e=np.minimum(tt/.8,1)*np.minimum((b-a-tt)/1.2,1); add(mus,lp(x,1800)*e,a,g)
pad([110,138.6,164.8],0,6,.04)
pad([130.8,164.8,196,246.9],6,13,.05)
pad([116.5,146.8,174.6,220],13,20,.05)
pad([130.8,164.8,196,246.9],20,26.6,.055)
pad([65.4,130.8,164.8,196,246.9,329.6],26.8,32,.06)
# mix
def norm(x,peak): return x/np.max(np.abs(x))*peak
for name,buf,pk in [('sfx_02',sfx,.7),('music_02',mus,.6)]:
    wavfile.write(f'{name}.wav',SR,(norm(buf,pk)*32767).astype(np.int16))
print('ok')
