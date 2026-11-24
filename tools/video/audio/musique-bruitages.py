import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR=44100; DUR=28.6; N=int(SR*DUR)
WARP=[[0,0],[.5,1.08],[1.35,1.92],[2.4,2.98],[3.4,4.45],[5.25,6.3],[5.75,7.15],[7.58,8.75],[8.4,9.6],[9.3,10.9],[10.8,12.35],[12.25,13.8],[13.85,15.95],[14.95,17.3],[19.4,21.75],[19.8,22.3],[20.1,22.75],[21.73,24.38],[22.5,26.05],[22.9,26.4],[24.4,28.05],[25.1,28.8],[26.1,29.85],[28.6,32.35]]
def F(T):  # temps d'origine -> temps final
    T = T + 4.45 if T > 17.31 else T
    for (a,A),(b,B) in zip(WARP,WARP[1:]):
        if T<=B: return a+(b-a)*(T-A)/(B-A)
    return DUR
rng=np.random.default_rng(7)
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def bp(x,a,b): return sosfilt(butter(2,[a,b],'band',fs=SR,output='sos'),x)
def env(n,att,dec):
    t=np.arange(n)/SR; return np.minimum(t/max(att,1e-4),1)*np.exp(-t/dec)
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
P=[0,.15,.9,1.25,1.6,1.95,2.3,2.65,2.95,3.25,3.55]
for k,v in {'n1':.15,'n2':1.25,'n3':1.95,'n4':2.65,'n5':3.25}.items(): add(sfx,notif(),F(v),.28)
for v in [.9,1.6,2.3,2.95,3.55]: add(sfx,click(),F(v),.35)
for v in [1.08,1.92,2.98]: add(sfx,whoosh(.32),F(v)-.18,.22)
add(sfx,impact(),F(4.45),.55)
for v in [6.3,7.15,8.75]: add(sfx,click(),F(v),.22)
add(sfx,pencil(.45),F(8.9),.12)
add(sfx,whoosh(.6),F(10.2),.25)
# compteur J+0..40 : vite puis ralenti
ts=F(10.6)+np.cumsum(np.linspace(.03,.16,40)); 
for x in ts[ts<F(15.0)]: add(sfx,tick(),x,.18)
m=lp(notif(),700); add(sfx,m,F(14.6),.25)      # notification étouffée
add(sfx,impact(),F(17.32),.35)                   # bascule au noir
r=whoosh(1.0)[::-1]; add(sfx,r,F(18.3)-1.0,.2)  # montée vers le sable
for i,v in enumerate([18.9,19.4,19.9,20.4]): add(sfx,chime([659.3,784,880,1046.5][i],.9),F(v),.10)
add(sfx,chime(523.25,2.5)+.6*chime(784,2.5)+.4*chime(1046.5,2.5),F(21.9),.18)
add(sfx,chime(1568,1.2),F(24.35),.07)
I0=14.95
add(sfx,whoosh(.4),I0+0.05,.15)
add(sfx,lp(notif(),900),I0+1.15,.22)
add(sfx,whoosh(.32),I0+1.5-.18,.25); add(sfx,impact(),I0+1.5,.3)
add(sfx,click(),I0+2.55,.35); add(sfx,click(),I0+3.35,.35)
# --- musique : pulsation tendue (0 -> noir), puis accord chaud
t=np.arange(N)/SR; bpm=112; beat=60/bpm
tens_end=F(17.32); calm=F(18.1)
for b in np.arange(0,tens_end,beat):
    k=tone(55,.5,att=.002,dec=.12)*1.0; add(mus,k,b,.5 if b<F(10.4) else .3)
    add(mus,hp(rng.standard_normal(int(.05*SR)),6000)*env(int(.05*SR),.001,.01),b+beat/2,.12 if b<F(10.4) else 0)
def pad(freqs,a,b,g):
    n=int((b-a)*SR); tt=np.arange(n)/SR; x=sum(np.sin(2*np.pi*f*tt+np.sin(2*np.pi*.3*tt)*.5)+.3*np.sin(2*np.pi*f*2.003*tt) for f in freqs)
    e=np.minimum(tt/.8,1)*np.minimum((b-a-tt)/.6,1); add(mus,lp(x,1800)*e,a,g)
pad([110,130.8,164.8],0,F(10.4),.05)                # la mineur tendu
pad([87.3,130.8,174.6,207.7],F(10.4),I0+1.5,.05)
pad([82.4,123.5,164.8,196],I0+1.5,tens_end,.06)  # suspendu sur Marie
pad([130.8,164.8,196,246.9],calm,DUR,.06)           # do majeur 7 chaud
pad([65.4],calm,DUR,.05)
# mix
def norm(x,peak): return x/np.max(np.abs(x))*peak
for name,buf,pk in [('sfx_synth',sfx,.7),('music_synth',mus,.6)]:
    wavfile.write(f'{name}.wav',SR,(norm(buf,pk)*32767).astype(np.int16))
print('ok')
