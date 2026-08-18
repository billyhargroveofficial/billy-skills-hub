#!/usr/bin/env python3
"""Cut an image into overlapping tiles sized for a chat image model.

    python cut_tiles.py INPUT.png OUTDIR --scale 2.4
    python cut_tiles.py INPUT.png OUTDIR --cols 3 --rows 3

Tiles are exported at the model's output resolution so the model sees full detail,
and layout.json records where each one came from.
"""
import argparse, json, math, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

p = argparse.ArgumentParser()
p.add_argument("input")
p.add_argument("outdir")
p.add_argument("--scale", type=float, help="target upscale factor; picks the grid for you")
p.add_argument("--cols", type=int)
p.add_argument("--rows", type=int)
p.add_argument("--out-w", type=int, default=1536, help="model output width (default 1536)")
p.add_argument("--out-h", type=int, default=1024, help="model output height (default 1024)")
p.add_argument("--overlap", type=float, default=0.18, help="fraction of tile, default 0.18")
a = p.parse_args()

src = Image.open(a.input).convert("RGB")
W, H = src.size
ar = a.out_w / a.out_h

if a.cols and a.rows:
    cols, rows = a.cols, a.rows
    tw = W / (cols - (cols - 1) * a.overlap)
else:
    if not a.scale:
        p.error("give --scale or both --cols and --rows")
    tw = a.out_w / a.scale
    cols = max(1, math.ceil((W - tw * a.overlap) / (tw * (1 - a.overlap))))
    th_ = tw / ar
    rows = max(1, math.ceil((H - th_ * a.overlap) / (th_ * (1 - a.overlap))))
    tw = W / (cols - (cols - 1) * a.overlap)      # re-fit exactly

th = tw / ar
if th > H:                                        # tile taller than image -> refit on height
    th = H
    tw = th * ar
step_x = (W - tw) / (cols - 1) if cols > 1 else 0
step_y = (H - th) / (rows - 1) if rows > 1 else 0

os.makedirs(a.outdir, exist_ok=True)
meta = []
for r in range(rows):
    for c in range(cols):
        x0, y0 = round(c * step_x), round(r * step_y)
        x1, y1 = round(x0 + tw), round(y0 + th)
        x1, y1 = min(x1, W), min(y1, H)
        x0, y0 = max(0, x1 - round(tw)), max(0, y1 - round(th))
        name = f"tile_{r+1}{c+1}.png"
        src.crop((x0, y0, x1, y1)).resize((a.out_w, a.out_h), Image.LANCZOS) \
           .save(os.path.join(a.outdir, name))
        meta.append({"file": name, "box": [x0, y0, x1, y1], "row": r + 1, "col": c + 1})

json.dump({"source": os.path.abspath(a.input), "source_size": [W, H],
           "out": [a.out_w, a.out_h], "cols": cols, "rows": rows, "tiles": meta},
          open(os.path.join(a.outdir, "layout.json"), "w"), indent=1)

# contact sheet so a human can see the grid
tw_p, th_p = 320, round(320 / ar)
sheet = Image.new("RGB", (tw_p * cols + 4 * (cols + 1), th_p * rows + 4 * (rows + 1)), "white")
for m in meta:
    im = Image.open(os.path.join(a.outdir, m["file"])).resize((tw_p, th_p))
    sheet.paste(im, (4 + (m["col"] - 1) * (tw_p + 4), 4 + (m["row"] - 1) * (th_p + 4)))
sheet.save(os.path.join(a.outdir, "_GRID.jpg"), quality=88)

scale = a.out_w / tw
print(f"grid {cols}x{rows} = {cols*rows} tiles | tile {round(tw)}x{round(th)} px in source")
print(f"overlap ~{round(tw*a.overlap)}px | scale {scale:.2f}x -> {round(W*scale)}x{round(H*scale)}")
if cols * rows > 10:
    print(f"NOTE: {cols*rows} tiles exceeds one chat turn — submit in batches of ~10.")
