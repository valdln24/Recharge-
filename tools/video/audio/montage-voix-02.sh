V=audio/vo_v02.mp3
seg(){ echo "[0:a]atrim=$1:$2,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=$(python3 -c "print(round($2-$1-0.04,3))"):d=0.04,adelay=$(python3 -c "print(int($3*1000))")|$(python3 -c "print(int($3*1000))")[$4];"; }
F="$(seg 0 2.6 1.6 a)$(seg 2.7 7.55 6.0 b)$(seg 7.6 12.85 12.0 c)$(seg 12.9 17.1 18.6 d)$(seg 17.15 19.97 27.3 e)[a][b][c][d][e]amix=inputs=5:normalize=0,apad,atrim=0:32[vo]"
ffmpeg -nostdin -v error -y -i $V -filter_complex "$F" -map "[vo]" -ar 44100 audio/vo_track_02.wav
