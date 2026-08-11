---
name: manim
description: >-
  Author and render clear, pedagogical Manim Community Edition animations — math/ML concept
  explainers (self-attention / transformers, backprop & gradient flow, neural nets, softmax,
  positional encoding, gradient descent, loss curves) as MP4/GIF on macOS. Use whenever the user
  wants a Manim scene, a "видео из манима", an animated explanation of a formula or algorithm, to
  set up Manim, or to debug a Manim render error. Encodes the non-negotiable rules that make
  LLM-written Manim actually RUN: Community Edition ONLY (never manimlib / ManimGL / 3b1b source
  verbatim), raw-string LaTeX, a verified-API cheatsheet + forbidden-API list, the plan→render→fix
  loop (lifts first-try success from ~7% to ~93%), ML scene templates with 3Blue1Brown color/pacing
  conventions, macOS setup (Python 3.12 via uv — manim has NO 3.14 wheels — brew cairo/pango, then
  `manim checkhealth`), render-flag quick reference, and the Cyrillic-text rule (use Text(font=...),
  never put Cyrillic in MathTex). Billy is all-in on Manim: dark theme, Russian labels, step-by-step.
  Built 2026-06-19 from a 5-agent research sweep of docs, benchmarks (ManiBench, TheoremExplainAgent)
  and other devs' Manim skills.
---

# Manim — clear ML/math animations that actually render

Reference files (load with Read when needed):
- `reference.md` — full patterns, gotchas table, GL→CE rename table, community skills to borrow.
- `scaffold.py` — a verified-rendering CE scene skeleton + ML helpers (dark theme). Copy & adapt.

**Known-good example on this machine:** `/Users/billy/repos/transformer/scripts/attention_manim.py`
(dark theme, Russian labels, 7-step self-attention — verified-rendered). A working venv exists at
`/tmp/manimenv` (manim 0.20.1, Python 3.12) → render with `/tmp/manimenv/bin/manim ...`.

---

## The 5 hard rules — never break these (this is why generated Manim breaks)

1. **Community Edition ONLY.** `from manim import *`. NEVER `from manimlib import *`. NEVER copy
   `github.com/3b1b/videos` code verbatim — it is ManimGL (incompatible API). Study it for *ideas*, not code.
