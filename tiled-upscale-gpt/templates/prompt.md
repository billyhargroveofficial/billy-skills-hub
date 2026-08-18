# Prompt to hand the image model together with the tiles

Adapt the subject line (first sentence) to the artwork; keep the five rules verbatim —
each one blocks a specific failure the model produces by default.

---
Here are N fragments of one large **<SUBJECT: e.g. golden 3D relief map>**. For EACH
fragment produce a higher-detail version while strictly preserving the composition.

HARD REQUIREMENTS — do not break:

1. **Geometry is untouchable.** Every ridge, coastline bend, island, lake and river must stay
   in exactly the same place and keep the same shape. Move nothing, add no new objects,
   remove nothing.
2. **Do not change the framing.** Do not crop, extend, or rescale the content — the fragments
   overlap and must still line up with each other.
3. **Preserve colour and lighting:** <PALETTE: e.g. warm golden-sand tones, grey-blue water,
   soft light from upper left>. Do not make it warmer, cooler, darker or more contrasty.
4. **Improve micro-detail only:** sharper ridges and slopes, thin branching river channels and
   erosion gullies on the plains, small folds of terrain — as if the same render were produced
   at a higher resolution.
5. **Do NOT add:** paper or parchment texture, grain, lettering, labels, a compass rose,
   frames, vignettes, or any "antique" stylisation.

Output format: <OUT_W>x<OUT_H>, one image per fragment.
---

Grid layout (row_column), from `_GRID.jpg`:

```
tile_11 tile_12 tile_13
tile_21 tile_22 tile_23
tile_31 tile_32 tile_33
```

If the model refuses to do all of them at once, submit row by row and add
"same style and lighting as the previous batch" to each follow-up.
