#!/bin/bash
# Builds lofi.mp4: the mod's own audio, sequenced the way a session drives it,
# with a live waveform and captions naming what triggered each change.
set -euo pipefail
A=../plugins/lofi/audio
F=/System/Library/Fonts/SFNSMono.ttf
B=/System/Library/Fonts/SFNS.ttf
txt() { # text, x, y, size, color, from, to, font
  printf "drawtext=fontfile=%s:text='%s':x=%s:y=%s:fontsize=%s:fontcolor=%s:enable='between(t,%s,%s)'" "${8:-$F}" "$1" "$2" "$3" "$4" "$5" "$6" "$7"
}
CAPS=$(IFS=,; echo "$(txt 'lofi' 80 70 44 0xc2a4ff 0 30 $B),$(txt 'a soundtrack that follows your Claude Code session' 80 130 24 0x8a8f98 0 30),\
$(txt 'calm' 80 470 64 0xf3eee6 0 7 $B),$(txt '/lofi on  ·  Claude is idle' 80 555 28 0x8a8f98 0 7),\
$(txt 'focus' 80 470 64 0xf3eee6 7 15 $B),$(txt 'you sent a prompt  ·  Claude is working' 80 555 28 0x8a8f98 7 15),\
$(txt 'flow' 80 470 64 0xf3eee6 15 23 $B),$(txt '3 edits inside a minute  ·  Claude is editing hard' 80 555 28 0x8a8f98 15 21.8),\
$(txt 'npm test passed  ·  chime' 80 555 28 0x3ecf8e 21.8 23),\
$(txt 'calm' 80 470 64 0xf3eee6 23 30 $B),$(txt 'a long turn finished  ·  done chord, then calm' 80 555 28 0x8a8f98 23 30),\
$(txt 'github.com/saksham10arora-dotcom/claude-mods' 80 650 22 0x6b7079 0 30)")
ffmpeg -v error -y \
  -i $A/calm.mp3 -i $A/focus.mp3 -i $A/flow.mp3 -i $A/calm.mp3 -i $A/pass.mp3 -i $A/done.mp3 \
  -f lavfi -i "color=c=0x0b0b10:s=1280x720:r=30:d=30" \
  -filter_complex "\
[0:a]atrim=0:8,asetpts=PTS-STARTPTS,afade=t=in:d=1.5[c1];\
[1:a]atrim=0:9,asetpts=PTS-STARTPTS[f];\
[2:a]atrim=0:9,asetpts=PTS-STARTPTS[w];\
[3:a]atrim=4:11,asetpts=PTS-STARTPTS[c2];\
[c1][f]acrossfade=d=1[x1];[x1][w]acrossfade=d=1[x2];[x2][c2]acrossfade=d=1,afade=t=out:st=27.5:d=2.5[bed];\
[4:a]adelay=22000|22000,volume=1.2[pass];[5:a]adelay=23200|23200[done];\
[bed][pass][done]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:30[mix];\
[mix]asplit[aout][awave];\
[awave]aformat=channel_layouts=mono,showwaves=s=1120x220:mode=cline:colors=0xc2a4ff:scale=sqrt:draw=full:rate=30,format=rgba[wave];\
[6:v]format=rgba[bg];[bg][wave]overlay=80:210:format=rgb,${CAPS}[vout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 160k -shortest lofi.mp4
echo "lofi.mp4 $(ffprobe -v error -show_entries format=duration -of csv=p=0 lofi.mp4)s"
