#!/bin/bash
# Topaz Video AI batch processor (macOS, bundled CLI).
# Usage: topaz-batch.sh <in_dir> <out_dir> [--slowmo N] [--scale N] [--up MODEL] [--fi MODEL] [--fps N] [--bitrate 40M] [--prores]
set -u

FF="/Applications/Topaz Video.app/Contents/MacOS/ffmpeg"
[ -x "$FF" ] || FF="/Applications/Topaz Video AI.app/Contents/MacOS/ffmpeg"
MODELS="$(dirname "$(dirname "$FF")")/Resources/models"
export TVAI_MODEL_DIR="$MODELS"
export TVAI_MODEL_DATA_DIR="$MODELS"

[ -x "$FF" ] || { echo "Topaz ffmpeg не найден. Установлен ли Topaz Video.app?"; exit 1; }

IN="${1:?usage: topaz-batch.sh <in_dir> <out_dir> [opts]}"
OUT="${2:?usage: topaz-batch.sh <in_dir> <out_dir> [opts]}"
shift 2

SLOWMO=1; SCALE=1; UP=ahq-12; FI=apo-8; FPS=""; BR=40M; PRORES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --slowmo)  SLOWMO="$2"; shift 2;;
    --scale)   SCALE="$2";  shift 2;;
    --up)      UP="$2";     shift 2;;
    --fi)      FI="$2";     shift 2;;
    --fps)     FPS="$2";    shift 2;;
    --bitrate) BR="$2";     shift 2;;
    --prores)  PRORES=1;    shift 1;;
    *) echo "неизвестный флаг: $1"; exit 1;;
  esac
done

# собрать -vf
VF=""
if [ "$SLOWMO" != "1" ] || [ -n "$FPS" ]; then
  f="tvai_fi=model=$FI:slowmo=$SLOWMO"
  [ -n "$FPS" ] && f="$f:fps=$FPS"
  VF="$f"
fi
if [ "$SCALE" != "1" ]; then
  u="tvai_up=model=$UP:scale=$SCALE"
  VF="${VF:+$VF,}$u"
fi
[ -z "$VF" ] && { echo "Нечего делать: задай --slowmo, --scale или --fps."; exit 1; }

if [ "$PRORES" = "1" ]; then
  ENC=(-c:v prores_videotoolbox -profile:v 3)
else
  ENC=(-c:v hevc_videotoolbox -profile:v main10 -b:v "$BR" -tag:v hvc1)
fi

mkdir -p "$OUT"
shopt -s nullglob
count=0
for in in "$IN"/*.mp4 "$IN"/*.mov "$IN"/*.MP4 "$IN"/*.MOV "$IN"/*.m4v; do
  [ -f "$in" ] || continue
  base="$(basename "$in")"
  out="$OUT/$base"
  count=$((count+1))
  echo "=== START $base  $(date +%H:%M:%S)  [vf: $VF] ==="
  "$FF" -hide_banner -y -i "$in" -vf "$VF" -an "${ENC[@]}" "$out"
  echo "=== DONE  $base  $(date +%H:%M:%S)  size=$(du -h "$out" 2>/dev/null | cut -f1) ==="
done
echo "ALL DONE: $count файлов  $(date +%H:%M:%S)  -> $OUT"