2. **Method must be exactly `def construct(self):`** inside a `Scene` subclass. Any other name → black frame / "no scenes found".
3. **LaTeX strings are raw:** `MathTex(r'\frac{QK^T}{\sqrt{d_k}}')`. A plain `'\frac...'` silently corrupts. For prose / **Cyrillic** use `Text(...)`, **never** `MathTex` (Cyrillic in MathTex needs a ctex template and usually fails).
4. **Position relatively**, never hard-code coordinates: `next_to`, `to_edge`, `to_corner`, `arrange(dir, buff=, aligned_edge=)`. **FadeOut a stage before the next** — stale mobjects accumulate into clutter (the #1 visual failure).
5. **Pace it:** `self.wait(1)` after each concept reveal (`0.5` after sub-steps, `2` before a new abstraction). Default `run_time=1`; use `2–3` for important reveals.

## Verified API cheatsheet (CE v0.19/0.20)

- **Create/reveal:** `Create`, `Write`, `FadeIn(m, shift=UP*0.2)`, `GrowFromEdge(m, DOWN)`, `GrowArrow`, `DrawBorderThenFill`
- **Transform:** `Transform(a,b)` (a keeps ref), `ReplacementTransform(a,b)` (use for A→B→C chains), `TransformMatchingTex`, `TransformFromCopy`
- **Position:** `next_to`, `to_edge`, `to_corner`, `align_to`, `arrange`, `arrange_in_grid(rows=,cols=)`, `move_to`, `shift`
- **Group:** `VGroup` (VMobjects only), `Group` (mixed incl. ImageMobject)
- **Highlight:** `Indicate(m, color=)`, `Circumscribe`, `Flash(m, color=, flash_radius=)`, `FocusOn`, `SurroundingRectangle(m, color=YELLOW, buff=0.1)` ← keyword args after v0.19
- **Live values:** `ValueTracker` + `always_redraw(lambda: ...)` (positioning INSIDE the lambda, else it spawns at ORIGIN)
- **Compose:** `AnimationGroup` (simultaneous), `LaggedStart(*anims, lag_ratio=0.1..0.3)` (stagger), `Succession` (strict)

**NEVER USE (ManimGL / removed):** `ShowCreation`→`Create` · `TexMobject`/`TextMobject`→`MathTex`/`Text` ·
`FadeInFrom`/`FadeInFromDown`/`FadeOutAndShift`→`FadeIn(shift=)`/`FadeOut(shift=)` · `GraphScene`→`Axes` ·
`CONFIG={}` dict→`__init__`/`construct` · `self.frame`→`self.camera.frame` · `manimlib` imports.

## Workflow: plan → code → render → fix (≤5)

1. **Plan first** (one short beat-list). For 3+ stage scenes write an intermediate scene description
   (Topic · Key formulas in LaTeX · Visual elements · Layout with safe margins · Style) BEFORE Python — skipping this is the hallucination spiral.
2. **One `Scene` per concept** (~15–20 s target). Long videos = several scenes concatenated, not one monolith.
3. **Render iterating with `-pql`** (480p, fast); `-qm` (720p) / `-qh` (1080p) only for final.
4. **Render-and-fix loop (the reliability lever, ~7%→~93%):** on error, read the last ~10 stderr lines, triage →
   (a) **API hallucination** → check the cheatsheet / NEVER-USE list; (b) **LaTeX error** → raw string / `TexTemplate.add_to_preamble`; (c) **coding** → imports/undefined vars / object not `add`ed before transform. Fix, retry. **Cap 5**; if still failing, simplify the scene scope.
5. **Verify visually:** extract a frame (`ffmpeg -sseof -1 -i out.mp4 -frames:v 1 f.png`, or `-s` for last-frame PNG) and LOOK at it before declaring done — catches overlap/off-screen/missing glyphs.

## ML scene recipes

Emit this color block at the top of every ML scene (3b1b convention):
```python
Q_COL, K_COL, V_COL = YELLOW, TEAL, GREEN
POS, NEG, GRAD, STRUCT = WHITE, RED, ORANGE, GREY
PRIMARY, CONTEXT, STRUCTURAL = 1.0, 0.4, 0.15   # opacity tiers — fights clutter
```
Concept → scene type:
- **Attention weights** → grid of `Rectangle`/`Square`, fill opacity = score; `BarChart` for softmax; `SurroundingRectangle` to highlight a cell.
- **Backprop / gradient flow** → reversed `Arrow`s (`GrowArrow`), `ORANGE`, thickness ∝ |gradient|; show δ recursion text.
- **Softmax / temperature sweep** → `Axes` + `BarChart` + `ValueTracker` + `always_redraw`.
- **Neural net forward** → `Circle` nodes (opacity = activation) + `Line` edges (color = weight sign); or `manim-ml` (`pip install manim-ml`: `FeedForwardLayer`, `Convolutional2DLayer`).
- **Positional encoding** → grid of `Square` with `interpolate_color`.
- **Pedagogy:** concrete example FIRST → derive abstraction → generalize. Every logical unit (token/layer/head) is its own `VGroup`.

## Setup (macOS) — the verified path

manim has **no wheels for Python 3.14** → use **3.12** (or 3.13). `ffmpeg` is NOT needed since manim 0.19 (bundled).
```bash
brew install cairo pkg-config pango        # render backends
# LaTeX only if you use MathTex/Tex (skip for Text-only/Cyrillic scenes):
brew install --cask mactex-no-gui
uv venv .venv --python 3.12 && uv pip install manim numpy
uv run manim checkhealth                   # run BEFORE first render; fix FAILED items
uv run manim -pql scene.py SceneName
```
Render flags: `-ql`=480p15(dev) · `-qm`=720p30 · `-qh`=1080p60(final) · `-qk`=4K · `-p`=preview · `-s`=last-frame PNG · `--format gif` · `--media_dir DIR`.

**Cyrillic / non-Latin:** `Text("текст", font="DejaVu Sans")` (or any Pango font) — NEVER in `MathTex`.
If a unicode subscript/superscript glyph is missing (e.g. `dₖ` → tofu), use `MathTex` for the math or write `d_k` in plain `Text`.

## Borrow from other devs' skills (surveyed 2026)

`Yusuke710/manim-skill` (Plan→Code→Render→Iterate Codex skill) · `adithya-s-k/manim_skill` (modular reference docs) ·
`awesome-skills/manim-skill` · `helblazer811/ManimML` (NN layers) · `Kaos599/ML-Manim_Animations` (BERT/GPT scenes) ·
`CodingVillainKor/manim-kor` (attention.py / pos_enc.py / encdec.py) · `HarleyCoops/Math-To-Manim`.
Full list + URLs in `reference.md`.
