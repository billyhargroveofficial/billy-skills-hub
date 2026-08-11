#!/bin/bash
# topaz-fit.sh — fit one or more clips (concatenated) to a target duration
# at a fixed fps, with NO audio, using Topaz Video AI frame interpolation.
#
#   topaz-fit.sh <output.mp4> <target_sec> <fps> <clip1> [clip2 ...]
#
# Behaviour:
#   * total source duration < target  -> slow every clip by one factor so the
#     joined result clears the target (+~0.5s margin for frame rounding).
#   * total source duration >= target -> no slowdown, just convert to <fps>.
#   * multiple clips are ALWAYS processed SEPARATELY. By default they are
#     delivered as separate files (out_1.mp4, out_2.mp4, …) for the editor to
#     assemble — pre-joining removes their cut points. Set TVAI_JOIN=1 to
#     stream-copy them into one file instead (clean cuts, no ghost/morph frame).
#     Mismatched sizes are scaled to the first clip's WxH before processing.
#
# Output: h264 24Mbps high-profile mp4, 25/…fps CFR, no audio, +faststart.
# Env: TVAI_JOIN=1 (join into one file) | TVAI_FI_MODEL | TVAI_BITRATE | TVAI_MARGIN
set -euo pipefail

[ $# -ge 4 ] || { echo "usage: topaz-fit.sh <out.mp4> <target_sec> <fps> <clip1> [clip2 ...]" >&2; exit 2; }
OUT="$1"; TARGET="$2"; FPS="$3"; shift 3
CLIPS=("$@")

APP="/Applications/Topaz Video.app"
[ -d "$APP" ] || APP="/Applications/Topaz Video AI.app"
FF="$APP/Contents/MacOS/ffmpeg"; FP="$APP/Contents/MacOS/ffprobe"
export TVAI_MODEL_DIR="$APP/Contents/Resources/models"
export TVAI_MODEL_DATA_DIR="$TVAI_MODEL_DIR"
[ -x "$FF" ] || { echo "Topaz ffmpeg not found at $FF" >&2; exit 1; }

MODEL="${TVAI_FI_MODEL:-apo-8}"          # override via env if desired
BR="${TVAI_BITRATE:-24M}"
MARGIN="${TVAI_MARGIN:-0.5}"             # safety seconds added to the target
ENC=(-an -r "$FPS" -c:v h264_videotoolbox -b:v "$BR" -profile:v high -pix_fmt yuv420p -tag:v avc1 -movflags +faststart)

dur () { "$FP" -v error -show_entries format=duration -of csv=p=0 "$1"; }
dims () { "$FP" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$1"; }

# total source duration + reference dimensions (first clip)
TOTAL=0
for c in "${CLIPS[@]}"; do TOTAL=$(echo "$TOTAL + $(dur "$c")" | bc -l); done
REF=$(dims "${CLIPS[0]}"); RW="${REF%,*}"; RH="${REF#*,}"

# one slowmo factor for all clips: (target+margin)/total, floored at 1.0
SLOWMO=$(echo "scale=4; f=($TARGET + $MARGIN)/$TOTAL; if (f<1) f=1; f" | bc -l)
printf 'fit -> %s | %d clip(s), src=%.2fs, target=%ss @ %sfps, slowmo=%s\n' \
  "$(basename "$OUT")" "${#CLIPS[@]}" "$TOTAL" "$TARGET" "$FPS" "$SLOWMO"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$(dirname "$OUT")"

FILTER="tvai_fi=model=$MODEL:slowmo=$SLOWMO:fps=$FPS"
# slowmo≈1 -> drop the param (pure fps convert)
awk "BEGIN{exit !($SLOWMO<=1.0001)}" && FILTER="tvai_fi=model=$MODEL:fps=$FPS"

PARTS=(); i=0
for c in "${CLIPS[@]}"; do
  i=$((i+1)); p="$TMP/part_$i.mp4"; cd="$(dims "$c")"
  vf="$FILTER"
  [ "$cd" = "$REF" ] || vf="scale=$RW:$RH:flags=lanczos,$FILTER"   # match ref size before concat
  echo "  [$i/${#CLIPS[@]}] $(basename "$c")  vf: $vf"
  "$FF" -hide_banner -loglevel error -y -i "$c" -vf "$vf" "${ENC[@]}" "$p" \
    2>&1 | grep -ivE 'heartbeat|license|roam|expir|checkout|release version|AIE-RLM' | head || true
  PARTS+=("$p")
done

report () { # <file>
  local d r a; d=$(dur "$1"); r=$("$FP" -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$1")
  a=$("$FP" -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$1" || true)
  printf 'done  -> %s  %.2fs  %s  audio:%s\n' "$(basename "$1")" "$d" "$r" "${a:-none}"
}

if [ "${#PARTS[@]}" -eq 1 ]; then
  cp "${PARTS[0]}" "$OUT"; report "$OUT"
elif [ "${TVAI_JOIN:-0}" = 1 ]; then
  L="$TMP/list.txt"; : > "$L"
  for p in "${PARTS[@]}"; do printf "file '%s'\n" "$p" >> "$L"; done
  "$FF" -hide_banner -loglevel error -y -f concat -safe 0 -i "$L" -c copy -movflags +faststart "$OUT" \
    || "$FF" -hide_banner -loglevel error -y -f concat -safe 0 -i "$L" "${ENC[@]}" "$OUT"
  report "$OUT"
else
  # default: separate parts for the editor -> <out-base>_1.mp4, _2.mp4, ...
  base="${OUT%.*}"; ext="${OUT##*.}"; i=0
  for p in "${PARTS[@]}"; do i=$((i+1)); cp "$p" "${base}_${i}.${ext}"; report "${base}_${i}.${ext}"; done
fi
