---
name: "youtube-whisper-timestamps"
description: >-
  Create YouTube-ready chapters, SRT subtitles, and a readable transcript from a local video using local Whisper on macOS. Use when the user asks for таймкоды для YouTube, SRT/subtitles, transcript/транскрипт, or chapters from a video/audio file. Prefer local whisper.cpp with the existing Superwhisper large-v3-turbo ggml model, but never update, reinstall, or otherwise modify the Superwhisper app.
---

# YouTube Whisper Timestamps (local, compact, macOS)

Use this when Billy asks to make YouTube timestamps/chapters, SRT subtitles, or a transcript from a local video.

Core promises:

- Do **not** update, reinstall, or modify `/Applications/superwhisper.app`.
- Do **not** use Superwhisper GUI unless Billy explicitly asks; use a local CLI runner.
- Prefer the existing model at `/Users/billy/Library/Application Support/superwhisper/ggml-large-v3-turbo.bin` read-only.
- Do **not** copy the 1.5 GB model into the project folder.
- Do **not** copy the source video into the project folder.
- Avoid Torch/Python Whisper installs for this task unless there is no workable `whisper.cpp` path; they are large.
- Keep the workspace compact. Target under ~100 MB for a 30 minute video by storing only extracted mono audio, text artifacts, and a small runner.

## Output shape

Create a dedicated project folder, usually under `/Users/billy/repos/<video-slug>-youtube-timestamps` when Billy asks to work in repos.

Recommended layout:

```text
audio/<slug>_16k_mono.wav
chapters/youtube_chapters.txt
transcripts/<slug>_large-v3-turbo.srt              # raw whisper.cpp SRT
transcripts/<slug>_large-v3-turbo.youtube.srt      # merged publish SRT
transcripts/<slug>_large-v3-turbo.clean.md         # readable transcript grouped by chapters
transcripts/<slug>_large-v3-turbo.txt/json/csv     # raw artifacts
tools/whisper-runner/bin/whisper-cli               # compact runner and dylibs
tools/run_large_v3_turbo.sh                        # rerun command
README.md
```

If working in Codex Desktop and the user needs deliverables, copy only the small final text files to the thread `outputs/` directory. Never copy video, WAV, or model there.

## YouTube chapter rules

Before finalizing, verify the current official YouTube chapter rules from `support.google.com/youtube` because platform rules can change.

As of the last run, the rules were:

- First chapter starts at `00:00`.
- At least 3 chapters.
- Chapters are in chronological order.
- Each chapter is at least 10 seconds long.

Use format:

```text
00:00 Chapter title
01:23 Next chapter title
```

For videos over 1 hour, `HH:MM:SS` is fine.

## Procedure

1. Inspect the media and disk.

```bash
ffprobe -hide_banner -v error \
  -show_entries format=duration,size,format_name \
  -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate:stream_tags=language \
  -of json "$VIDEO"
df -h "$WORKDIR"
du -h "/Users/billy/Library/Application Support/superwhisper/ggml-large-v3-turbo.bin" 2>/dev/null || true
```

2. Extract compact audio only.

```bash
ffmpeg -hide_banner -y -i "$VIDEO" \
  -vn -sn -dn -map 0:a:0 \
  -ac 1 -ar 16000 -c:a pcm_s16le \
  "$WORKDIR/audio/${SLUG}_16k_mono.wav"
```

For 26-30 minutes this is usually ~50 MB.

3. Build or reuse `whisper.cpp`.

If no runner exists in the project, clone/build `whisper.cpp`, then keep only `build/bin`:

```bash
git clone --depth 1 --filter=blob:none https://github.com/ggml-org/whisper.cpp.git "$WORKDIR/tools/whisper.cpp"
cmake -S "$WORKDIR/tools/whisper.cpp" -B "$WORKDIR/tools/whisper.cpp/build" \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_SERVER=OFF \
  -DWHISPER_BUILD_EXAMPLES=ON \
  -DCMAKE_BUILD_TYPE=Release
cmake --build "$WORKDIR/tools/whisper.cpp/build" --config Release \
  -j "$(sysctl -n hw.ncpu)" --target whisper-cli

mkdir -p "$WORKDIR/tools/whisper-runner"
cp -a "$WORKDIR/tools/whisper.cpp/build/bin" "$WORKDIR/tools/whisper-runner/bin"
"$WORKDIR/tools/whisper-runner/bin/whisper-cli" --help >/dev/null
rm -rf "$WORKDIR/tools/whisper.cpp"
```

4. Transcribe with the existing large-v3-turbo model.

```bash
MODEL="/Users/billy/Library/Application Support/superwhisper/ggml-large-v3-turbo.bin"
"$WORKDIR/tools/whisper-runner/bin/whisper-cli" \
  -m "$MODEL" \
  -f "$WORKDIR/audio/${SLUG}_16k_mono.wav" \
  -l ru \
  -t 8 \
  -bo 5 \
  -bs 5 \
  -ml 90 \
  -sow \
  -otxt \
  -osrt \
  -oj \
  -ojf \
  -ocsv \
  --print-progress \
  --suppress-nst \
  --prompt "Видео на русском про frontend, fullstack, backend, верстку, JavaScript, TypeScript, React, Vue, Node.js, Django, API, HTML, CSS, YouTube. Сохраняй английские технические термины по возможности." \
  -of "$WORKDIR/transcripts/${SLUG}_large-v3-turbo"
```

Adjust language and prompt to the video. Keep technical terms in the prompt.

5. Make publish artifacts.

- Use the raw JSON/SRT to identify semantic blocks.
- Create `chapters/youtube_chapters.txt` manually by meaning, not by every SRT segment.
- Make titles short and useful for YouTube, not sentence fragments.
- Create a readable Markdown transcript grouped by the chapter starts.
- Create a merged SRT for upload. Raw whisper.cpp SRT can be too fragmented; merge into captions of roughly 2-8 seconds and under ~115 chars.
- Lightly fix obvious Whisper errors in the publish versions only. Keep raw outputs untouched.

6. Validate.

```bash
python3 - <<'PY'
from pathlib import Path
p = Path("chapters/youtube_chapters.txt")
lines = [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
def sec(ts):
    parts = [int(x) for x in ts.split(":")]
    return parts[-1] + 60 * parts[-2] + (3600 * parts[0] if len(parts) == 3 else 0)
times = [sec(l.split()[0]) for l in lines]
print("chapters", len(lines))
print("first_is_00:00", lines[0].split()[0] == "00:00")
print("monotonic", all(a < b for a, b in zip(times, times[1:])))
print("min_interval_sec", min(b - a for a, b in zip(times, times[1:])))
print("last_start", lines[-1].split()[0])
PY
du -sh "$WORKDIR"
```

Final answer should include:

- Path to the workspace.
- Links to the final chapters, YouTube SRT, and clean transcript.
- A short note that Superwhisper was not updated/modified and the large model was not copied.
- The ready-to-paste chapter block.

## Cleanup discipline

Allowed to delete after successful build if you created it in this run:

- `tools/whisper.cpp` source checkout.
- temporary build dirs.

Do not delete:

- user source video.
- Superwhisper app or support files.
- the large-v3-turbo model.
- final text artifacts.

