# Manim skill — deep reference

Loaded on demand from `SKILL.md`. Source: 5-agent research sweep (Manim CE docs, ManiBench,
TheoremExplainAgent, community skills), 2026-06-19.

## GL → CE rename table (the forbidden→correct map)

| ManimGL / old (NEVER) | Manim CE (USE) |
| --- | --- |
| `from manimlib import *` | `from manim import *` |
| `ShowCreation` | `Create` |
| `TexMobject`, `TextMobject` | `MathTex` (math), `Tex` (mixed), `Text` (prose) |
| `FadeInFrom(m, LEFT)` | `FadeIn(m, shift=LEFT)` |
| `FadeInFromDown(m)` | `FadeIn(m, shift=UP)` |
| `FadeOutAndShift(m, UP)` | `FadeOut(m, shift=UP)` |
| `GraphScene` | `Axes` (+ `axes.plot(...)`) |
| `CONFIG = {...}` dict | set in `__init__` / `construct` |
| `self.frame` | `self.camera.frame` (needs `MovingCameraScene`) |
| `self.play(ShowCreation(...))` positional buff | keyword args: `SurroundingRectangle(m, color=RED, buff=0.3)` |

## Patterns (CE sketches)

**Title–body with safe margins**
```python
title = Text("Self-Attention", font_size=42).to_edge(UP)
body  = VGroup(eq1, eq2).arrange(DOWN, aligned_edge=LEFT, buff=MED_SMALL_BUFF).next_to(title, DOWN, buff=MED_LARGE_BUFF)
self.play(Write(title)); self.play(FadeIn(body, shift=UP*0.3)); self.wait(1)
```
**Fade-between-stages**
```python
self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.8)
```
**Equation evolution (terms isolated with double-brace)**
```python
eq1 = MathTex(r"\text{Attn}", "=", r"\text{softmax}\!\left(\frac{QK^T}{\sqrt{d_k}}\right)", "V")
eq2 = MathTex(r"\text{Attn}", "=", "A", "V")
self.play(Write(eq1)); self.play(TransformMatchingTex(eq1, eq2))
```
**ValueTracker + always_redraw (position INSIDE lambda)**
```python
t = ValueTracker(0.0)
dot = always_redraw(lambda: Dot(axes.c2p(t.get_value(), np.sin(t.get_value())), color=BLUE))
self.add(dot); self.play(t.animate.set_value(TAU), run_time=4, rate_func=linear)
```
**LaggedStart reveal** — `lag_ratio` between `1/(2N)` and `1/N` for N items (N=10 → ~0.07; N=100 cells → ~0.01).
**Color-coded formula** — `MathTex(r"{{ Q }}", r"{{ K }}^T", r"{{ V }}")` then `eq[0].set_color(BLUE)` …
**Zoom (MovingCameraScene)** — `self.camera.frame.save_state()` → `self.play(self.camera.frame.animate.move_to(m).set(width=m.width*2.5))` → `Restore(self.camera.frame)`. Keep camera moves in their OWN `self.play`.

## Gotchas table

| Symptom | Fix |
| --- | --- |
| Black frame / "no scenes" | method must be exactly `construct`; confirm CE via `manim --version` / `python -m manim` |
| Missing letters in MathTex | stale TeX cache → `fmtutil -sys --all`; `dvisvgm >= 2.4` |
| `Transform(a,b)` then `a` looks stale | use `ReplacementTransform` for A→B→C chains; `TransformFromCopy` to keep original |
| Updater fights Transform (jitter/snap) | `m.suspend_updating()` (or `clear_updaters()`) before Transform |
| `always_redraw` mob appears at ORIGIN | put positioning inside the lambda |
| closure bug in loop lambdas | default-arg capture: `always_redraw(lambda v=ref: Dot().next_to(v, UP))` |
| `VGroup` + image → AttributeError | use `Group` for non-VMobjects |
| screen cluttered by midpoint | FadeOut prior stage; `self.clear()`; opacity tiers 1.0/0.4/0.15 |
| `BarChart` not animating | `self.play(chart.animate.change_bar_values(vals))` |
| Matrix crashes on bad entry | `Matrix(..., element_to_mobject=lambda x: MathTex(f"{x:.2f}"))` |
| missing LaTeX pkg (`\bm`,`\mathscr`) | `tmpl=TexTemplate(); tmpl.add_to_preamble(r"\usepackage{bm}"); MathTex(..., tex_template=tmpl)` |
| `self.add()` shows instantly | use `self.play(FadeIn/Create(...))` for animated entrance; reserve `add` for static |
| FileNotFoundError at render | no external mp3/svg/png — Manim built-ins only (or manim-voiceover) |
| Python 3.14 install fails | use 3.12/3.13 via uv; never <3.11 |
| `uv`/global manim conflict | `uv run manim ...` instead of bare `manim` |

## Quality / performance presets

| Flag | Resolution | ~time per scene |
| --- | --- | --- |
| `-ql` | 480p15 | 5–15 s (use while iterating) |
| `-qm` | 720p30 | 15–60 s |
| `-qh` | 1080p60 | 30–120 s (final) |
| `-qk` | 4K | minutes |

## Community resources (verified URLs)

**Skills / prompt-libraries (borrow structure):**
- Yusuke710/manim-skill — https://github.com/Yusuke710/manim-skill (Plan→Code→Render→Iterate Claude skill)
- adithya-s-k/manim_skill — https://github.com/adithya-s-k/manim_skill (modular reference docs pattern)
- awesome-skills/manim-skill — https://github.com/awesome-skills/manim-skill (agent-agnostic playbook)
- HarleyCoops/Math-To-Manim — https://github.com/HarleyCoops/Math-To-Manim (multi-agent reasoning pipeline)

**ML scene libraries / examples:**
- helblazer811/ManimML — https://github.com/helblazer811/ManimML (NN layers; `pip install manim-ml`)
- Kaos599/ML-Manim_Animations — https://github.com/Kaos599/ML-Manim_Animations (BERT/GPT/Llama scenes)
- CodingVillainKor/manim-kor — https://github.com/CodingVillainKor/manim-kor (attention.py, pos_enc.py, encdec.py)
- 3b1b/videos transformers — https://github.com/3b1b/videos/blob/master/_2024/transformers/attention.py (ManimGL — IDEAS only, don't copy)

**Docs / benchmarks:**
- Manim CE docs — https://docs.manim.community/en/stable/
- macOS install — https://docs.manim.community/en/stable/installation/macos.html
- uv install — https://docs.manim.community/en/stable/installation/uv.html
- Text & formulas — https://docs.manim.community/en/stable/guides/using_text.html
- ManiBench (prompting failure modes) — https://huggingface.co/datasets/nabin2004/ManiBench
- TheoremExplainAgent — https://arxiv.org/html/2502.19400v2
