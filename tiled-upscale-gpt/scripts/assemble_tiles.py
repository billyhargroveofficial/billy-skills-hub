#!/usr/bin/env python3
"""Reassemble model-generated tiles into one image.

    python assemble_tiles.py TILEDIR GENERATED_DIR RESULT.png

TILEDIR is what cut_tiles.py produced (needs layout.json). GENERATED_DIR holds whatever
the image model returned — filenames are irrelevant, tiles are matched to grid slots by
correlation against the source crops.
"""
import argparse, glob, json, math, os
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

p = argparse.ArgumentParser()
p.add_argument("tiledir")
p.add_argument("gendir")
p.add_argument("output")
p.add_argument("--no-color-match", action="store_true")
p.add_argument("--feather", type=float, default=0.5,
               help="fraction of the overlap used for the blend ramp (default 0.5)")
a = p.parse_args()

L = json.load(open(os.path.join(a.tiledir, "layout.json")))
src = Image.open(L["source"]).convert("RGB")
W, H = L["source_size"]
S = L["out"][0] / (L["tiles"][0]["box"][2] - L["tiles"][0]["box"][0])
CW, CH = round(W * S), round(H * S)
COLS, ROWS = L["cols"], L["rows"]

SIG = (64, round(64 / (L["out"][0] / L["out"][1])))


def sig(im):
    v = np.asarray(im.convert("L").resize(SIG, Image.LANCZOS), np.float64).ravel()
    return (v - v.mean()) / (v.std() or 1)


gen = sorted(sum([glob.glob(os.path.join(a.gendir, e))
                  for e in ("*.png", "*.jpg", "*.jpeg", "*.webp")], []))
if not gen:
    raise SystemExit(f"no images found in {a.gendir}")

refs = {t["file"]: sig(src.crop(tuple(t["box"]))) for t in L["tiles"]}
cand = {f: sig(Image.open(f)) for f in gen}
pairs = sorted(((t, f, float(refs[t] @ cand[f] / refs[t].size))
                for t in refs for f in cand), key=lambda x: -x[2])

assign, ut, uf = {}, set(), set()
for t, f, s in pairs:
    if t in ut or f in uf:
        continue
    assign[t], _ = (f, s), (ut.add(t), uf.add(f))

print("tile -> file (correlation):")
for t in sorted(assign):
    f, s = assign[t]
    flag = "  <-- LOW, check this tile" if s < 0.6 else ""
    print(f"  {t:14s} {os.path.basename(f)[-28:]:30s} {s:.3f}{flag}")
missing = [t["file"] for t in L["tiles"] if t["file"] not in assign]
if missing:
    print("MISSING (will be filled from the source):", missing)


def ramp(n, left, right, frac):
    w = np.ones(n)
    k = int(n * frac)
    if left and k:
        w[:k] = np.linspace(0, 1, k)
    if right and k:
        w[-k:] = np.linspace(1, 0, k)
    return w


acc = np.zeros((CH, CW, 3))
wacc = np.zeros((CH, CW, 1))
for t in L["tiles"]:
    x0, y0, x1, y1 = t["box"]
    tx0, ty0, tx1, ty1 = round(x0 * S), round(y0 * S), round(x1 * S), round(y1 * S)
    tw_, th_ = tx1 - tx0, ty1 - ty0
    ref = np.asarray(src.crop((x0, y0, x1, y1)).resize((tw_, th_), Image.LANCZOS), np.float64)
    if t["file"] in assign:
        im = Image.open(assign[t["file"]][0]).convert("RGB").resize((tw_, th_), Image.LANCZOS)
        arr = np.asarray(im, np.float64)
        if not a.no_color_match:
            for ch in range(3):
                sd = arr[..., ch].std() or 1
                arr[..., ch] = (arr[..., ch] - arr[..., ch].mean()) * (ref[..., ch].std() / sd) \
                               + ref[..., ch].mean()
        arr = np.clip(arr, 0, 255)
    else:
        arr = ref
    m = (ramp(th_, t["row"] > 1, t["row"] < ROWS, a.feather)[:, None] *
         ramp(tw_, t["col"] > 1, t["col"] < COLS, a.feather)[None, :])[..., None] + 1e-6
    acc[ty0:ty1, tx0:tx1] += arr * m
    wacc[ty0:ty1, tx0:tx1] += m

Image.fromarray(np.clip(acc / np.maximum(wacc, 1e-6), 0, 255).astype(np.uint8)).save(a.output)
print(f"saved {a.output}  {CW}x{CH}  ({S:.2f}x)")
