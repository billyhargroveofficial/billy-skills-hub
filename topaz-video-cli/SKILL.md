---
name: topaz-video-cli
description: >-
  Process video with Topaz Video AI from the command line on macOS (no GUI) —
  upscale, slow-motion / frame interpolation, fps change, denoise, stabilize,
  batch a whole folder. Use when the user wants to upscale video (2x/4x), make
  slow-mo, change frame rate, clean up / stabilize footage, or run Topaz on many
  clips at once via CLI. Covers the bundled ffmpeg path, required TVAI env vars,
  the tvai filters + model names, verified macOS encoders (videotoolbox / ProRes),
  a ready batch script, speed expectations, and the gotchas (mkdir out dir before
  redirect, -an for slow-mo, harmless swscaler warning, "License heartbeat" check).
  Also covers fitting clips to an EXACT target duration at a fixed fps with no audio
  (extend a too-short clip, assemble several clips per shot to a spec) via the
  calibrated slowmo formula and a per-clip-then-concat pattern — see topaz-fit.sh.
---

# Topaz Video AI via CLI (macOS)

Topaz Video AI ships a custom **ffmpeg** build with `tvai_*` filters. If the desktop app is installed and licensed, the CLI works (look for `License heartbeat successful` in stderr).

## Binary + required env

```bash
FF="/Applications/Topaz Video.app/Contents/MacOS/ffmpeg"      # also ffprobe alongside
export TVAI_MODEL_DIR="/Applications/Topaz Video.app/Contents/Resources/models"
export TVAI_MODEL_DATA_DIR="$TVAI_MODEL_DIR"
```
Older installs may be named `Topaz Video AI.app` — adjust the path. Verify with:
`"$FF" -hide_banner -filters | grep tvai`  → should list `tvai_up`, `tvai_fi`, `tvai_pe`, `tvai_cpe`, `tvai_stb`.

## Filters & models

- **tvai_up** — upscale. Models: `ahq-12` (Artemis HQ, robust default), `prob-4` (Proteus), `gcg-5` (Gaia), `iris-3`, `nyx-3` (denoise/low-light), `rhea-1`/`rxl-1` (super-res), `thd-3` (Theia). Key params: `model`, `scale` (2 = double), or explicit `w`/`h`, `device` (-2 auto / 0 first GPU).
- **tvai_fi** — frame interpolation / slow-mo. Models: `apo-8` (Apollo, default), `chr-2` (Chronos), `apf`/`chf` (fast). Params: `model`, `slowmo` (N = N× more frames → N× longer at same fps = slow motion), `fps` (output fps), `rdt` (scene-change threshold).
- **tvai_stb** stabilize, **tvai_pe/cpe** parameter / camera-pose estimation.

Full model list: `ls "$TVAI_MODEL_DIR" | grep json`.

## Recipes

Slow-mo ×2 + upscale ×2 (the common ask):
```bash
-vf "tvai_fi=model=apo-8:slowmo=2:fps=24,tvai_up=model=ahq-12:scale=2"
```
- `slowmo=2` + same `fps` ⇒ duration doubles (smooth slow motion).
- `scale=2` ⇒ 960×960 → 1920×1920.
- Order fi→up keeps interpolation at native res (cheaper) then upscales.

Upscale only to 4K-ish: `-vf "tvai_up=model=ahq-12:scale=2"` (run twice or use w/h for exact size).
FPS conversion (no slow-mo, e.g. 24→60): `-vf "tvai_fi=model=apo-8:fps=60"`.
Stabilize: `-vf "tvai_stb=model=ref-2:..."` (needs a first estimation pass for full mode).

## Fit clips to an EXACT target duration (25 fps, no audio) — the "spec delivery" job

The recurring real-world ask (client graphics, storyboards): each shot must reach a **target length** at a **fixed fps** with **no sound**, and short clips must be **extended** (never trimmed / "не сжимать"). Overshoot slightly — reaching AT LEAST the target is the goal.

**Calibrated slowmo math (verified on this build):**
```
output_duration = input_duration × slowmo      # output lands at EXACTLY fps
```
- **Fractional `slowmo` works** (e.g. `slowmo=1.15`, `slowmo=1.95`) — not just integers.
- There's a **~2 % undershoot** from frame-count rounding, so add margin: aim for `target + 0.5 s`.
  → `slowmo = (target + 0.5) / source_duration`  (never below `1.0`).
- Source already ≥ target? Don't slow it — just convert fps: `tvai_fi=model=apo-8:fps=25`.

Verify with a **2-second calibration** before a long batch (`-t 2 -i in ...`, then `ffprobe` the out): `slowmo=2` on 2 s → 3.92 s @ 25 fps; `slowmo=1.5` → 2.96 s. Cheap, confirms the model/version behaves.

