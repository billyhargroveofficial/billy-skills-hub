---
name: "tiled-upscale-gpt"
description: >-
  Upscale an image by cutting it into overlapping tiles, regenerating each tile with a
  chat-based image model (ChatGPT / Gemini / any UI that returns fixed-size images), and
  reassembling with feathered blending and per-tile colour matching. Use when a user wants
  to enlarge or add detail to an illustration, map, render, poster or any AI-generated
  artwork, especially after diffusion upscalers (Flux/SDXL tiled, ControlNet, SUPIR,
  Real-ESRGAN) gave mushy, hallucinated or over-smoothed results.
---

# Tiled upscale through a chat image model

Cut → regenerate each tile in a chat image model → reassemble. The human pastes tiles into
ChatGPT (up to ~10 images per turn) and returns the results; the scripts do the rest.

## When to use

- Source is **AI-generated art** (Midjourney/DALL·E/Flux output). These have no latent
  detail to "recover" — diffusion upscalers either smooth them or invent texture.
- The user cares about the picture *looking* richer, not about pixel-exact fidelity.
- 2–4× enlargement of illustrations, fantasy maps, terrain renders, posters, key art.

**Do not use** when pixel fidelity is required (photo forensics, print reproduction of a
scan, anything legal/medical). The model *redraws*; it does not enlarge.

## Why this beats local diffusion upscalers (learned the hard way)

A full day was burned on Flux tiled upscaling before this approach won. Record it so the
next agent doesn't repeat it:

| Attempt | Result |
|---|---|
| FluxControlNetPipeline, txt2img + ControlNet-Union tile | Redrew the coastline entirely — the pipeline generates each tile **from noise**, ControlNet is the only link to the source |
| Same, control scale 0.90 | Faithful but flat: a coarse copy, no new detail |
| img2img, no prompt (null embeds) | Erased detail — empty conditioning makes Flux smooth everything |
| img2img + prompt "topographic map" | Drew contour lines across flat ground; prompt wording leaks into texture |
| ComfyUI + Florence-2 per-tile captions, denoise 0.44 | Florence captioned it "surface of Mars" → Flux repainted Martian terrain |
| Same, denoise 0.25 + global prefix | Ridges recovered, thin rivers still erased |
| Chat image model on tiles | Rivers preserved **and** enhanced; best result |

Two transferable lessons:

1. **Thin 1–2px features do not survive latent round-trips.** Rivers, wires, hairlines get
   wiped at any denoise ≥ 0.25 and cannot be prompted back — the model repaints them as
   large forms. Lower denoise preserves but adds nothing. This is the trap.
2. **Auto-captioning per tile is a double-edged sword.** It genuinely helps when the caption
   is right and destroys the image when it is wrong. Always pin a global style prefix in
   front of the generated caption.

## Procedure

### 1. Cut

```bash
python scripts/cut_tiles.py INPUT.png OUTDIR --scale 2.4          # or --cols 3 --rows 3
```

Picks a grid whose tiles match the model's output aspect (default 1536×1024 = 3:2), with
~18% overlap, and writes `layout.json` plus a `_GRID.jpg` contact sheet. Tiles are exported
already resized to the model's output size so the model sees full detail.

Keep tile count ≤ 10 per batch — that's what one ChatGPT turn accepts. More tiles = more
style drift between them.

### 2. Generate

Give the user `templates/prompt.md` (or the localized copy) plus the tiles. The prompt's job
is to forbid the three things the model does by default: moving geometry, re-cropping, and
adding paper/grain/labels/compass stylisation.

The user pastes them in, gets N images back, drops them in a folder. Filenames don't matter.

### 3. Assemble

```bash
python scripts/assemble_tiles.py OUTDIR GENERATED_DIR RESULT.png
```

- **Matches** returned files to grid slots by normalised cross-correlation against the source
  crops, so shuffled filenames are fine. Prints scores — anything < 0.6 means the model went
  off-piste on that tile; regenerate it.
- **Colour-matches** every tile to its source crop (per-channel mean/σ). Essential: independent
  generations drift in tone and the seams would otherwise show as colour steps.
- **Feathers** overlaps with a linear ramp, only on edges that actually have a neighbour.

## Gotchas

- The model silently **re-crops** if the tile aspect doesn't match its output size. Always cut
  to the model's native aspect.
- Style drift grows with tile count; for >12 tiles submit row by row and mention "same style as
  the previous batch".
- If one tile comes back wrong, regenerate only that tile — assembly is idempotent.
- Result is **not** pixel-aligned with the source. Never composite it back over the original.
