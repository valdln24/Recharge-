V=audio/vo_claire3.mp3
seg(){ echo "[0:a]atrim=$1:$2,asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=$(python3 -c "print(round($2-$1-0.04,3))"):d=0.04,adelay=$(python3 -c "print(int($3*1000))")|$(python3 -c "print(int($3*1000))")[$4];"; }
F="$(seg 0 2.40 0.5 a)$(seg 2.40 3.15 3.3 b)$(seg 3.18 6.42 4.6 c)$(seg 6.42 10.22 9.2 d)$(seg 10.25 11.28 13.75 e)$(seg 11.3 15.55 15.0 f)$(seg 15.55 17.45 20.03 g)$(seg 17.5 20.34 24.28 h)[a][b][c][d][e][f][g][h]amix=inputs=8:normalize=0,apad,atrim=0:28.6[vo]"
ffmpeg -v error -y -i $V -filter_complex "$F" -map "[vo]" -ar 44100 audio/vo_track_v3.wav