**Several clips per shot → deliver them SEPARATE, do NOT concatenate.** When the output goes to an editor / montage stage (the usual case for client graphics), each clip is its own file — the editor assembles them. Process every clip through Topaz individually (each to 25 fps, + slowmo if extending) and hand over the parts, e.g. `GRF-1-1_1.mp4`, `GRF-1-1_2.mp4`. Do **not** glue them yourself; joining is the editor's job and pre-joining just removes their cut points. (Learned the hard way — Billy: «конкат склеивать не надо, это на монтаже сделают».)
- **Output naming (Billy's exact rule):** `G` + the graphic's number, keeping the hyphen inside the number. A **trailing `_N` is added ONLY when the shot is split into multiple concatenation clips** (the parts the editor joins). Single-clip shots get no index.
  - hyphen = graphic sub-number · underscore = concat-part separator (multi-clip only)
  - latin capital `G` (not `g`, not Cyrillic `Г`, not `GRF`)
  - multi-clip: `ГРФ-1-1` → `G1-1_1.mp4`, `G1-1_2.mp4` · `ГРФ-3-1` → `G3-1_1.mp4`, `G3-1_2.mp4`
  - single-clip: `ГРФ-2-1` → `G2-1.mp4` · `ГРФ-3-2` → `G3-2.mp4` · `ГРФ-5` → `G5.mp4` · `ГРФ-6` → `G6.mp4`
- **Duration target applies to the ASSEMBLED shot.** If the clips' natural sum already ≥ target (e.g. 2×10 s ≥ 16 s), deliver them at natural speed. If the natural sum is *under* target (e.g. 2×10 s vs a 21 s shot), slow **each** clip by the same factor so the sum-when-joined clears the target (`slowmo = (target+0.5)/total_src`), and note it.
- **Only join into one file when explicitly asked for a single deliverable.** Then still process each clip separately first, then stream-copy concat (`-f concat -safe 0 -c copy`) — never feed a concat filter into `tvai_fi` across a hard cut, or Apollo/Chronos synthesizes a **ghost/morph frame at the scene boundary**. Scale mismatched clips to a common WxH *before* the Topaz pass so the copy-concat params match.

**"Don't compress" master encode** (near-transparent, editing-friendly mp4):
```bash
-an -r 25 -c:v h264_videotoolbox -b:v 24M -profile:v high -pix_fmt yuv420p -tag:v avc1 -movflags +faststart
```

**One-shot helper** — fits N clips to a target duration, auto-computes slowmo, matches dims, drops audio:
```bash
~/.agents/skills/topaz-video-cli/topaz-fit.sh <output.mp4> <target_sec> <fps> <clip1> [clip2 ...]
# extend a single 10 s clip to ≥19 s @ 25 fps:
topaz-fit.sh out/GRF-3-2.mp4 19 25 pics/g3-2-1.mp4
# two clips of one shot, delivered SEPARATE for the editor (default) -> writes
# out/GRF-1-1_1.mp4 and out/GRF-1-1_2.mp4, each 25 fps, sized so their join ≥16 s:
topaz-fit.sh out/GRF-1-1.mp4 16 25 pics/g1-1-1.mp4 pics/g1-1-2.mp4
# force a single joined file instead (only when a one-file deliverable is asked for):
TVAI_JOIN=1 topaz-fit.sh out/GRF-1-1.mp4 16 25 pics/g1-1-1.mp4 pics/g1-1-2.mp4
```
It applies one slowmo factor across all clips so the *total* clears the target; clips whose raw sum already exceeds the target are just fps-converted. **Default is separate parts** (`_1`, `_2`, …) for editor delivery; set `TVAI_JOIN=1` to stream-copy them into one file.

## Encoders (Apple Silicon — NO libx264/x265 in this build)

Available: `h264_videotoolbox`, `hevc_videotoolbox`, `prores` / `prores_videotoolbox`, `libaom-av1`, `libvpx`.
- HEVC 10-bit master: `-c:v hevc_videotoolbox -profile:v main10 -b:v 40M -tag:v hvc1`
- Editing-friendly: `-c:v prores_videotoolbox -profile:v 3` (ProRes 422 HQ; big files).
- Drop audio for slow-mo (it desyncs): `-an`.

## Batch a folder

Use the bundled helper (processes every video in a dir):
```bash
~/.agents/skills/topaz-video-cli/topaz-batch.sh <in_dir> <out_dir> [--slowmo N] [--scale N] [--up MODEL] [--fi MODEL] [--fps N] [--bitrate 40M]
# e.g. slow ×2 + upscale ×2:
~/.agents/skills/topaz-video-cli/topaz-batch.sh ./videos ./out --slowmo 2 --scale 2
```
For long jobs run it in the background and watch the `out/` files appear (Topaz ffmpeg progress is `\r`-buffered, so the log lags — count output files instead).

## Speed & gotchas

- Speed ≈ **0.17× of output runtime** + ~25–30 s model warm-up per process. 960²→1920², 10 s→20 s clip ≈ **~2 min each**. Plan batches accordingly; run in background.
- **Create the output dir BEFORE redirecting a log into it** (`mkdir -p out` first) — otherwise `> out/log` fails with exit 1 before the script even runs.
- `No accelerated colorspace conversion … rgb48le` warnings are **harmless** (sws does it on CPU).
- **`moov atom not found` when probing a still-encoding file is NOT corruption** — with `-movflags +faststart` the moov atom is written last, so an in-progress output is unreadable until the job finishes. Wait, don't panic.
- **`Unable to parse "fps" option value "0" as video rate`** printed by `tvai_fi` (seen with `slowmo=…:fps=…`) is a **harmless init-time warning** — the output is still exact CFR at the requested fps (verify: `r_frame_rate`==`avg_frame_rate`==`25/1`, `nb_frames`==`duration*25`). Don't chase it.
- **Trim before stretch**: to cut a clip then slow it, put `-t <sec>` as an *input* option (before `-i`) so the filter sees only the first N seconds, then `slowmo` stretches that. `-t` after `-i` would instead clip the *output* and undo the stretch.
- **Run Topaz jobs sequentially, not in parallel** — they saturate the GPU, so concurrent processes just contend and each re-pays the ~25–30 s warm-up. Chain them (one background script) instead of fanning out.
- No `License heartbeat successful` / model errors ⇒ open the app once to log in / activate.
- Rename a batch to `1.mp4…N.mp4` by creation date:
  `i=1; stat -f '%B %N' *.mp4 | sort -n | sed 's/^[0-9]* //' | while IFS= read -r f; do mv -- "$f" "$i.mp4"; i=$((i+1)); done`
